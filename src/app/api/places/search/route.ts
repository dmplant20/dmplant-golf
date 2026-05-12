import { NextRequest, NextResponse } from 'next/server'

// 검색 우선순위:
//   1. Mapbox Geocoding API (MAPBOX_TOKEN 있음) — 베트남 + 호치민 bias, 식당·카페·호텔 우선
//   2. Google Places API (GOOGLE_PLACES_API_KEY 있고 유효) — 폴백
//   3. OpenStreetMap Nominatim — 마지막 폴백 (키 불필요)
export async function GET(req: NextRequest) {
  const q    = req.nextUrl.searchParams.get('q')?.trim()
  const near = req.nextUrl.searchParams.get('near') ?? 'Vietnam'

  if (!q || q.length < 1) return NextResponse.json({ results: [] })

  // ── 1. Mapbox Geocoding API ───────────────────────────────────────────
  const mapboxToken = process.env.MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  let mapboxDebug: { tokenConfigured: boolean; status?: string; error?: string; results?: number } = {
    tokenConfigured: !!mapboxToken,
  }
  if (mapboxToken) {
    try {
      // Forward geocoding — 호치민 중심 proximity, 베트남 country, POI 카테고리 우선
      // proximity 좌표: 호치민시 1군 중심 (lon, lat)
      const proximity = '106.6953,10.7769'
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json` +
        `?proximity=${proximity}` +
        `&country=vn` +
        `&types=poi,address,place,locality` +
        `&limit=8` +
        `&language=vi,ko,en` +
        `&access_token=${mapboxToken}`
      const res  = await fetch(url, { cache: 'no-store' })
      const data = await res.json()
      mapboxDebug = {
        tokenConfigured: true,
        status: String(res.status),
        results: data.features?.length ?? 0,
      }
      if (res.ok && data.features?.length) {
        const results = data.features.map((f: any) => ({
          place_id: f.id,
          name:     f.text ?? f.place_name?.split(',')[0] ?? '',
          address:  f.place_name ?? '',
          lat:      f.center?.[1] ?? null,   // Mapbox returns [lng, lat]
          lng:      f.center?.[0] ?? null,
          rating:   null,  // Mapbox Geocoding 은 rating 없음
          source:   'mapbox',
        }))
        return NextResponse.json({ results, _debug: { mapbox: mapboxDebug } })
      }
      if (data.message) mapboxDebug.error = data.message
      console.warn('[places] Mapbox fallback:', data.message ?? `status ${res.status}`)
    } catch (e: any) {
      mapboxDebug.error = e?.message
      console.warn('[places] Mapbox fetch error, falling back:', e?.message)
    }
  }

  // ── 2. Google Places API (키가 유효한 경우 폴백) ─────────────────────
  const googleKey = process.env.GOOGLE_PLACES_API_KEY
  let googleDebug: { keyConfigured: boolean; status?: string; error_message?: string; results?: number } = {
    keyConfigured: !!googleKey,
  }
  if (googleKey) {
    try {
      const searchQuery = encodeURIComponent(`${q} ${near}`)
      const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${searchQuery}&language=ko&key=${googleKey}`
      const res  = await fetch(url, { cache: 'no-store' })
      const data = await res.json()
      googleDebug = {
        keyConfigured: true,
        status: data.status,
        error_message: data.error_message,
        results: data.results?.length ?? 0,
      }

      if (data.status === 'OK') {
        const results = (data.results ?? []).slice(0, 8).map((p: any) => ({
          place_id: p.place_id,
          name:     p.name,
          address:  p.formatted_address,
          lat:      p.geometry?.location?.lat ?? null,
          lng:      p.geometry?.location?.lng ?? null,
          rating:   p.rating ?? null,
          source:   'google',
        }))
        return NextResponse.json({ results, _debug: { mapbox: mapboxDebug, google: googleDebug } })
      }
      console.warn('[places] Google fallback to Nominatim:', data.status, data.error_message)
    } catch (e: any) {
      googleDebug = { keyConfigured: true, status: 'fetch_error', error_message: e?.message }
      console.warn('[places] Google fetch error, falling back to Nominatim:', e?.message)
    }
  }

  // ── 2. OpenStreetMap Nominatim (무료, API 키 불필요) ──────────────────
  // 1차: 베트남 country 제한 + viewbox(호치민) 우선
  // 2차: 0건이면 country 제한 풀어서 전 세계 검색
  async function nominatim(query: string, opts: { vnOnly?: boolean } = {}) {
    // 호치민시 중심 viewbox (lon1,lat1,lon2,lat2) — Bounded=1 로 강제
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      limit: '8',
      addressdetails: '1',
      'accept-language': 'vi,ko,en',
    })
    if (opts.vnOnly) {
      params.set('countrycodes', 'vn')
      params.set('viewbox', '106.4,11.2,107.1,10.5')
      params.set('bounded', '1')
    }
    const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`
    const res = await fetch(url, {
      cache: 'no-store',
      headers: {
        'User-Agent': 'ISGolf/1.0 (golf club management; contact admin@isgolf.app)',
        'Accept-Language': 'vi,ko,en',
      },
    })
    return (await res.json()) as any[]
  }

  try {
    // 1차: 베트남 + 호치민 우선
    let data = await nominatim(q, { vnOnly: true })
    // 2차: 베트남에 없으면 전체 검색 (한국 한식당 등도 매칭)
    if (data.length === 0) {
      data = await nominatim(`${q} ${near}`)
    }
    // 3차: 그래도 없으면 전 세계
    if (data.length === 0) {
      data = await nominatim(q)
    }

    const results = data.slice(0, 8).map((p: any) => ({
      place_id: `osm_${p.osm_id}`,
      name:     p.display_name.split(',')[0],
      address:  p.display_name,
      lat:      parseFloat(p.lat),
      lng:      parseFloat(p.lon),
      rating:   null,
      source:   'osm',
    }))

    // _debug 필드는 진단용 — curl 로 확인 가능
    return NextResponse.json({ results, _debug: { mapbox: mapboxDebug, google: googleDebug, source: 'osm' } })
  } catch (err: any) {
    console.error('Nominatim error:', err)
    return NextResponse.json({ results: [], error: 'search_failed', _debug: { mapbox: mapboxDebug, google: googleDebug } })
  }
}
