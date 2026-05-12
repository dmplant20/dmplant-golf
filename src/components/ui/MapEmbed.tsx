'use client'
// ── 지도 임베드 ──────────────────────────────────────────────────────────
// 1. NEXT_PUBLIC_MAPBOX_TOKEN 있으면 → Mapbox Static Image API (고품질, 깨끗한 핀)
// 2. 토큰 없으면 → OpenStreetMap iframe (무료 폴백)
import { ExternalLink } from 'lucide-react'

interface Props {
  name?: string
  address?: string
  lat?: number | null
  lng?: number | null
  placeId?: string          // 하위 호환성 유지 (사용 안 함)
  height?: number
  className?: string
}

export default function MapEmbed({ name, address, lat, lng, height = 200, className = '' }: Props) {
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

  // Mapbox Static Image — 가장 깔끔한 한 장짜리 지도 + 핀
  function getMapboxStatic(): string | null {
    if (!lat || !lng || !mapboxToken) return null
    const zoom = 15
    const width = 600   // device-friendly, retina via @2x
    const h = Math.min(400, Math.max(120, height))
    // 핀: 작은 빨간 마커
    const pin = `pin-s+ef4444(${lng},${lat})`
    return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/` +
      `${pin}/${lng},${lat},${zoom}/${width}x${h}@2x?access_token=${mapboxToken}`
  }

  // OpenStreetMap iframe (폴백)
  function getOsmSrc(): string | null {
    if (!lat || !lng) return null
    const d = 0.008
    return (
      `https://www.openstreetmap.org/export/embed.html` +
      `?bbox=${lng - d},${lat - d},${lng + d},${lat + d}` +
      `&layer=mapnik&marker=${lat},${lng}`
    )
  }

  // 외부 지도 앱으로 여는 링크
  function getMapsUrl(): string | null {
    if (lat && lng) return `https://www.google.com/maps?q=${lat},${lng}`
    const q = address || name
    if (q) return `https://www.google.com/maps/search/${encodeURIComponent(q)}`
    return null
  }

  const mapboxSrc = getMapboxStatic()
  const osmSrc    = getOsmSrc()
  const mapsUrl   = getMapsUrl()

  if (!mapboxSrc && !osmSrc && !mapsUrl) return null

  return (
    <div className={`rounded-2xl overflow-hidden relative ${className}`} style={{ height }}>
      {mapboxSrc ? (
        // Mapbox 정적 이미지 (가장 깔끔, retina, 빨간 핀)
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={mapboxSrc}
          alt={name ?? 'Map'}
          width="100%"
          height={height}
          style={{ width: '100%', height, objectFit: 'cover', display: 'block' }}
          loading="lazy"
        />
      ) : osmSrc ? (
        <iframe
          src={osmSrc}
          width="100%"
          height={height}
          style={{ border: 0 }}
          loading="lazy"
          title={name ?? 'Map'}
          sandbox="allow-scripts allow-same-origin"
        />
      ) : (
        /* 좌표 없을 때 플레이스홀더 */
        <div className="w-full h-full flex flex-col items-center justify-center gap-3"
          style={{ background: 'rgba(22,163,74,0.06)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: 16 }}>
          <div className="text-4xl">🗺️</div>
          <div className="text-center px-4">
            {name    && <p className="text-sm font-semibold text-white truncate">{name}</p>}
            {address && <p className="text-xs mt-0.5" style={{ color: '#9aae9a' }}>{address}</p>}
          </div>
        </div>
      )}

      {/* 외부 지도 앱 열기 버튼 */}
      {mapsUrl && (
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
          className="absolute bottom-2 right-2 flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-semibold transition"
          style={{ background: 'rgba(6,13,6,0.85)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e' }}>
          <ExternalLink size={11} />
          지도 열기
        </a>
      )}
    </div>
  )
}
