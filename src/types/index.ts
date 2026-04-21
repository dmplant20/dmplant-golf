export type Currency = 'KRW' | 'VND' | 'IDR'

export type UserRole = 'president' | 'vice_president' | 'secretary' | 'auditor' | 'advisor' | 'officer' | 'member'

export type MembershipStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn'

export type FeeType = 'annual' | 'monthly'

export type TransactionType = 'fee' | 'expense' | 'fine' | 'donation' | 'other'

export interface User {
  id: string
  email: string
  full_name: string
  full_name_en?: string
  name_abbr?: string
  phone?: string
  avatar_url?: string
  created_at: string
}

export interface Club {
  id: string
  name: string
  name_en?: string
  description?: string
  logo_url?: string
  currency: Currency
  annual_fee?: number
  monthly_fee?: number
  fee_type: FeeType
  max_members: number
  created_at: string
  created_by: string
}

export interface ClubMembership {
  id: string
  club_id: string
  user_id: string
  role: UserRole
  status: MembershipStatus
  club_handicap?: number
  personal_handicap?: number
  joined_at?: string
  created_at: string
  club?: Club
  user?: User
}

export interface Tournament {
  id: string
  club_id: string
  name: string
  name_en?: string
  date: string
  venue?: string
  is_official: boolean
  grouping_method: 'auto_handicap' | 'auto_random' | 'manual'
  status: 'upcoming' | 'ongoing' | 'completed'
  created_at: string
}

export interface TournamentGroup {
  id: string
  tournament_id: string
  group_number: number
  tee_time?: string
  members: TournamentGroupMember[]
}

export interface TournamentGroupMember {
  id: string
  group_id: string
  user_id: string
  is_attending: boolean
  score?: number
  handicap_used?: number
  net_score?: number
  user?: User
}

export interface FinanceTransaction {
  id: string
  club_id: string
  type: TransactionType
  amount: number
  currency: Currency
  description: string
  member_id?: string
  receipt_url?: string
  recorded_by: string
  transaction_date: string
  created_at: string
  member?: User
}

export interface PenaltyRule {
  id: string
  club_id: string
  name: string
  name_en?: string
  amount_per_stroke: number
  max_amount?: number
  currency: Currency
  description?: string
}

export interface ChatRoom {
  id: string
  club_id: string
  name: string
  name_en?: string
  type: 'club_wide' | 'group' | 'tournament_group'
  tournament_group_id?: string
  created_at: string
}

export interface ChatMessage {
  id: string
  room_id: string
  user_id: string
  content: string
  created_at: string
  user?: User
}

export interface Announcement {
  id: string
  club_id: string
  title: string
  title_en?: string
  content: string
  content_en?: string
  author_id: string
  created_at: string
  author?: User
}

export interface Event {
  id: string
  club_id: string
  type: 'meeting' | 'celebration' | 'condolence' | 'other'
  title: string
  title_en?: string
  description?: string
  event_date: string
  created_at: string
}

export interface Album {
  id: string
  club_id: string
  tournament_id?: string
  title: string
  cover_url?: string
  photos: AlbumPhoto[]
  created_at: string
}

export interface AlbumPhoto {
  id: string
  album_id: string
  url: string
  caption?: string
  uploaded_by: string
  created_at: string
}

export interface MonthlyRanking {
  id: string
  club_id: string
  user_id: string
  year: number
  month: number
  avg_score?: number
  tournaments_played: number
  rank?: number
  user?: User
}
