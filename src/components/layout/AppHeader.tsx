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
    <header className="sticky top-0 z-50 safe-top" style={{ background: 'rgba(6,13,6,0.96)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(34,197,94,0.12)' }}>
      <div className="flex items-center justify-between px-4 h-14">

        {/* ── 클럽 셀렉터 ───────────────────────────────────────── */}
        <div className="relative flex-1 min-w-0">
          <button onClick={() => setOpen(v => !v)} className="flex items-center gap-2.5 min-w-0 max-w-[240px]">
            {/* 로고 글로우 */}
            <div className="relative flex-shrink-0">
              <div className="absolute inset-0 rounded-full blur-md" style={{ background: 'rgba(22,163,74,0.35)' }} />
              <div className="relative w-8 h-8 rounded-full flex items-center justify-center text-base" style={{ background: 'linear-gradient(135deg,#16a34a,#14532d)' }}>
                ⛳
              </div>
            </div>
            {/* 텍스트 */}
            <div className="text-left min-w-0">
              <p className="text-[10px] font-semibold tracking-widest" style={{ color: '#22c55e' }}>INTER STELLAR GOLF</p>
              <p className="text-sm font-bold text-white truncate leading-tight">
                {currentClub ? (lang === 'ko' ? currentClub.name : (currentClub.name_en || currentClub.name)) : (lang === 'ko' ? '클럽 선택' : 'Select Club')}
              </p>
            </div>
            <ChevronDown size={14} className={`flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} style={{ color: '#22c55e' }} />
          </button>

          {/* 드롭다운 */}
          {open && (
            <div className="absolute top-full left-0 mt-2 w-72 rounded-2xl overflow-hidden animate-fade-in"
              style={{ background: '#0c160c', border: '1px solid rgba(34,197,94,0.2)', boxShadow: '0 20px 60px rgba(0,0,0,0.7)', zIndex: 100 }}>
              <p className="px-4 pt-3.5 pb-1.5 text-[10px] font-semibold tracking-widest" style={{ color: '#5a7a5a' }}>
                {lang === 'ko' ? '내 클럽' : 'MY CLUBS'}
              </p>
              <div className="max-h-64 overflow-y-auto scroll-hide">
                {myClubs.map(club => {
                  const isActive = club.id === currentClubId
                  const rc = ROLE_COLOR[club.role] ?? ROLE_COLOR.member
                  return (
                    <button key={club.id}
                      onClick={() => { setCurrentClub(club.id); setOpen(false) }}
                      className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left ${isActive ? 'bg-green-900/20' : 'hover:bg-green-900/10'}`}>
                      <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm"
                        style={{ background: 'linear-gradient(135deg,#16a34a22,#16a34a44)', border: '1px solid rgba(34,197,94,0.25)' }}>
                        ⛳
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">
                          {lang === 'ko' ? club.name : (club.name_en || club.name)}
                        </p>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full mt-0.5 inline-block ${rc}`}>
                          {lang === 'ko' ? ROLE_KO[club.role] : club.role}
                        </span>
                      </div>
                      {isActive && <Check size={15} className="text-green-400 flex-shrink-0" />}
                    </button>
                  )
                })}
              </div>
              <div style={{ borderTop: '1px solid rgba(34,197,94,0.1)' }} className="p-2">
                <button onClick={() => { setOpen(false); window.location.href = '/club-register' }}
                  className="w-full text-center text-xs py-2 rounded-xl transition-colors hover:bg-green-900/20" style={{ color: '#22c55e' }}>
                  + {lang === 'ko' ? '새 클럽 등록' : 'Register New Club'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── 우측 아이콘 ───────────────────────────────────────── */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => setLang(lang === 'ko' ? 'en' : 'ko')}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors hover:bg-green-900/20" style={{ color: '#5a7a5a' }}>
            <Globe size={18} />
          </button>
          <button className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors hover:bg-green-900/20" style={{ color: '#5a7a5a' }}>
            <Bell size={18} />
          </button>
        </div>
      </div>

      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}
    </header>
  )
}
