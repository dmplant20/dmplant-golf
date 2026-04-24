'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search, MapPin, X, Loader2 } from 'lucide-react'

// ── 기본 내장 골프장 (DB 없이도 즉시 검색, scorecard BUILTIN_COURSES와 동기화) ──
// sub_courses: 실제 코스 이름 (인터넷 조사 기반, 27H=9H×3, 36H=18H×2 또는 9H×4)
const BUILTIN_COURSES = [
  // ── 호치민시 ────────────────────────────────────────────────────────────
  // Tan Son Nhat: 4×9H (A,B,C,D) — Nelson & Haworth 설계
  { id: '_tsn',  name: 'Tan Son Nhat Golf Course',         name_vn: 'Sân Golf Tân Sơn Nhất',               province: 'Ho Chi Minh City', holes: 36, par: 144, distance_km: 6,   sub_courses: 'A코스,B코스,C코스,D코스',         green_fee_weekday_vnd: null, green_fee_weekend_vnd: null, address: null, phone: null, website: null, description: null },
  { id: '_ssg',  name: 'Saigon South Golf Club',           name_vn: 'Sân Golf Nam Sài Gòn',                province: 'Ho Chi Minh City', holes: 9,  par: 36,  distance_km: 8,   sub_courses: null,                               green_fee_weekday_vnd: null, green_fee_weekend_vnd: null, address: null, phone: null, website: null, description: null },
  // VGCC: 2×18H — West Course(Chen King Shih,1994) + East Course(Lee Trevino,1997)
  { id: '_vgcc', name: 'Vietnam Golf & Country Club',      name_vn: 'Sân Golf & Country Club Việt Nam',    province: 'Ho Chi Minh City', holes: 36, par: 144, distance_km: 20,  sub_courses: 'West Course,East Course',         green_fee_weekday_vnd: null, green_fee_weekend_vnd: null, address: null, phone: null, website: null, description: null },
  // Vinpearl Léman: 2×18H — North + South (Golf Plan 설계, 2025 오픈)
  { id: '_vpl',  name: 'Vinpearl Golf Léman Cu Chi',       name_vn: 'Sân Golf Vinpearl Golf Léman Củ Chi', province: 'Ho Chi Minh City', holes: 36, par: 144, distance_km: 35,  sub_courses: 'North Course,South Course',       green_fee_weekday_vnd: null, green_fee_weekend_vnd: null, address: null, phone: null, website: null, description: null },
  // ── 빈증성 ──────────────────────────────────────────────────────────────
  // Song Be: 3×9H — Lotus + Palm(원래 18H) + Desert(2007 추가)
  { id: '_sbg',  name: 'Song Be Golf Resort',              name_vn: 'Sân Golf Song Bé',                    province: 'Binh Duong',       holes: 27, par: 108, distance_km: 15,  sub_courses: 'Lotus,Palm,Desert',               green_fee_weekday_vnd: null, green_fee_weekend_vnd: null, address: null, phone: null, website: null, description: null },
  // Twin Doves: 3×9H — Luna + Stella + Sole (구 Mare → Stella로 개명)
  { id: '_tdg',  name: 'Twin Doves Golf Club',             name_vn: 'Sân Golf Twin Doves',                 province: 'Binh Duong',       holes: 27, par: 108, distance_km: 35,  sub_courses: 'Luna,Stella,Sole',                green_fee_weekday_vnd: null, green_fee_weekend_vnd: null, address: null, phone: null, website: null, description: null },
  { id: '_hmg',  name: 'Harmonie Golf Park',               name_vn: 'Sân Golf Harmonie',                   province: 'Binh Duong',       holes: 18, par: 72,  distance_km: 35,  sub_courses: null,                               green_fee_weekday_vnd: null, green_fee_weekend_vnd: null, address: null, phone: null, website: null, description: null },
  // ── 동나이성 ────────────────────────────────────────────────────────────
  // Long Thanh: 2×18H — Hill Course + Lake Course (David Dale & Ron Fream, 2003)
  { id: '_ltg',  name: 'Long Thanh Golf Club',             name_vn: 'Sân Golf Long Thành',                 province: 'Dong Nai',         holes: 36, par: 144, distance_km: 36,  sub_courses: 'Hill Course,Lake Course',         green_fee_weekday_vnd: null, green_fee_weekend_vnd: null, address: null, phone: null, website: null, description: null },
  // Dong Nai (Bo Chang): 3×9H — 공식 이름 없음, A/B/C로만 구분
  { id: '_dng',  name: 'Dong Nai Golf Resort',             name_vn: 'Sân Golf Đồng Nai (Bò Chang)',        province: 'Dong Nai',         holes: 27, par: 108, distance_km: 50,  sub_courses: 'A코스,B코스,C코스',               green_fee_weekday_vnd: null, green_fee_weekend_vnd: null, address: null, phone: null, website: null, description: null },
  { id: '_ecc',  name: 'Emerald Country Club',             name_vn: 'Sân Golf Emerald Country Club',       province: 'Dong Nai',         holes: 18, par: 72,  distance_km: 40,  sub_courses: null,                               green_fee_weekday_vnd: null, green_fee_weekend_vnd: null, address: null, phone: null, website: null, description: null },
  // ── 롱안성 ──────────────────────────────────────────────────────────────
  // Royal Long An: 3×9H — Desert + Forest + Lake (Nick Faldo 설계, Lake코스 2025 소프트오픈)
  { id: '_rla',  name: 'Royal Long An Golf & Country Club',name_vn: 'Sân Golf Royal Long An',              province: 'Long An',          holes: 27, par: 108, distance_km: 50,  sub_courses: 'Desert,Forest,Lake',              green_fee_weekday_vnd: null, green_fee_weekend_vnd: null, address: null, phone: null, website: null, description: null },
  { id: '_wlg',  name: 'West Lakes Golf & Villas',         name_vn: 'Sân Golf West Lakes',                 province: 'Long An',          holes: 18, par: 72,  distance_km: 52,  sub_courses: null,                               green_fee_weekday_vnd: null, green_fee_weekend_vnd: null, address: null, phone: null, website: null, description: null },
  // ── 바리아붕따우성 ───────────────────────────────────────────────────────
  // Vung Tau Paradise: 3×9H — 공식 이름 없음, A/B/C로만 구분
  { id: '_vtg',  name: 'Vung Tau Paradise Golf Resort',    name_vn: 'Sân Golf Vũng Tàu Paradise',          province: 'Ba Ria-Vung Tau',  holes: 27, par: 108, distance_km: 125, sub_courses: 'A코스,B코스,C코스',               green_fee_weekday_vnd: null, green_fee_weekend_vnd: null, address: null, phone: null, website: null, description: null },
  // Sonadezi Chau Duc: 2×18H — Resort Course + Tournament Course (Greg Norman 설계)
  { id: '_scg',  name: 'Sonadezi Chau Duc Golf Course',   name_vn: 'Sân Golf Sonadezi Châu Đức',          province: 'Ba Ria-Vung Tau',  holes: 36, par: 144, distance_km: 90,  sub_courses: 'Resort Course,Tournament Course', green_fee_weekday_vnd: null, green_fee_weekend_vnd: null, address: null, phone: null, website: null, description: null },
  { id: '_blf',  name: 'The Bluffs Grand Ho Tram Strip',  name_vn: 'Sân Golf The Bluffs Hồ Tràm',         province: 'Ba Ria-Vung Tau',  holes: 18, par: 71,  distance_km: 130, sub_courses: null,                               green_fee_weekday_vnd: null, green_fee_weekend_vnd: null, address: null, phone: null, website: null, description: null },
  // ── 빈투언성 ────────────────────────────────────────────────────────────
  // PGA NovaWorld: 2×18H — Ocean Course + Garden Course (Greg Norman 설계)
  { id: '_pga',  name: 'PGA NovaWorld Phan Thiet',        name_vn: 'Sân Golf PGA NovaWorld Phan Thiết',   province: 'Binh Thuan',       holes: 36, par: 144, distance_km: 200, sub_courses: 'Ocean Course,Garden Course',      green_fee_weekday_vnd: null, green_fee_weekend_vnd: null, address: null, phone: null, website: null, description: null },
]

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
  sub_courses?: string | null
  description?: string | null
}

