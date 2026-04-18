'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { Trophy, Wallet, Users, Bell, Calendar, TrendingUp } from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
  const { currentClubId, user, lang } = useAuthStore()
  const ko = lang === 'ko'
  const [stats, setStats] = useState({ members: 0, balance: 0, upcoming: 0 })
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [currency, setCurrency] = useState('KRW')

  useEffect(() => {
    if (!currentClubId) return
    const supabase = createClient()

    async function load() {
      const [{ count: members }, { data: club }, { data: notices }, { data: tournaments }] = await Promise.all([
        supabase.from('club_memberships').select('*', { count: 'exact', head: true }).eq('club_id', currentClubId).eq('status', 'approved'),
        supabase.from('clubs').select('currency').eq('id', currentClubId).single(),
        supabase.from('announcements').select('id,title,title_en,created_at').eq('club_id', currentClubId).order('created_at', { ascending: false }).limit(3),
        supabase.from('tournaments').select('id').eq('club_id', currentClubId).eq('status', 'upcoming'),
      ])

      const { data: txns } = await supabase
        .from('finance_transactions')
        .select('type,amount')
        .eq('club_id', currentClubId)

      let balance = 0
      txns?.forEach((t: any) => {
        if (['fee', 'donation'].includes(t.type)) balance += t.amount
        else if (t.type === 'expense') balance -= t.amount
        else if (t.type === 'fine') balance += t.amount
      })

      setStats({ members: members ?? 0, balance, upcoming: tournaments?.length ?? 0 })
      setAnnouncements(notices ?? [])
      if (club?.currency) setCurrency(club.currency)
    }
    load()
  }, [currentClubId])

  const currencySymbol = { KRW: '₩', VND: '₫', IDR: 'Rp' }[currency] ?? '₩'

  const quickLinks = [
    { href: '/members', icon: Users, label: ko ? '회원 관리' : 'Members', sub: `${stats.members}${ko ? '명' : ' members'}`, color: 'text-blue-400' },
    { href: '/finance', icon: Wallet, label: ko ? '재무 현황' : 'Finance', sub: `${currencySymbol}${stats.balance.toLocaleString()}`, color: 'text-yellow-400' },
    { href: '/tournament', icon: Trophy, label: ko ? '대회' : 'Tournament', sub: `${stats.upcoming}${ko ? '개 예정' : ' upcoming'}`, color: 'text-green-400' },
    { href: '/announcement', icon: Bell, label: ko ? '공지사항' : 'Notice', sub: ko ? '확인하기' : 'View all', color: 'text-purple-400' },
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

      {/* Quick stats */}
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
            <div key={a.id} className="glass-card rounded-xl px-4 py-3 flex items-center gap-3">
              <Bell size={16} className="text-green-400 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm text-white truncate">{lang === 'ko' ? a.title : (a.title_en || a.title)}</p>
                <p className="text-xs text-gray-500">{new Date(a.created_at).toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-US')}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Upcoming tournaments */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-white">{ko ? '예정 대회' : 'Upcoming'}</h3>
          <Link href="/tournament" className="text-xs text-green-400">{ko ? '전체보기' : 'View all'}</Link>
        </div>
        {stats.upcoming === 0 ? (
          <p className="text-gray-600 text-sm text-center py-4">{ko ? '예정된 대회가 없습니다' : 'No upcoming tournaments'}</p>
        ) : (
          <Link href="/tournament" className="glass-card rounded-xl px-4 py-3 flex items-center gap-3 block">
            <Trophy size={16} className="text-green-400 flex-shrink-0" />
            <p className="text-sm text-white">{stats.upcoming}{ko ? '개의 대회가 예정되어 있습니다' : ' tournaments scheduled'}</p>
          </Link>
        )}
      </div>
    </div>
  )
}
