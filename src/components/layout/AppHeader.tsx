'use client'
import { useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { ChevronDown, Bell, Globe, Check } from 'lucide-react'

const ROLE_KO: Record<string, string> = {
  president: '회장', vice_president: '부회장', secretary: '총무',
  auditor: '감사', advisor: '고문', officer: '임원', member: '회원',
}
const ROLE_COLOR: Record<string, string> = {
  president:      'text-amber-300 bg-amber-900/30',
  vice_president: 'text-orange-300 bg-orange-900/30',
  secretary:      'text-blue-300 bg-blue-900/30',
  auditor:        'text-red-300 bg-red-900/30',
  advisor:        'text-teal-300 bg-teal-900/30',
  officer:        'text-purple-300 bg-purple-900/30',
  member:         'text-gray-400 bg-white/5',
}

export default function AppHeader() {
  const { myClubs, currentClubId, setCurrentClub, lang, setLang } = useAuthStore()
  const [open, setOpen] = useState(false)
  const currentClub = myClubs.find(c => c.id === currentClubId)

  return (
    <header
      className="sticky top-0 z-50 safe-top"
      style={{
        background: 'var(--bg-2)',
        borderBottom: '1px solid var(--border)',
        boxShadow: '0 1px 0 rgba(0,0,0,0.4)',
      }}
    >
      <div className="flex items-center justify-between px-4 h-14">

        {/* ── 클럽 셀렉터 ───────────────────────────────────────── */}
        <div className="relative flex-1 min-w-0">
          <button onClick={() => setOpen(v => !v)} className="flex items-center gap-2.5 min-w-0 max-w-[270px]">
            {/* 로고 */}
            <div
              className="relative w-9 h-9 rounded-full flex items-center justify-center text-base font-bold flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, #c9a84c 0%, #6b4c1a 100%)',
                border: '1px solid rgba(201,168,76,0.4)',
                boxShadow: '0 0 10px rgba(201,168,76,0.15)',
              }}
            >
              ⛳
            </div>

            {/* 텍스트 */}
            <div className="text-left min-w-0">
              <p className="text-[9px] font-bold tracking-widest uppercase"
                style={{ color: 'var(--gold)', letterSpacing: '0.18em' }}>
                INTER STELLAR GOLF
              </p>
              <p className="text-[15px] font-bold leading-tight truncate" style={{ color: 'var(--text)' }}>
                {currentClub
                  ? (lang === 'ko' ? currentClub.name : (currentClub.name_en || currentClub.name))
                  : (lang === 'ko' ? '클럽 선택' : 'Select Club')}
              </p>
            </div>
            <ChevronDown
              size={15}
              className={`flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
              style={{ color: 'var(--gold)' }}
            />
          </button>

          {/* ── 드롭다운 ─────────────────────────────────────────── */}
          {open && (
            <div
              className="absolute top-full left-0 mt-2 w-72 rounded-2xl overflow-hidden animate-fade-in"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border-2)',
                boxShadow: '0 16px 48px rgba(0,0,0,0.85)',
                zIndex: 100,
              }}
            >
              <p className="px-4 pt-4 pb-1.5 section-title"
                style={{ color: 'var(--gold)', letterSpacing: '0.16em' }}>
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
                      style={isActive ? { background: 'rgba(201,168,76,0.10)' } : undefined}
                      onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-2)' }}
                      onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = '' }}
                    >
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold"
                        style={{
                          background: isActive
                            ? 'linear-gradient(135deg, rgba(201,168,76,0.25), rgba(160,120,48,0.35))'
                            : 'var(--surface-2)',
                          border: `1px solid ${isActive ? 'rgba(201,168,76,0.45)' : 'var(--border)'}`,
                        }}
                      >
                        ⛳
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>
                          {lang === 'ko' ? club.name : (club.name_en || club.name)}
                        </p>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full mt-0.5 inline-block ${rc}`}>
                          {lang === 'ko' ? ROLE_KO[club.role] : club.role}
                        </span>
                      </div>
                      {isActive && <Check size={15} style={{ color: 'var(--gold-l)', flexShrink: 0 }} />}
                    </button>
                  )
                })}
              </div>
              <div style={{ borderTop: '1px solid var(--border)' }} className="p-2">
                <button
                  onClick={() => { setOpen(false); window.location.href = '/club-register' }}
                  className="w-full text-center text-xs py-2.5 rounded-xl transition-colors font-semibold"
                  style={{ color: 'var(--gold-l)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(201,168,76,0.08)' }}
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
            style={{ color: 'var(--silver)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '' }}
          >
            <Globe size={18} />
          </button>
          <button
            className="relative w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
            style={{ color: 'var(--silver)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '' }}
          >
            <Bell size={18} />
            <span
              className="absolute"
              style={{
                top: 7, right: 7,
                width: 7, height: 7,
                borderRadius: '50%',
                background: '#f59e0b',
                border: '1.5px solid var(--bg-2)',
              }}
            />
          </button>
        </div>
      </div>

      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}
    </header>
  )
}
