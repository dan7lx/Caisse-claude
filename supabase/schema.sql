-- Caisse Resto : serveur de synchronisation des lobbies.
-- À exécuter une seule fois dans Supabase › SQL Editor › New query › Run.
--
-- Principe : chaque modification (commande envoyée, plat prêt…) est une « opération »
-- ajoutée au journal du lobby avec un numéro croissant. Chaque appareil rejoue ces
-- opérations dans le même ordre et obtient donc les mêmes données.
--
-- Sécurité : les tables ne sont pas accessibles directement (RLS sans règle) ;
-- tout passe par les fonctions ci-dessous. L'identifiant interne d'un lobby
-- (32 caractères aléatoires) n'est connu que des appareils qui ont rejoint avec le code.

create table if not exists public.caisse_lobbies (
  id text primary key,
  code text not null unique,
  seq bigint not null default 0,
  snapshot jsonb not null,
  snapshot_seq bigint not null default 0,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create table if not exists public.caisse_events (
  lobby_id text not null references public.caisse_lobbies(id) on delete cascade,
  seq bigint not null,
  op_id text not null,
  op jsonb not null,
  created_at timestamptz not null default now(),
  primary key (lobby_id, seq),
  unique (lobby_id, op_id)
);

alter table public.caisse_lobbies enable row level security;
alter table public.caisse_events enable row level security;
revoke all on public.caisse_lobbies from anon, authenticated;
revoke all on public.caisse_events from anon, authenticated;

-- Code d'accès à 6 caractères, sans caractères ambigus (0/O, 1/I).
create or replace function public.caisse_random_code()
returns text
language plpgsql
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
begin
  for i in 1..6 loop
    result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return result;
end;
$$;

create or replace function public.caisse_create_lobby(p_snapshot jsonb)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text := replace(gen_random_uuid()::text, '-', '');
  v_code text;
  v_tries int := 0;
begin
  if p_snapshot is null or jsonb_typeof(p_snapshot) <> 'object' then
    raise exception 'Données invalides';
  end if;
  loop
    v_code := caisse_random_code();
    exit when not exists (select 1 from caisse_lobbies where code = v_code);
    v_tries := v_tries + 1;
    if v_tries > 20 then
      raise exception 'Impossible de générer un code, réessayez';
    end if;
  end loop;
  insert into caisse_lobbies (id, code, snapshot) values (v_id, v_code, p_snapshot);
  return json_build_object('lobby_id', v_id, 'code', v_code);
end;
$$;

create or replace function public.caisse_join_lobby(p_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  r caisse_lobbies%rowtype;
begin
  select * into r from caisse_lobbies where code = upper(trim(p_code)) and closed_at is null;
  if not found then
    raise exception 'Aucun lobby ouvert avec ce code';
  end if;
  return json_build_object(
    'lobby_id', r.id,
    'code', r.code,
    'snapshot', r.snapshot,
    'snapshot_seq', r.snapshot_seq
  );
end;
$$;

create or replace function public.caisse_push(p_lobby text, p_ops jsonb)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_seq bigint;
  v_inserted int := 0;
begin
  if jsonb_typeof(p_ops) <> 'array' or jsonb_array_length(p_ops) > 200 then
    raise exception 'Opérations invalides';
  end if;
  -- Verrou sur le lobby : les numéros sont attribués et validés dans l'ordre.
  perform 1 from caisse_lobbies where id = p_lobby and closed_at is null for update;
  if not found then
    raise exception 'Lobby fermé ou introuvable';
  end if;
  for v_item in select value from jsonb_array_elements(p_ops) loop
    if (v_item->>'op_id') is null or (v_item->'op') is null then
      continue;
    end if;
    -- Une opération renvoyée deux fois (réseau coupé) n'est enregistrée qu'une fois.
    if exists (select 1 from caisse_events where lobby_id = p_lobby and op_id = v_item->>'op_id') then
      continue;
    end if;
    update caisse_lobbies set seq = seq + 1 where id = p_lobby returning seq into v_seq;
    insert into caisse_events (lobby_id, seq, op_id, op)
    values (p_lobby, v_seq, v_item->>'op_id', v_item->'op');
    v_inserted := v_inserted + 1;
  end loop;
  return json_build_object('inserted', v_inserted);
end;
$$;

create or replace function public.caisse_pull(p_lobby text, p_after bigint)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_closed boolean;
  v_events json;
begin
  select closed_at is not null into v_closed from caisse_lobbies where id = p_lobby;
  if not found then
    raise exception 'Lobby introuvable';
  end if;
  select coalesce(json_agg(json_build_object('seq', e.seq, 'op_id', e.op_id, 'op', e.op) order by e.seq), '[]'::json)
    into v_events
    from (
      select seq, op_id, op from caisse_events
      where lobby_id = p_lobby and seq > p_after
      order by seq
      limit 500
    ) e;
  return json_build_object('closed', v_closed, 'events', v_events);
end;
$$;

create or replace function public.caisse_save_snapshot(p_lobby text, p_snapshot jsonb, p_seq bigint)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ok boolean;
begin
  update caisse_lobbies
     set snapshot = p_snapshot, snapshot_seq = p_seq
   where id = p_lobby and p_seq > snapshot_seq and p_seq <= seq;
  v_ok := found;
  if v_ok then
    -- Le journal bien antérieur à l'instantané n'est plus nécessaire.
    delete from caisse_events where lobby_id = p_lobby and seq <= p_seq - 1000;
  end if;
  return json_build_object('ok', v_ok);
end;
$$;

create or replace function public.caisse_close_lobby(p_lobby text)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  update caisse_lobbies set closed_at = now() where id = p_lobby and closed_at is null;
  return json_build_object('ok', found);
end;
$$;

revoke execute on function public.caisse_random_code() from public, anon, authenticated;
revoke execute on function public.caisse_create_lobby(jsonb) from public;
revoke execute on function public.caisse_join_lobby(text) from public;
revoke execute on function public.caisse_push(text, jsonb) from public;
revoke execute on function public.caisse_pull(text, bigint) from public;
revoke execute on function public.caisse_save_snapshot(text, jsonb, bigint) from public;
revoke execute on function public.caisse_close_lobby(text) from public;

grant execute on function public.caisse_create_lobby(jsonb) to anon, authenticated;
grant execute on function public.caisse_join_lobby(text) to anon, authenticated;
grant execute on function public.caisse_push(text, jsonb) to anon, authenticated;
grant execute on function public.caisse_pull(text, bigint) to anon, authenticated;
grant execute on function public.caisse_save_snapshot(text, jsonb, bigint) to anon, authenticated;
grant execute on function public.caisse_close_lobby(text) to anon, authenticated;
