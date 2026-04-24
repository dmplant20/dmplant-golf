'use client'
import { useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { ChevronDown, Bell, Globe, Check } from 'lucide-react'

const ROLE_KO: Record<string, string> = {
  president: '회장', vice_president: '부회장', secretary: '총무',
  auditor: '감사', advisor: '고문', officer: '임원', member: '회원',
}
const ROLE_COLOR: Record<string, string> = {
  president: 'text-amber-400 bg-amber-900/40',
  vice_president: 'text-orange-400 bg-orange-900/40',
  secretary: 'text-blue-400 bg-blue-900/40',
  auditor: 'text-red-400 bg-red-900/40',
  advisor: 'text-teal-400 bg-teal-900/40',
  officer: 'text-purple-400 bg-purple-900/40',
  member: 'text-gray-400 bg-gray-800/60',
}

export default function AppHeader() {
  const { myClubs, currentClubId, setCurrentClub, lang, setLang } = useAuthStore()
  const [open, setOpen] = useState(false)
  const currentClub = myClubs.find(c => c.id === currentClubId)

  return (
    <header
      className="sticky top-0 z-50 safe-top"
      style={{
        background: 'linear-gradient(180deg, #0c1a0c 0%, rgba(7,15,7,0.97) 100%)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderBottom: '1px solid rgba(74,222,128,0.18)',
        boxShadow: '0 1px 0 rgba(74,222,128,0.06), 0 4px 24px rgba(0,0,0,0.4)',
      }}
    >
      <div className="flex items-center justify-between px-4 h-14">

        {/* ── 클럽 셀렉터 ───────────────────────────────────────── */}
        <div className="relative flex-1 min-w-0">
          <button onClick={() => setOpen(v => !v)} className="flex items-center gap-2.5 min-w-0 max-w-[260px]">
            {/* 로고 글로우 */}
            <div className="relative flex-shrink-0">
              <div
                className="absolute inset-0 rounded-full"
                style={{ background: 'rgba(74,222,128,0.3)', filter: 'blur(8px)', transform: 'scale(1.2)' }}
              />
              <div
                className="relative w-9 h-9 rounded-full flex items-center justify-center text-base font-bold"
                style={{
                  background: 'linear-gradient(135deg, #16a34a 0%, #14532d 100%)',
                  border: '1px solid rgba(74,222,128,0.35)',
                  boxShadow: '0 0 12px rgba(74,222,128,0.25)',
                }}
              >
                ⛳
              </div>
            </div>
            {/* 텍스트 */}
            <div className="text-left min-w-0">
              <p
                className="text-[9px] font-bold tracking-widest uppercase"
                style={{
                  background: 'linear-gradient(90deg, #4ade80, #22c55e)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  letterSpacing: '0.18em',
                }}
              >
                INTER STELLAR GOLF
              </p>
              <p className="text-[15px] font-bold leading-tight truncate" style={{ color: '#f0fdf4' }}>
                {currentClub ? (lang === 'ko' ? currentClub.name : (currentClub.name_en || currentClub.name)) : (lang === 'ko' ? '클럽 선택' : 'Select Club')}
              </p>
            </div>
            <ChevronDown
              size={15}
              className={`flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
              style={{ color: '#4ade80' }}
            />
          </button>

          {/* 드롭다운 */}
          {open && (
            <div
              className="absolute top-full left-0 mt-2 w-72 rounded-2xl overflow-hidden animate-fade-in"
              style={{
                background: 'linear-gradient(180deg, #111f11 0%, #0c1a0c 100%)',
                border: '1px solid rgba(74,222,128,0.25)',
                boxShadow: '0 24px 64px rgba(0,0,0,0.75), 0 0 0 1px rgba(74,222,128,0.06)',
                zIndex: 100,
              }}
            >
              <p
                className="px-4 pt-4 pb-1.5 text-[9px] font-bold tracking-widest uppercase"
                style={{ color: '#4ade80', letterSpacing: '0.14em' }}
              >
                {lang === 'ko' ? '내 클럽' : 'MY CLUBS'}
              </p>
              <div className="max-h-64 overflow-y-auto scroll-hide">
                {myClubs.map(club => {
                  const isActive = club.id === currentClubId
                  const rc = ROLE_COLOR[club.role] ?? ROLE_COLOR.member
                  return (
                    <button
                      key={club.id}
                      onClick={() => { setCurrentClub(club.id); setOpen(false) }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                      style={isActive
                        ? { background: 'rgba(74,222,128,0.12)' }
                        : undefined
                      }
                      onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(74,222,128,0.07)' }}
                      onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = '' }}
                    >
                      {/* 클럽 이니셜/아이콘 */}
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold"
                        style={{
                          background: isActive
                            ? 'linear-gradient(135deg, rgba(74,222,128,0.25), rgba(22,163,74,0.35))'
                            : 'linear-gradient(135deg, rgba(74,222,128,0.1), rgba(22,163,74,0.18))',
                          border: `1px solid rgba(74,222,128,${isActive ? '0.45' : '0.2'})`,
                          boxShadow: isActive ? '0 0 10px rgba(74,222,128,0.2)' : 'none',
                        }}
                      >
                        ⛳
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: '#f0fdf4' }}>
                          {lang === 'ko' ? club.name : (club.name_en || club.name)}
                        </p>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full mt-0.5 inline-block ${rc}`}>
                          {lang === 'ko' ? ROLE_KO[club.role] : club.role}
                        </span>
                      </div>
                      {isActive && <Check size={15} style={{ color: '#4ade80', flexShrink: 0 }} />}
                    </button>
                  )
                })}
              </div>
              <div style={{ borderTop: '1px solid rgba(74,222,128,0.12)' }} className="p-2">
                <button
                  onClick={() => { setOpen(false); window.location.href = '/club-register' }}
                  className="w-full text-center text-xs py-2.5 rounded-xl transition-colors font-semibold"
                  style={{ color: '#4ade80' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(74,222,128,0.1)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '' }}
                >
                  + {lang === 'ko' ? '새 클럽 등록' : 'Register New Club'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── 우측 아이콘 ───────────────────────────────────────── */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setLang(lang === 'ko' ? 'en' : 'ko')}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
            style={{ color: '#4ade80' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(74,222,128,0.1)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '' }}
          >
            <Globe size={18} />
          </button>
          {/* 벨 아이콘 — 알림 도트 포함 */}
          <button
            className="relative w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
            style={{ color: '#4ade80' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(74,222,128,0.1)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '' }}
          >
            <Bell size={18} />
            {/* notification dot */}
            <span
              className="absolute"
              style={{
                top: 7, right: 7,
                width: 7, height: 7,
                borderRadius: '50%',
                background: '#f59e0b',
                border: '1.5px solid #0c1a0c',
                boxShadow: '0 0 6px rgba(245,158,11,0.6)',
              }}
            />
          </button>
        </div>
      </div>

      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}
    </header>
  )
}
