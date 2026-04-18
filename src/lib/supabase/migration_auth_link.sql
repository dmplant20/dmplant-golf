alter table users alter column id drop default;
alter table users add constraint users_id_fkey
  foreign key (id) references auth.users(id) on delete cascade;

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, full_name, full_name_en, name_abbr, phone)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.raw_user_meta_data->>'full_name_en',
    new.raw_user_meta_data->>'name_abbr',
    new.raw_user_meta_data->>'phone'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.handle_new_club()
returns trigger as $$
begin
  insert into public.chat_rooms (club_id, name, name_en, type)
  values (new.id, '전체 채팅', 'Club Chat', 'club_wide');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_club_created
  after insert on public.clubs
  for each row execute procedure public.handle_new_club();
