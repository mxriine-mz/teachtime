-- Base en ligne de TEAch Time (Supabase).
-- À coller une seule fois dans Supabase > SQL Editor, puis « Run ».
-- Chaque compte ne voit et ne modifie que ses propres lignes (Row Level Security).

-- Points gagnés : un événement par gain, jamais modifié.
create table if not exists public.tt_events (
  id      text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  dev     text,
  t       bigint not null,
  day     text not null,
  kind    text not null,
  pts     integer not null default 0,
  ref     text,
  srv     bigint not null default (extract(epoch from clock_timestamp()) * 1000)::bigint
);
create index if not exists tt_events_user_srv on public.tt_events (user_id, srv);

-- Objets : textes à mémoriser, listes de vocabulaire, statistiques… Le plus récent gagne.
create table if not exists public.tt_items (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key     text not null,
  v       jsonb,
  u       bigint not null,
  deleted boolean not null default false,
  srv     bigint not null default (extract(epoch from clock_timestamp()) * 1000)::bigint,
  primary key (user_id, key)
);
create index if not exists tt_items_user_srv on public.tt_items (user_id, srv);

alter table public.tt_events enable row level security;
alter table public.tt_items enable row level security;

-- Accès par l'API : seulement pour les comptes connectés (jamais pour les visiteurs anonymes).
revoke all on public.tt_events, public.tt_items from anon;
grant select, insert on public.tt_events to authenticated;
grant select, insert, update on public.tt_items to authenticated;

drop policy if exists "tt_events lecture" on public.tt_events;
drop policy if exists "tt_events ajout" on public.tt_events;
create policy "tt_events lecture" on public.tt_events for select to authenticated using (user_id = auth.uid());
create policy "tt_events ajout" on public.tt_events for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "tt_items lecture" on public.tt_items;
drop policy if exists "tt_items ajout" on public.tt_items;
drop policy if exists "tt_items maj" on public.tt_items;
create policy "tt_items lecture" on public.tt_items for select to authenticated using (user_id = auth.uid());
create policy "tt_items ajout" on public.tt_items for insert to authenticated with check (user_id = auth.uid());
create policy "tt_items maj" on public.tt_items for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Écriture groupée des objets : une version plus ancienne n'écrase jamais une plus récente.
create or replace function public.tt_put_items(rows jsonb)
returns void
language sql
security invoker
set search_path = public
as $$
  insert into public.tt_items (user_id, key, v, u, deleted, srv)
  select auth.uid(), r ->> 'key', r -> 'v', (r ->> 'u')::bigint, coalesce((r ->> 'deleted')::boolean, false),
         (extract(epoch from clock_timestamp()) * 1000)::bigint
  from jsonb_array_elements(rows) as r
  on conflict (user_id, key) do update
    set v = excluded.v, u = excluded.u, deleted = excluded.deleted, srv = excluded.srv
    where public.tt_items.u < excluded.u;
$$;

revoke all on function public.tt_put_items(jsonb) from public, anon;
grant execute on function public.tt_put_items(jsonb) to authenticated;
