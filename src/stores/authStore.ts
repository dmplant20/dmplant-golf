import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types'

interface Club {
  id: string
  name: string
  name_en?: string
  role: string
  logo_url?: string
}

interface AuthStore {
  user: User | null
  currentClubId: string | null
  myClubs: Club[]
  lang: 'ko' | 'en'
  setUser: (user: User | null) => void
  setCurrentClub: (clubId: string) => void
  setMyClubs: (clubs: Club[]) => void
  setLang: (lang: 'ko' | 'en') => void
  clear: () => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      currentClubId: null,
      myClubs: [],
      lang: 'ko',
      setUser: (user) => set({ user }),
      setCurrentClub: (clubId) => set({ currentClubId: clubId }),
      setMyClubs: (clubs) => set({ myClubs: clubs }),
      setLang: (lang) => set({ lang }),
      clear: () => set({ user: null, currentClubId: null, myClubs: [] }),
    }),
    { name: 'isgolf-auth' }
  )
)
