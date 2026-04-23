import { NextRequest, NextResponse } from 'next/server'

// OpenStreetMap Nominatim — 무료, API 키 불필요
// Google Places API가 있으면 우선 사용, 없으면 Nominatim 사용
export async function GET(req: NextRequest) {
  const q    = req.nextUrl.searchParams.get('q')?.trim()
  const near = req.nextUrl.searchParams.get('near') ?? 'Vietnam'

  if (!q || q.length < 1) return NextResponse.json({ results: [] })

  // ── 1. Google Places API (키가 유효한 경우 우선 사용) ─────────────────
  const googleKey = process.env.GOOGLE_PLACES_API_KEY
  if (googleKey) {
    try {
      const searchQuery = encodeURIComponent(`${q} ${near}`)
      const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${searchQuery}&language=ko&key=${googleKey}`
      const res  = await fetch(url, { cache: 'no-store' })
      const data = await res.json()

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
      console.warn('Google Places fallback to Nominatim:', data.status)
    } catch (e) {
      console.warn('Google Places error, falling back to Nominatim:', e)
    }
  }

  // ── 2. OpenStreetMap Nominatim (무료, API 키 불필요) ──────────────────
  try {
    const searchQuery = encodeURIComponent(`${q} ${near}`)
    const url = `https://nominatim.openstreetmap.org/search?q=${searchQuery}&format=json&limit=8&addressdetails=1&accept-language=ko`
    const res  = await fetch(url, {
      cache: 'no-store',
      headers: {
        'User-Agent': 'ISGolf/1.0 (golf club management; contact admin@isgolf.app)',
        'Accept-Language': 'ko,en',
      },
    })
    const data: any[] = await res.json()

    const results = data.slice(0, 8).map((p: any) => ({
      place_id: `osm_${p.osm_id}`,
      name:     p.display_name.split(',')[0],
      address:  p.display_name,
      lat:      parseFloat(p.lat),
      lng:      parseFloat(p.lon),
      rating:   null,
      source:   'osm',
    }))

    return NextResponse.json({ results })
  } catch (err) {
    console.error('Nominatim error:', err)
    return NextResponse.json({ results: [], error: 'search_failed' })
  }
}
