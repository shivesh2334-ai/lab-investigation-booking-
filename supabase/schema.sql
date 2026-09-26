create table if not exists public.lab_bookings (
 id text primary key, name text not null, phone text not null, email text not null default '',
 age integer not null check (age between 0 and 120), gender text not null, notes text not null default '',
 date date not null, slot text not null, tests text[] not null, total integer not null,
 status text not null default 'requested', telegram_status text not null default 'pending',
 whatsapp_status text not null default 'pending', created_at timestamptz not null default now()
);
create index if not exists lab_bookings_date_created_idx on public.lab_bookings (date, created_at desc);
alter table public.lab_bookings enable row level security;
