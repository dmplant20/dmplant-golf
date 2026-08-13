-- ════════════════════════════════════════════════════════════════════════════
-- 네이티브 푸시(FCM/APNs) 기기 토큰 테이블
-- 사용법: Supabase Dashboard → SQL Editor → 전체 붙여넣기 → Run
-- ════════════════════════════════════════════════════════════════════════════
-- 웹 push_subscriptions 와 별개. 네이티브 기기의 FCM/APNs 토큰 저장.
-- push-native-server.ts 가 발송, register-device 라우트가 등록/해제.

create table if not exists public.device_push_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  platform    text not null check (platform in ('android','ios')),
  token       text not null,
  app_version text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, token)
);

create index if not exists device_push_tokens_user_idx on public.device_push_tokens(user_id);

alter table public.device_push_tokens enable row level security;

-- 본인 토큰만 조회 (등록/삭제는 라우트가 service/cookie 세션으로 수행)
drop policy if exists "own device tokens read" on public.device_push_tokens;
create policy "own device tokens read" on public.device_push_tokens
  for select using (auth.uid() = user_id);

drop policy if exists "own device tokens write" on public.device_push_tokens;
create policy "own device tokens write" on public.device_push_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
