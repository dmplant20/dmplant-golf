-- ════════════════════════════════════════════════════════════════════════════
-- 첫 로그인 비밀번호 강제 설정 + 사전등록된 회원 마킹
-- ────────────────────────────────────────────────────────────────────────────
-- 사용법: Supabase Dashboard → SQL Editor → 새 쿼리 → 전체 붙여넣기 → Run
-- ════════════════════════════════════════════════════════════════════════════

-- 1. password_set 컬럼 추가 (default true → 기존 사용자는 영향 없음)
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_set boolean DEFAULT true NOT NULL;

-- 2. 방금 일괄 등록된 MGF 회원 27명을 password_set=false 로 마킹
--    → 첫 로그인 시 비밀번호 등록 팝업이 뜸
UPDATE users SET password_set = false
WHERE email IN (
  'wok1818@wintrading.com',
  'hykim@wintrading.co.kr',
  '0524sang@gmail.com',
  'jhnet20@naver.com',
  'k01036012693@gmail.com',
  'sang2442@wintrading.co.kr',
  'polybagsa@naver.com',
  'ojh4824@gmail.com',
  'simonk@unisollvina.com',
  'cspark@yckorea.com',
  'joseph010328@gmail.com',
  'djbaik@dsvina.com.vn',
  'j2652@hwashintnp.com',
  'hsahn@ilshin.co.kr',
  'llkjhgf62@daum.net',
  'baesangju275@gmail.com',
  'jasonyg@hanmail.net',
  'leesuntex@naver.com',
  '67water@naver.com',
  'S01050985440@gmail.com',
  'design932@gmail.com',
  'taupe1@wintrading.co.kr',
  'edwardlee@wintrading.co.kr'
);

-- 3. placeholder 이메일도 마킹 (이메일 없는 4명)
UPDATE users SET password_set = false
WHERE email LIKE 'placeholder_%@mgf.local';

-- ════════════════════════════════════════════════════════════════════════════
-- ✅ 완료. 이제 위 회원이 로그인하면:
--    이메일만 입력 → 자동 인증 → 강제 비밀번호 설정 팝업 → 등록 후 정상 사용
-- ════════════════════════════════════════════════════════════════════════════
