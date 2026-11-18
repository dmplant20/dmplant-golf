// 그룹 채팅방 생성 — 같은 클럽 멤버들 중 N명 선택
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

async function makeAnon() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  )
}

function makeService() {
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!k) return null
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, k)
}

export async function POST(req: NextRequest) {
  const anon = await makeAnon()
  const { data: { user } } = await anon.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, club_id, member_ids } = await req.json() as { name: string; club_id: string; member_ids: string[] }
  if (!name?.trim() || !club_id || !Array.isArray(member_ids)) {
    return NextResponse.json({ error: 'name, club_id, member_ids required' }, { status: 400 })
  }

  // 본인 자동 포함 + 중복 제거
  const allMemberIds = Array.from(new Set([user.id, ...member_ids.filter(Boolean)]))
  if (allMemberIds.length < 2) {
    return NextResponse.json({ error: 'at least 2 members required' }, { status: 400 })
  }

  // 모든 멤버가 같은 클럽 승인 회원인지 확인
  const { data: validMembers } = await anon.from('club_memberships')
    .select('user_id').eq('club_id', club_id).eq('status', 'approved')
    .in('user_id', allMemberIds)
  if (!validMembers || validMembers.length !== allMemberIds.length) {
    return NextResponse.json({ error: 'all members must be approved in the club' }, { status: 403 })
  }

  const service = makeService()
  if (!service) return NextResponse.json({ error: 'service role not configured' }, { status: 500 })

  // 룸 생성
  const { data: room, error: roomErr } = await service.from('chat_rooms').insert({
    club_id,
    name: name.trim().slice(0, 60),
    name_en: name.trim().slice(0, 60),
    type: 'group',
    created_by: user.id,
  }).select('id').single()
  if (roomErr || !room) {
    return NextResponse.json({ error: roomErr?.message ?? 'room create failed' }, { status: 500 })
  }

  // 멤버 등록
  const memberRows = allMemberIds.map(uid => ({ room_id: room.id, user_id: uid }))
  const { error: memErr } = await service.from('chat_room_members').insert(memberRows)
  if (memErr) {
    return NextResponse.json({ error: memErr.message }, { status: 500 })
  }

  return NextResponse.json({ room_id: room.id })
}
