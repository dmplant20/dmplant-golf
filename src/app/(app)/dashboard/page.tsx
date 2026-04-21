'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { CalendarDays, Wallet, Users, Bell } from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
  const { currentClubId, user, lang } = useAuthStore()
  const ko = lang === 'ko'
  const [stats, setStats] = useState({ members: 0, balance: 0, nextMeeting: '' })
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [currency, setCurrency] = useState('KRW')

  useEffect(() => {
    if (!currentClubId) return
    const supabase = createClient()

    async function load() {
      const [{ count: members }, { data: club }, { data: notices }, { data: txns }, { data: pattern }] = await Promise.all([
        supabase.from('club_memberships').select('*', { count: 'exact', head: true }).eq('club_id', currentClubId).eq('status', 'approved'),
        supabase.from('clubs').select('currency').eq('id', currentClubId).single(),
        supabase.from('announcements').select('id,title,title_en,created_at').eq('club_id', currentClubId).order('created_at', { ascending: false }).limit(3),
        supabase.from('finance_transactions').select('type,amount').eq('club_id', currentClubId),
        supabase.from('recurring_meetings').select('week_of_month,day_of_week,start_time').eq('club_id', currentClubId).maybeSingle(),
      ])

      let balance = 0
      txns?.forEach((t: any) => {
        if (['fee', 'donation', 'fine', 'other'].includes(t.type)) balance += t.amount
        else if (t.type === 'expense') balance -= t.amount
      })

      // 다음 모임 날짜 계산
      let nextMeeting = ''
      if (pattern) {
        const now = new Date()
        for (let i = 0; i < 4; i++) {
          const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
          const year = d.getFullYear(), month = d.getMonth() + 1
          const first = new Date(year, month - 1, 1)
          let diff = pattern.day_of_week - first.getDay()
          if (diff < 0) diff += 7
          const day = 1 + diff + (pattern.week_of_month - 1) * 7
          if (day > new Date(year, month, 0).getDate()) continue
          const date = new Date(year, month - 1, day)
          const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() - 1)
          if (date > tomorrow) {
            nextMeeting = date.toLocaleDateString(ko ? 'ko-KR' : 'en-US', { month: 'short', day: 'numeric', weekday: 'short' })
            break
          }
        }
      }

      setStats({ members: members ?? 0, balance, nextMeeting })
      setAnnouncements(notices ?? [])
      if (club?.currency) setCurrency(club.currency)
    }
    load()
  }, [currentClubId])

  const sym = { KRW: '₩', VND: '₫', IDR: 'Rp' }[currency] ?? '₩'

  const quickLinks = [
    { href: '/members',  icon: Users,        label: ko ? '회원 관리'  : 'Members',  sub: `${stats.members}${ko ? '명' : ' members'}`,                           color: 'text-blue-400' },
    { href: '/finance',  icon: Wallet,       label: ko ? '재무 현황'  : 'Finance',  sub: `${sym}${stats.balance.toLocaleString()}`,                             color: 'text-yellow-400' },
    { href: '/meetings', icon: CalendarDays, label: ko ? '정기모임'   : 'Meetings', sub: stats.nextMeeting || (ko ? '패턴 미설정' : 'Not set'),                color: 'text-green-400' },
    { href: '/announcement', icon: Bell,     label: ko ? '공지사항'   : 'Notices',  sub: ko ? '확인하기' : 'View all',                                         color: 'text-purple-400' },
  ]

  return (
    <div className="px-4 py-5 space-y-6">
      {/* Welcome */}
      <div className="glass-card rounded-2xl p-4">
        <p className="text-gray-400 text-sm">{ko ? '안녕하세요 👋' : 'Welcome back 👋'}</p>
        <h2 className="text-xl font-bold text-white mt-0.5">{user?.full_name ?? 'Golfer'}</h2>
        <div className="flex items-center gap-2 mt-3">
          <span className="text-xs bg-green-900/60 text-green-300 px-2 py-0.5 rounded-full">⛳ Inter Stellar GOLF</span>
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3">
        {quickLinks.map(({ href, icon: Icon, label, sub, color }) => (
          <Link key={href} href={href} className="glass-card rounded-2xl p-4 flex flex-col gap-2 active:scale-95 transition-transform">
            <Icon size={24} className={color} />
            <div>
              <p className="text-white font-semibold text-sm">{label}</p>
              <p className="text-gray-400 text-xs">{sub}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Announcements */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-white">{ko ? '최근 공지사항' : 'Recent Notices'}</h3>
          <Link href="/announcement" className="text-xs text-green-400">{ko ? '전체보기' : 'View all'}</Link>
        </div>
        <div className="space-y-2">
          {announcements.length === 0 && (
            <p className="text-gray-600 text-sm text-center py-4">{ko ? '공지사항이 없습니다' : 'No announcements'}</p>
          )}
          {announcements.map((a) => (
            <Link key={a.id} href="/announcement" className="glass-card rounded-xl px-4 py-3 flex items-center gap-3 block">
              <Bell size={16} className="text-green-400 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm text-white truncate">{lang === 'ko' ? a.title : (a.title_en || a.title)}</p>
                <p className="text-xs text-gray-500">{new Date(a.created_at).toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-US')}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
