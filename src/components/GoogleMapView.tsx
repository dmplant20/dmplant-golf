'use client'

import { useEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    google?: any
  }
}

type Props = {
  lat?: number
  lng?: number
  zoom?: number
  height?: number
}

let loadingPromise: Promise<void> | null = null

function loadGoogleMaps(apiKey: string): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject('No window')
  }

  if (window.google?.maps) {
    return Promise.resolve()
  }

  if (loadingPromise) {
    return loadingPromise
  }

  loadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`
    script.async = true
    script.defer = true

    script.onload = () => resolve()
    script.onerror = () => reject('Google Maps load error')

    document.head.appendChild(script)
  })

  return loadingPromise
}

export default function GoogleMapView({
  lat = 37.5665,
  lng = 126.978,
  zoom = 13,
  height = 400,
}: Props) {
  const mapRef = useRef<HTMLDivElement | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

    if (!apiKey) {
      setError('API KEY 없음')
      setLoading(false)
      return
    }

    async function init() {
      try {
        await loadGoogleMaps(apiKey)

        if (!mapRef.current) return

        const center = { lat, lng }

        const map = new window.google.maps.Map(mapRef.current, {
          center,
          zoom,
        })

        new window.google.maps.Marker({
          position: center,
          map,
        })

        setLoading(false)
      } catch (e) {
        console.error(e)
        setError('지도 로드 실패')
        setLoading(false)
      }
    }

    init()
  }, [lat, lng, zoom])

  return (
    <div>
      {loading && <p>지도 불러오는 중...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      <div
        ref={mapRef}
        style={{
          width: '100%',
          height,
          border: '1px solid #333',
          borderRadius: 12,
        }}
      />
    </div>
  )
}
