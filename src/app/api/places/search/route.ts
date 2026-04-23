import { NextRequest, NextResponse } from 'next/server'

// Google Places Text Search API (서버사이드 — API 키 보호)
export async function GET(req: NextRequest) {
  const q    = req.nextUrl.searchParams.get('q')?.trim()
  const near = req.nextUrl.searchParams.get('near') ?? 'Ho Chi Minh City Vietnam'

  if (!q || q.length < 1) {
    return NextResponse.json({ results: [] })
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    return NextResponse.json({ results: [], error: 'API key not configured' })
  }

  try {
    // 골프장 검색: type 제한 없이 장소명+지역으로 검색
    const searchQuery = encodeURIComponent(`${q} ${near}`)
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${searchQuery}&language=ko&key=${apiKey}`
    const res  = await fetch(url, { cache: 'no-store' })
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
