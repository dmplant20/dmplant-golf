'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, MapPin, X, Loader2, Star } from 'lucide-react'

export interface PlaceResult {
  place_id: string
  name: string
  address: string
  lat: number | null
  lng: number | null
  rating: number | null
}

interface Props {
  value: string
  onChange: (value: string) => void
  onSelect: (place: PlaceResult) => void
  placeholder?: string
  className?: string
  near?: string        // 검색 근처 도시 (default: Ho Chi Minh City)
  useFixed?: boolean   // overflow:auto 컨테이너 안에서 사용 시 true
}

export default function PlaceSearchInput({
  value, onChange, onSelect,
  placeholder = '레스토랑 검색...', className = '',
  near = 'Ho Chi Minh City', useFixed = false,
}: Props) {
  const [results,   setResults]   = useState<PlaceResult[]>([])
  const [loading,   setLoading]   = useState(false)
  const [open,      setOpen]      = useState(false)
  const [dropStyle, setDropStyle] = useState<React.CSSProperties>({})
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapRef     = useRef<HTMLDivElement>(null)
  const inputRef    = useRef<HTMLInputElement>(null)

  const calcFixed = useCallback(() => {
    if (!useFixed || !inputRef.current) return
    const r = inputRef.current.getBoundingClientRect()
    setDropStyle({ position: 'fixed', top: r.bottom + 6, left: r.left, width: r.width, zIndex: 9999 })
  }, [useFixed])

  // 검색
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (value.trim().length < 1) { setResults([]); setOpen(false); return }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res  = await fetch(`/api/places/search?q=${encodeURIComponent(value.trim())}&near=${encodeURIComponent(near)}`)
        const data = await res.json()
        setResults(data.results ?? [])
        calcFixed()
        setOpen(true)
      } catch (e) {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 350)
  }, [value, near, calcFixed])

  // 외부 클릭 닫기
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  // 스크롤/리사이즈 재계산
  useEffect(() => {
    if (!open || !useFixed) return
    const onScroll = () => calcFixed()
    const onResize = () => calcFixed()
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
    }
  }, [open, useFixed, calcFixed])

  function handleSelect(place: PlaceResult) {
    onSelect(place); onChange(place.name); setOpen(false); setResults([])
  }

  const dropdownClass = useFixed ? '' : 'course-dropdown'
  const dropdownStyle: React.CSSProperties = useFixed
    ? {
        ...dropStyle,
        background: '#0c160c',
        border: '1px solid rgba(34,197,94,0.22)',
        borderRadius: 14,
        overflow: 'hidden',
        boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
        maxHeight: 260,
        overflowY: 'auto',
      }
    : {}

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#5a7a5a' }} />
        <input
          ref={inputRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => { if (value.length >= 1 && results.length > 0) { calcFixed(); setOpen(true) } }}
          placeholder={placeholder}
          className="input-field pl-9 pr-9"
          autoComplete="off"
        />
        {loading
          ? <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin" style={{ color: '#22c55e' }} />
          : value && (
            <button type="button" onClick={() => { onChange(''); setOpen(false); setResults([]) }}
              className="absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-70 transition-opacity" style={{ color: '#5a7a5a' }}>
              <X size={14} />
            </button>
          )
        }
      </div>

      {/* 결과 드롭다운 */}
      {open && results.length > 0 && (
        <div className={`${dropdownClass} animate-fade-in`} style={dropdownStyle}>
          {results.map(place => (
            <button key={place.place_id} type="button" onClick={() => handleSelect(place)}
              className="course-item w-full text-left">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(251,146,60,0.15)' }}>
                  <MapPin size={12} style={{ color: '#fb923c' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{place.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] truncate" style={{ color: '#5a7a5a' }}>{place.address}</span>
                    {place.rating && (
                      <span className="flex items-center gap-0.5 text-[10px] flex-shrink-0" style={{ color: '#fbbf24' }}>
                        <Star size={9} fill="#fbbf24" />{place.rating}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))}
          {/* 직접 입력 */}
          {value.trim() && (
            <button type="button"
              onClick={() => { onSelect({ place_id: '', name: value.trim(), address: '', lat: null, lng: null, rating: null }); setOpen(false) }}
              className="course-item w-full text-left">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(107,114,128,0.2)' }}>
                  <Search size={12} style={{ color: '#9ca3af' }} />
                </div>
                <p className="text-sm" style={{ color: '#9ca3af' }}>"{value.trim()}" 직접 입력</p>
              </div>
            </button>
          )}
        </div>
      )}

      {/* 결과 없음 */}
      {open && !loading && results.length === 0 && value.trim().length >= 1 && (
        <div className={dropdownClass} style={useFixed ? dropdownStyle : {}}>
          <div className="px-4 py-3 text-center">
            <p className="text-sm" style={{ color: '#5a7a5a' }}>검색 결과가 없습니다</p>
            <button type="button"
              onClick={() => { onSelect({ place_id: '', name: value.trim(), address: '', lat: null, lng: null, rating: null }); setOpen(false) }}
              className="text-xs mt-1" style={{ color: '#fb923c' }}>
              "{value.trim()}" 직접 입력
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
