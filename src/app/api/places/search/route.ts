import { NextRequest, NextResponse } from 'next/server'

// Google Places Text Search API (서버사이드 — API 키 보호)
export async function GET(req: NextRequest) {
  const q    = req.nextUrl.searchParams.get('q')?.trim()
  const near = req.nextUrl.searchParams.get('near') ?? 'Ho Chi Minh City'

  if (!q || q.length < 1) {
    return NextResponse.json({ results: [] })
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey || apiKey === 'YOUR_GOOGLE_MAPS_API_KEY_HERE') {
    // API 키 미설정 — 더미 데이터 반환 (개발용)
    return NextResponse.json({
      results: [
        { place_id: 'demo_1', name: `${q} (검색결과)`, address: near, lat: 10.7769, lng: 106.7009, rating: null },
      ],
      demo: true,
    })
  }

  try {
    const searchQuery = encodeURIComponent(`${q} restaurant ${near}`)
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${searchQuery}&type=restaurant&language=ko&key=${apiKey}`
    const res  = await fetch(url, { next: { revalidate: 60 } })
    const data = await res.json()

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('Places API error:', data.status, data.error_message)
      return NextResponse.json({ results: [], error: data.status }, { status: 200 })
    }

    const results = (data.results ?? []).slice(0, 8).map((p: any) => ({
      place_id: p.place_id,
      name:     p.name,
      address:  p.formatted_address,
      lat:      p.geometry?.location?.lat ?? null,
      lng:      p.geometry?.location?.lng ?? null,
      rating:   p.rating ?? null,
      types:    p.types ?? [],
    }))

    return NextResponse.json({ results })
  } catch (err) {
    console.error('Places fetch error:', err)
    return NextResponse.json({ results: [], error: 'fetch_failed' }, { status: 200 })
  }
}