interface Props {
  value: string
  onChange: (value: string) => void
  onSelect: (course: Course) => void
  placeholder?: string
  className?: string
  minChars?: number
  /** overflow:auto 컨테이너 안에 있을 때 true — position:fixed 드롭다운 사용 */
  useFixed?: boolean
}

export default function CourseSearchInput({
  value, onChange, onSelect,
  placeholder = '골프장 검색...', className = '',
  minChars = 1, useFixed = false,
}: Props) {
  const [results,    setResults]    = useState<Course[]>([])
  const [loading,    setLoading]    = useState(false)
  const [open,       setOpen]       = useState(false)
  const [dropStyle,  setDropStyle]  = useState<React.CSSProperties>({})
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapRef      = useRef<HTMLDivElement>(null)
  const inputRef     = useRef<HTMLInputElement>(null)

  // fixed 위치 계산
  const calcFixed = useCallback(() => {
    if (!useFixed || !inputRef.current) return
    const r = inputRef.current.getBoundingClientRect()
    setDropStyle({
      position: 'fixed',
      top:   r.bottom + 6,
      left:  r.left,
      width: r.width,
      zIndex: 9999,
    })
  }, [useFixed])

  // 검색
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (value.trim().length < minChars) { setResults([]); setOpen(false); return }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      const supabase = createClient()
      const q = value.trim().toLowerCase()
      const { data } = await supabase
        .from('golf_courses')
        .select('id,name,name_vn,province,holes,par,distance_km,green_fee_weekday_vnd,green_fee_weekend_vnd,address,phone,website,sub_courses,description')
        .eq('is_active', true)
        .or(`name.ilike.%${q}%,name_vn.ilike.%${q}%,province.ilike.%${q}%`)
        .order('distance_km', { nullsFirst: false })
        .limit(8)

      // DB가 비어있으면 내장 골프장으로 폴백
      let found: Course[] = data ?? []
      if (found.length === 0) {
        found = BUILTIN_COURSES.filter(c =>
          c.name.toLowerCase().includes(q) ||
          (c.name_vn ?? '').toLowerCase().includes(q) ||
          c.province.toLowerCase().includes(q)
        ).slice(0, 8) as Course[]
      }

      setResults(found)
      calcFixed()
      setOpen(true)
      setLoading(false)
    }, 250)
  }, [value, minChars, calcFixed])

  // 외부 클릭 → 닫기
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  // 스크롤/리사이즈 시 fixed 위치 재계산 또는 닫기
  useEffect(() => {
    if (!open || !useFixed) return
    function onScroll() { calcFixed() }
    function onResize() { calcFixed() }
    window.addEventListener('scroll', onScroll, true)   // capture: 모달 내 스크롤도 잡음
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
    }
  }, [open, useFixed, calcFixed])

  function handleSelect(course: Course) {
    onSelect(course); onChange(course.name); setOpen(false); setResults([])
  }

  // 드롭다운 스타일: fixed 모드면 계산된 inline style, 아니면 css class
  const dropdownClass = useFixed ? '' : 'course-dropdown'
  const dropdownStyle: React.CSSProperties = useFixed
    ? {
        ...dropStyle,
        background: '#0c160c',
        border: '1px solid rgba(34,197,94,0.22)',
        borderRadius: 14,
        overflow: 'hidden',
        boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
        maxHeight: 240,
        overflowY: 'auto',
      }
    : {}

  const emptyDropStyle: React.CSSProperties = useFixed
    ? { ...dropdownStyle }
    : {}

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#5a7a5a' }} />
        <input
          ref={inputRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => {
            if (value.length >= minChars && results.length > 0) { calcFixed(); setOpen(true) }
          }}
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
          {/* 직접 입력 */}
          {value.trim() && (
            <button type="button"
              onClick={() => { onSelect({ id: '', name: value.trim(), name_vn: null, province: '', holes: 18, par: 72, distance_km: null }); setOpen(false) }}
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
      {open && !loading && results.length === 0 && value.trim().length >= minChars && (
        <div className={dropdownClass} style={emptyDropStyle}>
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
