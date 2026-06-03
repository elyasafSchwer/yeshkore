-- ============================================================
-- YESHKORE — MASTER DATABASE SCHEMA
-- Paste into Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- ENUMS
-- ──────────────────────────────────────────────────────────────
create type user_role as enum ('gabbai', 'baal_kriya');

-- ──────────────────────────────────────────────────────────────
-- TABLES
-- ──────────────────────────────────────────────────────────────

create table profiles (
                          id              uuid             primary key references auth.users(id) on delete cascade,
                          full_name       text             not null,
                          role            user_role        not null,
                          synagogue_name  text,
                          phone           text,
                          nusach          text[],
                          address         text,
                          latitude        double precision,
                          longitude       double precision,
                          created_at      timestamptz      not null default now()
);

create table reading_slots (
                               id            uuid        primary key default gen_random_uuid(),
                               gabbai_id     uuid        not null references profiles(id) on delete cascade,
                               parasha_name  text        not null,
                               reading_date  date        not null,
                               notes         text,
                               created_at    timestamptz not null default now()
);

create table minyan_slots (
                              id                 uuid        primary key default gen_random_uuid(),
                              reading_slot_id    uuid        not null references reading_slots(id) on delete cascade,
                              prayer_start_time  time        not null,
                              reading_start_time time        not null,
                              status             text        not null default 'open',
                              nusach             text[],
                              baal_kriya_id      uuid        references profiles(id) on delete set null,
                              created_at         timestamptz not null default now()
);

-- ──────────────────────────────────────────────────────────────
-- INDEXES
-- ──────────────────────────────────────────────────────────────
create index idx_profiles_location    on profiles      (latitude, longitude);
create index idx_reading_slots_date   on reading_slots (reading_date);
create index idx_minyan_slots_status  on minyan_slots  (status);

-- ──────────────────────────────────────────────────────────────
-- FUNCTIONS & TRIGGERS
-- ──────────────────────────────────────────────────────────────

create or replace function public.handle_new_user()
  returns trigger
  language plpgsql
  security definer set search_path = ''
  as $$
begin
insert into public.profiles (id, full_name, role)
values (
           new.id,
           coalesce(new.raw_user_meta_data ->> 'username', 'user'),
           'baal_kriya'
       );
return new;
end;
  $$;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- ──────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ──────────────────────────────────────────────────────────────

alter table profiles      enable row level security;
alter table reading_slots enable row level security;
alter table minyan_slots  enable row level security;

-- Profiles
create policy "Anyone can view profiles"
    on profiles for select to authenticated using (true);
create policy "Users can insert their own profile"
    on profiles for insert to authenticated with check (id = auth.uid());
  create policy "Users can update their own profile"
    on profiles for update to authenticated using (id = auth.uid());

-- Reading slots
create policy "Anyone can view reading_slots"
    on reading_slots for select to authenticated using (true);
create policy "Gabbaim can create reading_slots"
    on reading_slots for insert to authenticated
    with check (gabbai_id = auth.uid());
  create policy "Gabbaim can update their own reading_slots"
    on reading_slots for update to authenticated
                                             using (gabbai_id = auth.uid());
create policy "Gabbaim can delete their own reading_slots"
    on reading_slots for delete to authenticated
    using (gabbai_id = auth.uid());

  -- Minyan slots
  create policy "Anyone can view minyan_slots"
    on minyan_slots for select to authenticated using (true);
create policy "Gabbaim can create minyan_slots"
    on minyan_slots for insert to authenticated
    with check (
      reading_slot_id in (select id from reading_slots where gabbai_id = auth.uid())
    );
  create policy "Gabbaim can update their own minyan_slots"
    on minyan_slots for update to authenticated
                                            using (
                                            reading_slot_id in (select id from reading_slots where gabbai_id = auth.uid())
                                            );
create policy "Gabbaim can delete their own minyan_slots"
    on minyan_slots for delete to authenticated
    using (
      reading_slot_id in (select id from reading_slots where gabbai_id = auth.uid())
    );