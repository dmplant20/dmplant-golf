'use client'
import { ExternalLink } from 'lucide-react'

interface Props {
  name?: string
  address?: string
  lat?: number | null
  lng?: number | null
  placeId?: string
  height?: number
  className?: string
}

export default function MapEmbed({ name, address, lat, lng, placeId, height = 200, className = '' }: Props) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  // Google Maps로 여는 URL (항상 사용 가능)
  function getMapsUrl() {
    if (lat && lng) return `https://www.google.com/maps?q=${lat},${lng}`
    if (placeId)    return `https://www.google.com/maps/place/?q=place_id:${placeId}`
    const q = address || name
    if (q) return `https://www.google.com/maps/search/${encodeURIComponent(q)}`
    return null
  }

  // Google Maps Embed iframe src
  function getEmbedSrc() {
    if (!apiKey || apiKey === 'YOUR_GOOGLE_MAPS_API_KEY_HERE') return null
    const base = 'https://www.google.com/maps/embed/v1'
    if (placeId) return `${base}/place?key=${apiKey}&q=place_id:${placeId}&language=ko&zoom=16`
    if (lat && lng) return `${base}/view?key=${apiKey}&center=${lat},${lng}&zoom=16&maptype=roadmap`
    const q = address || name
    if (q) return `${base}/place?key=${apiKey}&q=${encodeURIComponent(q)}&language=ko&zoom=16`
    return null
  }

  const embedSrc  = getEmbedSrc()
  const mapsUrl   = getMapsUrl()

  if (!embedSrc && !mapsUrl) return null

  return (
    <div className={`rounded-2xl overflow-hidden relative ${className}`} style={{ height }}>
      {embedSrc ? (
        <iframe
          src={embedSrc}
          width="100%"
          height={height}
          style={{ border: 0 }}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title={name ?? 'Map'}
        />
      ) : (
        /* API 키 없을 때 — 지도 플레이스홀더 + 링크 버튼 */
        <div className="w-full h-full flex flex-col items-center justify-center gap-3"
          style={{ background: 'rgba(22,163,74,0.06)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: 16 }}>
          <div className="text-4xl">🗺️</div>
          <div className="text-center px-4">
            {name && <p className="text-sm font-semibold text-white truncate">{name}</p>}
            {address && <p className="text-xs mt-0.5" style={{ color: '#5a7a5a' }}>{address}</p>}
          </div>
        </div>
      )}

      {/* Google Maps 열기 버튼 — 항상 표시 */}
      {mapsUrl && (
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
          className="absolute bottom-2 right-2 flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-semibold transition"
          style={{ background: 'rgba(6,13,6,0.85)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e' }}>
          <ExternalLink size={11} />
          Google Maps
        </a>
      )}
    </div>
  )
}
