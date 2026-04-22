'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search, MapPin, X, Loader2 } from 'lucide-react'

interface Course {
  id: string
  name: string
  name_vn: string | null
  province: string
  holes: number
  par: number
  distance_km: number | null
  green_fee_weekday_vnd?: number | null
  green_fee_weekend_vnd?: number | null
  address?: string | null
  phone?: string | null
  website?: string | null
  designer?: string | null
  description?: string | null
}

interface Props {
  value: string
  onChange: (value: string) => void
  onSelect: (course: Course) => void
  placeholder?: string
  className?: string
  minChars?: number
}

export default function CourseSearchInput({ value, onChange, onSelect, placeholder = '골프장 검색...', className = '', minChars = 1 }: Props) {
  const [results, setResults] = useState<Course[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  // minChars 이상 입력 시 자동 검색
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (value.trim().length < minChars) {
      setResults([])
      setOpen(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      const supabase = createClient()
      const q = value.trim().toLowerCase()
      const { data } = await supabase
        .from('golf_courses')
        .select('id,name,name_vn,province,holes,par,distance_km,green_fee_weekday_vnd,green_fee_weekend_vnd,address,phone,website,designer,description')
        .eq('is_active', true)
        .or(`name.ilike.%${q}%,name_vn.ilike.%${q}%,province.ilike.%${q}%`)
        .order('distance_km', { nullsFirst: false })
        .limit(8)
      setResults(data ?? [])
      setOpen(true)
      setLoading(false)
    }, 250)
  }, [value, minChars])

  // 외부 클릭 시 닫기
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleSelect(course: Course) {
    onSelect(course)
    onChange(course.name)
    setOpen(false)
    setResults([])
  }

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#5a7a5a' }} />
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => value.length >= minChars && results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className="input-field pl-9 pr-9"
          autoComplete="off"
        />
        {loading
          ? <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin" style={{ color: '#22c55e' }} />
          : value && (
            <button type="button" onClick={() => { onChange(''); setOpen(false); setResults([]) }}
              className="absolute right-3 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-70" style={{ color: '#5a7a5a' }}>
              <X size={14} />
            </button>
          )
        }
      </div>

      {/* 드롭다운 */}
      {open && results.length > 0 && (
        <div className="course-dropdown animate-fade-in">
          {results.map(course => (
            <button key={course.id} type="button" onClick={() => handleSelect(course)}
              className="course-item w-full text-left">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(22,163,74,0.15)' }}>
                  <MapPin size={12} style={{ color: '#22c55e' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{course.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px]" style={{ color: '#5a7a5a' }}>{course.province}</span>
                    <span className="text-[10px]" style={{ color: '#22c55e' }}>{course.holes}H / Par {course.par}</span>
                    {course.distance_km && <span className="text-[10px]" style={{ color: '#3a5a3a' }}>{course.distance_km}km</span>}
                  </div>
                </div>
              </div>
            </button>
          ))}
          {/* 직접 입력 옵션 */}
          {value.trim() && (
            <button type="button"
              onClick={() => { onSelect({ id: '', name: value.trim(), name_vn: null, province: '', holes: 18, par: 72, distance_km: null }); setOpen(false) }}
              className="course-item w-full text-left">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(107,114,128,0.2)' }}>
                  <Search size={12} style={{ color: '#9ca3af' }} />
                </div>
                <p className="text-sm" style={{ color: '#9ca3af' }}>
                  "{value.trim()}" 직접 입력
                </p>
              </div>
            </button>
          )}
        </div>
      )}

      {/* 결과 없음 */}
      {open && !loading && results.length === 0 && value.trim().length >= minChars && (
        <div className="course-dropdown">
          <div className="px-4 py-3 text-center">
            <p className="text-sm" style={{ color: '#5a7a5a' }}>검색 결과가 없습니다</p>
            <button type="button"
              onClick={() => { onSelect({ id: '', name: value.trim(), name_vn: null, province: '', holes: 18, par: 72, distance_km: null }); setOpen(false) }}
              className="text-xs mt-1" style={{ color: '#22c55e' }}>
              "{value.trim()}" 직접 입력
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
