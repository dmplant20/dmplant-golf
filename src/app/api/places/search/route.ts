import { NextRequest, NextResponse } from 'next/server'

// OpenStreetMap Nominatim — 무료, API 키 불필요
// Google Places API가 있으면 우선 사용, 없으면 Nominatim 사용
export async function GET(req: NextRequest) {
  const q    = req.nextUrl.searchParams.get('q')?.trim()
  const near = req.nextUrl.searchParams.get('near') ?? 'Vietnam'

  if (!q || q.length < 1) return NextResponse.json({ results: [] })

  // ── 1. Google Places API (키가 유효한 경우 우선 사용) ─────────────────
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
        return NextResponse.json({ results })
      }
      // Google 실패 시 Nominatim으로 폴백
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

    // _debug 필드는 Google API 키 진단용 — 클라이언트에서 무시되지만 curl로 확인 가능
    return NextResponse.json({ results, _debug: googleDebug })
  } catch (err: any) {
    console.error('Nominatim error:', err)
    return NextResponse.json({ results: [], error: 'search_failed', _debug: googleDebug })
  }
}
