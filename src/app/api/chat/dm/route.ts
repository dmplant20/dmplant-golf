// 1:1 DM 룸 찾기/생성 — 두 user_id 의 DM 룸이 이미 있으면 재사용
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

  const { target_user_id, club_id } = await req.json()
  if (!target_user_id || !club_id) {
    return NextResponse.json({ error: 'target_user_id, club_id required' }, { status: 400 })
  }
  if (target_user_id === user.id) {
    return NextResponse.json({ error: 'cannot DM yourself' }, { status: 400 })
  }

  // 두 사람 모두 같은 클럽 멤버여야 DM 가능
  const { data: bothInClub } = await anon.from('club_memberships')
    .select('user_id').eq('club_id', club_id).eq('status', 'approved')
    .in('user_id', [user.id, target_user_id])
  if (!bothInClub || bothInClub.length !== 2) {
    return NextResponse.json({ error: 'both users must be approved members of the club' }, { status: 403 })
  }

  const service = makeService()
  if (!service) return NextResponse.json({ error: 'service role not configured' }, { status: 500 })

  // 기존 DM 룸 검색 — 두 사람만 정확히 멤버인 dm 룸
  // 1) 내가 속한 dm 룸 id 목록
  const { data: myDmRooms } = await service.from('chat_room_members')
    .select('room_id, chat_rooms!inner(id, type)').eq('user_id', user.id)
  const dmRoomIds = (myDmRooms ?? [])
    .filter((r: any) => (Array.isArray(r.chat_rooms) ? r.chat_rooms[0] : r.chat_rooms)?.type === 'dm')
    .map((r: any) => r.room_id)

  if (dmRoomIds.length) {
    // 2) 그 중 상대방도 멤버인 룸이 있나
    const { data: matchingMembers } = await service.from('chat_room_members')
      .select('room_id').eq('user_id', target_user_id).in('room_id', dmRoomIds)
    const existingRoomId = matchingMembers?.[0]?.room_id
    if (existingRoomId) {
      return NextResponse.json({ room_id: existingRoomId, created: false })
    }
  }

  // 3) 새 DM 룸 생성
  const { data: room, error: roomErr } = await service.from('chat_rooms').insert({
    club_id,
    name: 'DM',          // 클라이언트는 상대방 이름으로 표시
    name_en: 'DM',
    type: 'dm',
    created_by: user.id,
  }).select('id').single()
  if (roomErr || !room) {
    return NextResponse.json({ error: roomErr?.message ?? 'room create failed' }, { status: 500 })
  }

  // 4) 두 사람을 멤버로 등록
  const { error: memErr } = await service.from('chat_room_members').insert([
    { room_id: room.id, user_id: user.id },
    { room_id: room.id, user_id: target_user_id },
  ])
  if (memErr) {
    return NextResponse.json({ error: memErr.message }, { status: 500 })
  }

  return NextResponse.json({ room_id: room.id, created: true })
}
