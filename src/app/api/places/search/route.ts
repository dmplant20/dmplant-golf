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
  // 1차: near 지역 우선 검색 → 0건이면 2차: 전 세계 검색 (한식 등 글로벌 매칭)
  async function nominatim(query: string) {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=8&addressdetails=1&accept-language=ko`
    const res = await fetch(url, {
      cache: 'no-store',
      headers: {
        'User-Agent': 'ISGolf/1.0 (golf club management; contact admin@isgolf.app)',
        'Accept-Language': 'ko,en',
      },
    })
    return (await res.json()) as any[]
  }

  try {
    let data = await nominatim(`${q} ${near}`)
    // near 지역에 없으면 전 세계 검색으로 fallback
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
