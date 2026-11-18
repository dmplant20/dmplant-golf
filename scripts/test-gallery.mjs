// 갤러리 End-to-End 점검: 컬럼·RLS·Storage 정상 동작 확인
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})

const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SVC  = process.env.SUPABASE_SERVICE_ROLE_KEY

const svc = createClient(URL, SVC, { auth: { autoRefreshToken: false, persistSession: false } })

// ── 1. 스키마 검증 ─────────────────────────────────────────────────────
console.log('\n[1] 스키마 검증')
const a1 = await svc.from('albums').select('id,theme,description,created_by').limit(1)
console.log('   albums.theme/description/created_by:', a1.error ? '❌ ' + a1.error.message : '✓')
const a2 = await svc.from('album_photos').select('id,caption').limit(1)
console.log('   album_photos.caption:', a2.error ? '❌ ' + a2.error.message : '✓')
const b = await svc.storage.getBucket('club-media')
console.log('   club-media 버킷:', b.error ? '❌' : `✓ public=${b.data.public} limit=${b.data.file_size_limit}`)

// ── 2. 임원 시뮬레이션 — service role 로 직접 INSERT (RLS 우회) ───────
console.log('\n[2] 데이터 INSERT 테스트 (service role)')
const { data: club } = await svc.from('clubs').select('id,name').eq('name','MGF').single()
const { data: user } = await svc.from('users').select('id,full_name').eq('email','dmplant@naver.com').single()

// 테스트 앨범 생성
const tag = 'TEST_' + Date.now()
const { data: album, error: albumErr } = await svc.from('albums').insert({
  club_id: club.id,
  title: tag,
  theme: 'awards',
  description: '자동 테스트',
  created_by: user.id,
}).select().single()
console.log('   앨범 생성:', albumErr ? '❌ ' + albumErr.message : `✓ id=${album.id.slice(0,8)} theme=${album.theme}`)

// 테스트 사진 업로드 (service role 로)
const tinyPng = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c63600000000200015e9400000000049454e44ae426082','hex')
const path = `albums/${album.id}/test_${Date.now()}.png`
const upRes = await svc.storage.from('club-media').upload(path, tinyPng, { contentType: 'image/png' })
console.log('   사진 업로드:', upRes.error ? '❌ ' + upRes.error.message : '✓')
const { data: urlData } = svc.storage.from('club-media').getPublicUrl(path)
console.log('   public URL:', urlData.publicUrl.slice(0, 60) + '...')

const phRes = await svc.from('album_photos').insert({
  album_id: album.id,
  url: urlData.publicUrl,
  uploaded_by: user.id,
  caption: '🏆 시상식 테스트',
}).select().single()
console.log('   사진 row 생성:', phRes.error ? '❌ ' + phRes.error.message : `✓ id=${phRes.data.id.slice(0,8)}`)

// ── 3. anon 키로 READ — RLS 가 클럽 멤버만 통과시켜야 함 (anon은 차단) ─
console.log('\n[3] anon 키로 RLS 차단 검증 (인증 없으면 0건이어야 정상)')
const anon = createClient(URL, ANON)
const a3 = await anon.from('albums').select('id').eq('id', album.id)
console.log('   anon 으로 albums SELECT:', a3.data?.length ?? 0, '건 (0이 맞음)')
const a4 = await anon.from('album_photos').select('id').eq('album_id', album.id)
console.log('   anon 으로 album_photos SELECT:', a4.data?.length ?? 0, '건 (0이 맞음)')

// ── 4. 인증된 클라이언트 시뮬레이션 — admin 로그인 토큰 발급 → READ ───
console.log('\n[4] 인증된 회원으로 READ + 업로드 (실제 회원 시나리오)')
const link = await svc.auth.admin.generateLink({ type: 'magiclink', email: 'dmplant@naver.com' })
if (link.error || !link.data?.properties?.hashed_token) {
  console.log('   ❌ magic link 발급 실패')
} else {
  const authClient = createClient(URL, ANON)
  const otp = await authClient.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: 'magiclink' })
  if (otp.error) {
    console.log('   ❌ OTP 검증 실패:', otp.error.message)
  } else {
    console.log('   ✓ 회원 세션 생성됨:', otp.data.user?.email)
    // 회원 권한으로 albums + album_photos 조회
    const r1 = await authClient.from('albums').select('id,title,theme,description').eq('id', album.id).single()
    console.log('   회원으로 앨범 조회:', r1.error ? '❌ ' + r1.error.message : `✓ "${r1.data.title}" (${r1.data.theme})`)
    const r2 = await authClient.from('album_photos').select('id,url,caption,uploaded_by').eq('album_id', album.id)
    console.log('   회원으로 사진 조회:', r2.error ? '❌' : `✓ ${r2.data.length}건`)
    // 회원이 사진 업로드 시도 (RLS 통과해야 함)
    const upPath = `albums/${album.id}/member_${Date.now()}.png`
    const upMember = await authClient.storage.from('club-media').upload(upPath, tinyPng, { contentType: 'image/png' })
    console.log('   회원이 Storage 업로드:', upMember.error ? '❌ ' + upMember.error.message : '✓')
    if (!upMember.error) {
      const { data: u } = authClient.storage.from('club-media').getPublicUrl(upPath)
      const insMember = await authClient.from('album_photos').insert({
        album_id: album.id, url: u.publicUrl, uploaded_by: otp.data.user.id, caption: '회원 업로드 테스트',
      })
      console.log('   회원이 photos row 생성:', insMember.error ? '❌ ' + insMember.error.message : '✓')
    }
  }
}

// ── 5. 정리 ─────────────────────────────────────────────────────────
console.log('\n[5] 테스트 데이터 정리')
const dPh = await svc.from('album_photos').delete().eq('album_id', album.id)
console.log('   사진 삭제:', dPh.error ? '❌' : '✓')
const dAl = await svc.from('albums').delete().eq('id', album.id)
console.log('   앨범 삭제:', dAl.error ? '❌' : '✓')
const dSt = await svc.storage.from('club-media').list(`albums/${album.id}`)
if (dSt.data?.length) {
  await svc.storage.from('club-media').remove(dSt.data.map(f => `albums/${album.id}/${f.name}`))
  console.log(`   Storage 파일 ${dSt.data.length}개 삭제 ✓`)
}

console.log('\n✅ 모두 통과하면 갤러리 정상 동작')
