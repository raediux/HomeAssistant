-- Home Assistant — Supabase schema
-- Run this in the Supabase SQL editor (Database → SQL Editor → New query)

-- Tasks
create table if not exists tasks (
  id           bigint primary key,
  person       text        not null check (person in ('ray','jazelle','linus')),
  frequency    text        not null check (frequency in ('daily','weekly','occasional')),
  title        text        not null,
  due_date     date,
  dow          smallint    check (dow between 0 and 6),  -- 0=Mon … 6=Sun
  done         boolean     not null default false,
  created_at   timestamptz not null default now()
);

-- Shopping — working list
create table if not exists shopping_working (
  id           bigint primary key,
  name         text        not null,
  qty          text,
  store        text,
  got          boolean     not null default false,
  category     text        not null default 'Other'
);

-- Shopping — past purchases
create table if not exists shopping_past (
  id           bigint primary key,
  name         text        not null,
  store        text,
  times        integer     not null default 1,
  category     text        not null default 'Other'
);
