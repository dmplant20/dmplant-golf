create extension if not exists "uuid-ossp";

create table users (
  id uuid default uuid_generate_v4() primary key,
  email text not null unique,
  full_name text not null,
  full_name_en text,
  name_abbr text,
  phone text,
  avatar_url text,
  created_at timestamptz default now()
);

create table clubs (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  name_en text,
  description text,
  logo_url text,
  currency text not null default 'KRW' check (currency in ('KRW', 'VND', 'IDR')),
  annual_fee bigint,
  monthly_fee bigint,
  fee_type text not null default 'monthly' check (fee_type in ('annual', 'monthly')),
  max_members int not null default 50,
  created_by uuid references users(id),
  created_at timestamptz default now()
);

create table club_memberships (
  id uuid default uuid_generate_v4() primary key,
  club_id uuid references clubs(id) on delete cascade not null,
  user_id uuid references users(id) on delete cascade not null,
  role text not null default 'member' check (role in ('president', 'secretary', 'officer', 'member')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'withdrawn')),
  club_handicap numeric(5,1),
  personal_handicap numeric(5,1),
  joined_at timestamptz,
  created_at timestamptz default now(),
  unique(club_id, user_id)
);

create table penalty_rules (
  id uuid default uuid_generate_v4() primary key,
  club_id uuid references clubs(id) on delete cascade not null,
  name text not null,
  name_en text,
  amount_per_stroke bigint not null default 0,
  max_amount bigint,
  currency text not null default 'KRW' check (currency in ('KRW', 'VND', 'IDR')),
  description text,
  created_at timestamptz default now()
);

create table finance_transactions (
  id uuid default uuid_generate_v4() primary key,
  club_id uuid references clubs(id) on delete cascade not null,
  type text not null check (type in ('fee', 'expense', 'fine', 'donation', 'other')),
  amount bigint not null,
  currency text not null default 'KRW' check (currency in ('KRW', 'VND', 'IDR')),
  description text not null,
  member_id uuid references users(id),
  receipt_url text,
  ocr_items jsonb,
  recorded_by uuid references users(id) not null,
  transaction_date date not null default current_date,
  created_at timestamptz default now()
);

create table tournaments (
  id uuid default uuid_generate_v4() primary key,
  club_id uuid references clubs(id) on delete cascade not null,
  name text not null,
  name_en text,
  date date not null,
  venue text,
  is_official boolean not null default false,
  grouping_method text not null default 'auto_handicap'
    check (grouping_method in ('auto_handicap', 'auto_random', 'manual')),
  status text not null default 'upcoming'
    check (status in ('upcoming', 'ongoing', 'completed')),
  scorecard_url text,
  created_by uuid references users(id),
  created_at timestamptz default now()
);

create table tournament_groups (
  id uuid default uuid_generate_v4() primary key,
  tournament_id uuid references tournaments(id) on delete cascade not null,
  group_number int not null,
  tee_time time,
  created_at timestamptz default now()
);

create table tournament_group_members (
  id uuid default uuid_generate_v4() primary key,
  group_id uuid references tournament_groups(id) on delete cascade not null,
  user_id uuid references users(id) not null,
  is_attending boolean not null default true,
  score int,
  handicap_used numeric(5,1),
  net_score numeric(6,1),
  created_at timestamptz default now(),
  unique(group_id, user_id)
);

create table scores (
  id uuid default uuid_generate_v4() primary key,
  club_id uuid references clubs(id) on delete cascade not null,
  tournament_id uuid references tournaments(id) on delete cascade,
  user_id uuid references users(id) on delete cascade not null,
  gross_score int not null,
  net_score numeric(6,1),
  handicap_used numeric(5,1),
  is_official boolean not null default false,
  played_at date not null default current_date,
  created_at timestamptz default now()
);

create table monthly_rankings (
  id uuid default uuid_generate_v4() primary key,
  club_id uuid references clubs(id) on delete cascade not null,
  user_id uuid references users(id) not null,
  year int not null,
  month int not null check (month between 1 and 12),
  avg_score numeric(5,1),
  tournaments_played int not null default 0,
  rank int,
  created_at timestamptz default now(),
  unique(club_id, user_id, year, month)
);

create table reservations (
  id uuid default uuid_generate_v4() primary key,
  club_id uuid references clubs(id) on delete cascade not null,
  tournament_id uuid references tournaments(id),
  user_id uuid references users(id) on delete cascade not null,
  venue text not null,
  reserved_date date not null,
  tee_time time not null,
  players int not null default 1 check (players between 1 and 4),
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'cancelled')),
  note text,
  confirmed_by uuid references users(id),
  created_at timestamptz default now()
);

create table chat_rooms (
  id uuid default uuid_generate_v4() primary key,
  club_id uuid references clubs(id) on delete cascade not null,
  name text not null,
  name_en text,
  type text not null default 'club_wide'
    check (type in ('club_wide', 'group', 'tournament_group')),
  tournament_group_id uuid references tournament_groups(id),
  created_at timestamptz default now()
);

create table chat_messages (
  id uuid default uuid_generate_v4() primary key,
  room_id uuid references chat_rooms(id) on delete cascade not null,
  user_id uuid references users(id) not null,
  content text not null,
  created_at timestamptz default now()
);

create table announcements (
  id uuid default uuid_generate_v4() primary key,
  club_id uuid references clubs(id) on delete cascade not null,
  title text not null,
  title_en text,
  content text not null,
  content_en text,
  author_id uuid references users(id) not null,
  created_at timestamptz default now()
);

create table events (
  id uuid default uuid_generate_v4() primary key,
  club_id uuid references clubs(id) on delete cascade not null,
  type text not null check (type in ('meeting', 'celebration', 'condolence', 'other')),
  title text not null,
  title_en text,
  description text,
  event_date timestamptz not null,
  created_by uuid references users(id),
  created_at timestamptz default now()
);

create table albums (
  id uuid default uuid_generate_v4() primary key,
  club_id uuid references clubs(id) on delete cascade not null,
  tournament_id uuid references tournaments(id),
  title text not null,
  cover_url text,
  created_by uuid references users(id),
  created_at timestamptz default now()
);

create table album_photos (
  id uuid default uuid_generate_v4() primary key,
  album_id uuid references albums(id) on delete cascade not null,
  url text not null,
  caption text,
  uploaded_by uuid references users(id) not null,
  created_at timestamptz default now()
);

create table push_subscriptions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references users(id) on delete cascade not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now(),
  unique(user_id, endpoint)
);

create index on club_memberships(club_id, status);
create index on club_memberships(user_id);
create index on finance_transactions(club_id, transaction_date);
create index on tournaments(club_id, date);
create index on scores(club_id, user_id, played_at);
create index on reservations(club_id, reserved_date);
create index on chat_messages(room_id, created_at);
create index on monthly_rankings(club_id, year, month);
