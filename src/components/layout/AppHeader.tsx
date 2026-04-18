'use client'
import { useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { ChevronDown, Bell, Globe } from 'lucide-react'

export default function AppHeader() {
  const { myClubs, currentClubId, setCurrentClub, lang, setLang } = useAuthStore()
  const [open, setOpen] = useState(false)

  const currentClub = myClubs.find((c) => c.id === currentClubId)

  return (
    <header className="sticky top-0 z-50 bg-gray-950/95 backdrop-blur border-b border-green-900/40 safe-top">
      <div className="flex items-center justify-between px-4 py-3">
        {/* Club selector */}
        <div className="relative flex-1">
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-2 max-w-[220px]"
          >
            <div className="w-8 h-8 bg-green-800 rounded-full flex items-center justify-center text-sm flex-shrink-0">
              ⛳
            </div>
            <div className="text-left min-w-0">
              <p className="text-xs text-green-400 leading-none">Inter Stellar GOLF</p>
              <p className="text-sm font-semibold text-white truncate leading-tight">
                {currentClub ? (lang === 'ko' ? currentClub.name : (currentClub.name_en || currentClub.name)) : (lang === 'ko' ? '클럽 선택' : 'Select Club')}
              </p>
            </div>
            <ChevronDown size={16} className={`text-green-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown */}
          {open && myClubs.length > 0 && (
            <div className="absolute top-full left-0 mt-2 w-64 bg-gray-900 border border-green-900 rounded-2xl shadow-2xl overflow-hidden z-50">
              <p className="text-xs text-gray-500 px-4 pt-3 pb-1">{lang === 'ko' ? '내 클럽' : 'My Clubs'}</p>
              <div className="max-h-60 overflow-y-auto scroll-hide">
                {myClubs.map((club) => (
                  <button
                    key={club.id}
                    onClick={() => { setCurrentClub(club.id); setOpen(false) }}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-green-900/30 transition text-left ${club.id === currentClubId ? 'bg-green-900/20' : ''}`}
                  >
                    <div className="w-8 h-8 bg-green-800 rounded-full flex items-center justify-center text-sm flex-shrink-0">⛳</div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{lang === 'ko' ? club.name : (club.name_en || club.name)}</p>
                      <p className="text-xs text-green-400">{lang === 'ko' ? roleKo(club.role) : club.role}</p>
                    </div>
                    {club.id === currentClubId && <div className="w-2 h-2 bg-green-500 rounded-full ml-auto flex-shrink-0" />}
                  </button>
                ))}
              </div>
              <div className="border-t border-green-900/40 p-2">
                <button
                  onClick={() => { setOpen(false); window.location.href = '/club-register' }}
                  className="w-full text-center text-xs text-green-400 py-2 hover:text-green-300"
                >
                  + {lang === 'ko' ? '새 클럽 등록' : 'Register New Club'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right icons */}
        <div className="flex items-center gap-3">
          <button onClick={() => setLang(lang === 'ko' ? 'en' : 'ko')} className="text-gray-400 hover:text-green-400 transition">
            <Globe size={20} />
          </button>
          <button className="relative text-gray-400 hover:text-green-400 transition">
            <Bell size={20} />
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full text-[10px] flex items-center justify-center text-white">3</span>
          </button>
        </div>
      </div>

      {/* Backdrop */}
      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}
    </header>
  )
}

function roleKo(role: string) {
  const map: Record<string, string> = { president: '회장', secretary: '총무', officer: '운영진', member: '회원' }
  return map[role] ?? role
}
