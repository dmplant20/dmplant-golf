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
    return Promise.reject(new Error('window 없음'))
  }

  if (window.google?.maps) {
    return Promise.resolve()
  }

  if (loadingPromise) {
    return loadingPromise
  }

  loadingPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector(
      'script[data-google-maps="true"]'
    ) as HTMLScriptElement | null

    if (existingScript) {
      existingScript.addEventListener('load', () => resolve())
      existingScript.addEventListener('error', () =>
        reject(new Error('Google Maps 스크립트 로드 실패'))
      )
      return
    }

    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&loading=async`
    script.async = true
    script.defer = true
    script.dataset.googleMaps = 'true'

    script.onload = () => resolve()
    script.onerror = () =>
      reject(new Error('Google Maps 스크립트 로드 실패'))

    document.head.appendChild(script)
  })

  return loadingPromise
}

export default function GoogleMapView({
  lat = 37.5665,
  lng = 126.978,
  zoom = 13,
  height = 320,
}: Props) {
  const mapRef = useRef<HTMLDivElement | null>(null)
  const [status, setStatus] = useState('지도 준비중...')
  const [error, setError] = useState('')

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

    if (!apiKey) {
      setError('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY가 없습니다.')
      setStatus('')
      return
    }

    let cancelled = false

    async function init() {
      try {
        setStatus('Google Maps 로딩중...')
        await loadGoogleMaps(apiKey)

        if (cancelled || !mapRef.current || !window.google?.maps) return

        const center = { lat, lng }

        const map = new window.google.maps.Map(mapRef.current, {
          center,
          zoom,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        })

        new window.google.maps.Marker({
          position: center,
          map,
        })

        setStatus('지도 로드 완료')
      } catch (e: any) {
        console.error(e)
        setError(e?.message || '지도 로드 실패')
        setStatus('')
      }
    }

    init()

    return () => {
      cancelled = true
    }
  }, [lat, lng, zoom])

  return (
    <div
      style={{
        border: '1px solid #444',
        borderRadius: 12,
        padding: 12,
        marginBottom: 24,
      }}
    >
      <div style={{ marginBottom: 8, fontWeight: 'bold' }}>🗺️ Google Map Test</div>

      {status && <p style={{ marginBottom: 8 }}>{status}</p>}
      {error && <p style={{ color: 'red', marginBottom: 8 }}>{error}</p>}

      <div
        ref={mapRef}
        style={{
          width: '100%',
          height,
          border: '1px solid #333',
          borderRadius: 8,
          background: '#111',
        }}
      />
    </div>
  )
}
