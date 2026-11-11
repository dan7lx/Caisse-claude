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


-- ===================================================================================
-- Paiements par virement, clés d'activation et licences (validation manuelle)
-- ===================================================================================
--
-- Principe :
-- 1. le client crée une « commande de paiement » (formule, nom, e-mail, WhatsApp) et reçoit
--    une référence unique à mettre en communication du virement, plus un jeton secret qui lui
--    permet (à lui seul) de suivre SA commande ;
-- 2. il envoie la preuve du virement sur WhatsApp ;
-- 3. le créateur se connecte au tableau de bord (mot de passe), vérifie le virement sur Revolut,
--    confirme le paiement puis génère une clé d'activation liée à cette licence et à cette formule ;
-- 4. le client saisit la clé : la licence devient active (mensuel : 30 jours, cumulables ; à vie : sans fin).
--
-- Sécurité :
-- - aucune table n'est lisible directement (RLS sans règle) : tout passe par les fonctions ;
-- - les fonctions d'administration exigent le mot de passe du créateur (bcrypt), avec blocage
--   temporaire après plusieurs erreurs ;
-- - jetons et clés sont aléatoires (pgcrypto) et seule leur empreinte SHA-256 est stockée ;
-- - une clé ne sert qu'une fois, et seulement pour la licence de la commande.
--
-- MISE EN SERVICE (une seule fois, dans SQL Editor, en remplaçant le texte entre guillemets) :
--   select public.caisse_admin_set_password('votre-mot-de-passe-long-et-unique');
-- Ce mot de passe ouvre le tableau de bord du créateur dans l'application. Il n'est jamais stocké en clair.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.caisse_billing (
  id int primary key default 1 check (id = 1),
  business_name text not null default 'Caisse Resto',
  first_name text not null default 'R',
  last_name text not null default 'Pereira',
  iban text not null default 'BE71650156242169',
  holder text not null default 'R Pereira',
  whatsapp text not null default '32465538869',
  price_monthly int not null default 4599 check (price_monthly > 0),
  price_lifetime int not null default 59999 check (price_lifetime > 0),
  updated_at timestamptz not null default now()
);
insert into public.caisse_billing (id) values (1) on conflict (id) do nothing;

create table if not exists public.caisse_admin (
  id int primary key default 1 check (id = 1),
  password_hash text,
  failed int not null default 0,
  locked_until timestamptz
);
insert into public.caisse_admin (id) values (1) on conflict (id) do nothing;

create sequence if not exists public.caisse_order_number_seq;

create table if not exists public.caisse_payment_orders (
  id uuid primary key default gen_random_uuid(),
  number bigint not null unique default nextval('public.caisse_order_number_seq'),
  reference text not null unique,
  token_hash text not null,
  license_id text not null,
  plan text not null check (plan in ('mensuel', 'vie')),
  amount int not null,
  customer_name text not null,
  restaurant_name text not null default '',
  email text not null,
  phone text not null default '',
  status text not null default 'en_attente'
    check (status in ('en_attente', 'preuve_envoyee', 'confirmee', 'refusee', 'annulee')),
  admin_note text not null default '',
  created_at timestamptz not null default now(),
  proof_sent_at timestamptz,
  confirmed_at timestamptz,
  closed_at timestamptz,
  key_hash text unique,
  key_hint text,
  key_created_at timestamptz,
  key_redeemed_at timestamptz
);
create index if not exists caisse_payment_orders_license on public.caisse_payment_orders (license_id, created_at desc);

create table if not exists public.caisse_licenses (
  license_id text primary key,
  plan text not null default 'aucun' check (plan in ('aucun', 'mensuel', 'vie')),
  valid_until timestamptz,
  revoked boolean not null default false,
  customer_name text not null default '',
  restaurant_name text not null default '',
  email text not null default '',
  phone text not null default '',
  activations int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.caisse_billing enable row level security;
alter table public.caisse_admin enable row level security;
alter table public.caisse_payment_orders enable row level security;
alter table public.caisse_licenses enable row level security;
revoke all on public.caisse_billing, public.caisse_admin, public.caisse_payment_orders, public.caisse_licenses
  from anon, authenticated;
revoke all on sequence public.caisse_order_number_seq from anon, authenticated;

-- ---------- Outils internes (jamais appelables depuis l'application) ----------

-- Texte aléatoire cryptographique, sans caractères ambigus.
create or replace function public.caisse_random_text(p_len int)
returns text
language plpgsql
set search_path = public, extensions
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea := gen_random_bytes(p_len);
  result text := '';
begin
  for i in 0..p_len - 1 loop
    result := result || substr(alphabet, 1 + (get_byte(bytes, i) % 32), 1);
  end loop;
  return result;
end;
$$;

create or replace function public.caisse_sha256(p text)
returns text
language sql
immutable
set search_path = public, extensions
as $$ select encode(digest(p, 'sha256'), 'hex') $$;

-- Vérifie le mot de passe du créateur. Ne lève pas d'erreur : le compteur d'échecs doit être enregistré.
create or replace function public.caisse_admin_ok(p_password text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  a caisse_admin%rowtype;
begin
  select * into a from caisse_admin where id = 1 for update;
  if a.password_hash is null then
    return false;
  end if;
  if a.locked_until is not null and a.locked_until > now() then
    return false;
  end if;
  if a.locked_until is not null then
    -- Blocage terminé : nouveau départ.
    update caisse_admin set failed = 0, locked_until = null where id = 1;
    a.failed := 0;
  end if;
  if p_password is not null and crypt(p_password, a.password_hash) = a.password_hash then
    update caisse_admin set failed = 0, locked_until = null where id = 1;
    return true;
  end if;
  update caisse_admin
     set failed = failed + 1,
         locked_until = case when failed + 1 >= 8 then now() + interval '10 minutes' else null end
   where id = 1;
  return false;
end;
$$;

create or replace function public.caisse_admin_error()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  a caisse_admin%rowtype;
begin
  select * into a from caisse_admin where id = 1;
  if a.password_hash is null then
    return json_build_object('error', 'Tableau de bord non configuré : définissez le mot de passe dans Supabase (voir le guide).');
  end if;
  if a.locked_until is not null and a.locked_until > now() then
    return json_build_object('error', 'Trop d’essais : accès bloqué 10 minutes.');
  end if;
  return json_build_object('error', 'Mot de passe incorrect.');
end;
$$;

-- Définit le mot de passe du créateur. Uniquement depuis SQL Editor (pas d'accès depuis l'application).
create or replace function public.caisse_admin_set_password(p_new text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_new is null or length(p_new) < 10 then
    raise exception 'Mot de passe trop court (10 caractères minimum)';
  end if;
  update caisse_admin set password_hash = crypt(p_new, gen_salt('bf', 10)), failed = 0, locked_until = null where id = 1;
  return 'Mot de passe du tableau de bord enregistré.';
end;
$$;

create or replace function public.caisse_billing_json()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'business_name', business_name, 'first_name', first_name, 'last_name', last_name,
    'iban', iban, 'holder', holder, 'whatsapp', whatsapp,
    'price_monthly', price_monthly, 'price_lifetime', price_lifetime
  ) from caisse_billing where id = 1
$$;

create or replace function public.caisse_order_json(o public.caisse_payment_orders)
returns json
language sql
stable
as $$
  select json_build_object(
    'id', o.id, 'number', o.number, 'reference', o.reference, 'license_id', o.license_id,
    'plan', o.plan, 'amount', o.amount, 'customer_name', o.customer_name,
    'restaurant_name', o.restaurant_name, 'email', o.email, 'phone', o.phone,
    'status', o.status, 'admin_note', o.admin_note,
    'created_at', o.created_at, 'proof_sent_at', o.proof_sent_at, 'confirmed_at', o.confirmed_at,
    'closed_at', o.closed_at, 'key_hint', o.key_hint, 'key_created_at', o.key_created_at,
    'key_redeemed_at', o.key_redeemed_at
  )
$$;

-- ---------- Fonctions publiques (client) ----------

create or replace function public.caisse_billing_public()
returns json
language sql
stable
security definer
set search_path = public
as $$ select caisse_billing_json() $$;

create or replace function public.caisse_create_payment_order(
  p_license text, p_plan text, p_name text, p_restaurant text, p_email text, p_phone text
)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  b caisse_billing%rowtype;
  v_token text := encode(gen_random_bytes(24), 'hex');
  v_number bigint := nextval('caisse_order_number_seq');
  v_reference text;
  v_amount int;
  o caisse_payment_orders%rowtype;
begin
  p_license := upper(trim(coalesce(p_license, '')));
  p_name := trim(coalesce(p_name, ''));
  p_restaurant := trim(coalesce(p_restaurant, ''));
  p_email := lower(trim(coalesce(p_email, '')));
  p_phone := regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g');
  if p_license !~ '^[A-Z2-9]{4}-[A-Z2-9]{4}$' then raise exception 'Identifiant de licence invalide'; end if;
  if p_plan not in ('mensuel', 'vie') then raise exception 'Formule invalide'; end if;
  if length(p_name) < 2 or length(p_name) > 80 then raise exception 'Indiquez votre prénom et votre nom'; end if;
  if length(p_restaurant) > 80 then raise exception 'Nom du commerce trop long'; end if;
  if p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(p_email) > 120 then raise exception 'Adresse e-mail invalide'; end if;
  if length(p_phone) < 8 or length(p_phone) > 16 then raise exception 'Numéro WhatsApp invalide'; end if;
  -- Anti-abus : commandes ouvertes limitées par licence et au total.
  if (select count(*) from caisse_payment_orders
       where license_id = p_license and status in ('en_attente', 'preuve_envoyee')) >= 3 then
    raise exception 'Trop de commandes en attente pour cette licence : utilisez une commande existante';
  end if;
  if (select count(*) from caisse_payment_orders where created_at > now() - interval '1 hour') >= 120 then
    raise exception 'Service momentanément saturé, réessayez plus tard';
  end if;
  select * into b from caisse_billing where id = 1;
  v_amount := case when p_plan = 'vie' then b.price_lifetime else b.price_monthly end;
  v_reference := 'CR-' || lpad(v_number::text, 4, '0') || '-' || caisse_random_text(4);
  insert into caisse_payment_orders
    (number, reference, token_hash, license_id, plan, amount, customer_name, restaurant_name, email, phone)
  values
    (v_number, v_reference, caisse_sha256(v_token), p_license, p_plan, v_amount, p_name, p_restaurant, p_email, p_phone)
  returning * into o;
  return json_build_object(
    'order', caisse_order_json(o),
    'token', v_token,
    'billing', caisse_billing_json()
  );
end;
$$;

-- Suivi de SA commande : le jeton secret est obligatoire (aucun accès aux commandes des autres).
create or replace function public.caisse_payment_order_status(p_order uuid, p_token text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  o caisse_payment_orders%rowtype;
begin
  select * into o from caisse_payment_orders where id = p_order and token_hash = caisse_sha256(coalesce(p_token, ''));
  if not found then raise exception 'Commande introuvable'; end if;
  return json_build_object(
    'order', caisse_order_json(o),
    'key_ready', o.key_hash is not null and o.key_redeemed_at is null,
    'billing', caisse_billing_json()
  );
end;
$$;

create or replace function public.caisse_payment_proof_sent(p_order uuid, p_token text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  update caisse_payment_orders
     set status = case when status = 'en_attente' then 'preuve_envoyee' else status end,
         proof_sent_at = coalesce(proof_sent_at, now())
   where id = p_order and token_hash = caisse_sha256(coalesce(p_token, ''))
     and status in ('en_attente', 'preuve_envoyee');
  return json_build_object('ok', found);
end;
$$;

create or replace function public.caisse_payment_cancel(p_order uuid, p_token text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  update caisse_payment_orders set status = 'annulee', closed_at = now()
   where id = p_order and token_hash = caisse_sha256(coalesce(p_token, ''))
     and status in ('en_attente', 'preuve_envoyee');
  return json_build_object('ok', found);
end;
$$;

-- Active une clé : mensuel = 30 jours (ajoutés à la suite si l'abonnement est encore actif), à vie = sans fin.
create or replace function public.caisse_redeem_key(p_license text, p_key text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  o caisse_payment_orders%rowtype;
  l caisse_licenses%rowtype;
  v_key text := upper(regexp_replace(coalesce(p_key, ''), '[^A-Za-z0-9]', '', 'g'));
  v_plan text;
  v_until timestamptz;
begin
  p_license := upper(trim(coalesce(p_license, '')));
  if length(v_key) <> 16 then raise exception 'Clé invalide'; end if;
  v_key := substr(v_key, 1, 4) || '-' || substr(v_key, 5, 4) || '-' || substr(v_key, 9, 4) || '-' || substr(v_key, 13, 4);
  select * into o from caisse_payment_orders where key_hash = caisse_sha256(v_key) for update;
  if not found or o.status <> 'confirmee' then raise exception 'Clé invalide'; end if;
  if o.license_id <> p_license then raise exception 'Cette clé a été créée pour une autre licence'; end if;
  if o.key_redeemed_at is not null then raise exception 'Cette clé a déjà été utilisée'; end if;

  select * into l from caisse_licenses where license_id = p_license for update;
  if o.plan = 'vie' or (found and l.plan = 'vie' and not l.revoked) then
    v_plan := 'vie';
    v_until := null;
  else
    v_plan := 'mensuel';
    v_until := greatest(
      now(),
      case when found and l.plan = 'mensuel' and not l.revoked and l.valid_until is not null then l.valid_until else now() end
    ) + interval '30 days';
  end if;

  insert into caisse_licenses as cl (license_id, plan, valid_until, revoked, customer_name, restaurant_name, email, phone, activations)
  values (p_license, v_plan, v_until, false, o.customer_name, o.restaurant_name, o.email, o.phone, 1)
  on conflict (license_id) do update
    set plan = excluded.plan, valid_until = excluded.valid_until, revoked = false,
        customer_name = excluded.customer_name, restaurant_name = excluded.restaurant_name,
        email = excluded.email, phone = excluded.phone,
        activations = cl.activations + 1, updated_at = now();

  update caisse_payment_orders set key_redeemed_at = now(), closed_at = coalesce(closed_at, now()) where id = o.id;
  return json_build_object(
    'plan', v_plan,
    'valid_until', case when v_until is null then null else floor(extract(epoch from v_until) * 1000) end
  );
end;
$$;

-- État de la licence sur le serveur (contrôle régulier par l'application).
create or replace function public.caisse_license_check(p_license text)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  l caisse_licenses%rowtype;
begin
  select * into l from caisse_licenses where license_id = upper(trim(coalesce(p_license, '')));
  if not found then return json_build_object('found', false); end if;
  return json_build_object(
    'found', true,
    'plan', case when l.revoked then 'aucun' else l.plan end,
    'revoked', l.revoked,
    'valid_until', case when l.valid_until is null then null else floor(extract(epoch from l.valid_until) * 1000) end
  );
end;
$$;

-- ---------- Fonctions du créateur (mot de passe obligatoire) ----------

create or replace function public.caisse_admin_login(p_password text)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  if not caisse_admin_ok(p_password) then return caisse_admin_error(); end if;
  return json_build_object('ok', true);
end;
$$;

create or replace function public.caisse_admin_dashboard(p_password text)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  if not caisse_admin_ok(p_password) then return caisse_admin_error(); end if;
  return json_build_object(
    'orders', coalesce((select json_agg(caisse_order_json(o) order by o.created_at desc)
                          from (select * from caisse_payment_orders order by created_at desc limit 500) o), '[]'::json),
    'licenses', coalesce((select json_agg(json_build_object(
                            'license_id', l.license_id, 'plan', l.plan, 'revoked', l.revoked,
                            'valid_until', case when l.valid_until is null then null else floor(extract(epoch from l.valid_until) * 1000) end,
                            'customer_name', l.customer_name, 'restaurant_name', l.restaurant_name,
                            'email', l.email, 'phone', l.phone, 'activations', l.activations,
                            'created_at', l.created_at, 'updated_at', l.updated_at
                          ) order by l.updated_at desc) from caisse_licenses l), '[]'::json),
    'billing', caisse_billing_json(),
    'now', floor(extract(epoch from now()) * 1000)
  );
end;
$$;

create or replace function public.caisse_admin_confirm(p_password text, p_order uuid, p_note text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  o caisse_payment_orders%rowtype;
begin
  if not caisse_admin_ok(p_password) then return caisse_admin_error(); end if;
  update caisse_payment_orders
     set status = 'confirmee', confirmed_at = now(), admin_note = left(coalesce(p_note, admin_note), 300)
   where id = p_order and status in ('en_attente', 'preuve_envoyee')
  returning * into o;
  if not found then return json_build_object('error', 'Commande introuvable ou déjà traitée.'); end if;
  -- Le client apparaît dans la liste des licences dès la confirmation.
  insert into caisse_licenses (license_id, customer_name, restaurant_name, email, phone)
  values (o.license_id, o.customer_name, o.restaurant_name, o.email, o.phone)
  on conflict (license_id) do update
    set customer_name = excluded.customer_name, restaurant_name = excluded.restaurant_name,
        email = excluded.email, phone = excluded.phone, updated_at = now();
  return json_build_object('order', caisse_order_json(o));
end;
$$;

create or replace function public.caisse_admin_reject(p_password text, p_order uuid, p_note text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  o caisse_payment_orders%rowtype;
begin
  if not caisse_admin_ok(p_password) then return caisse_admin_error(); end if;
  update caisse_payment_orders
     set status = 'refusee', closed_at = now(), admin_note = left(coalesce(p_note, admin_note), 300)
   where id = p_order and status in ('en_attente', 'preuve_envoyee')
  returning * into o;
  if not found then return json_build_object('error', 'Commande introuvable ou déjà traitée.'); end if;
  return json_build_object('order', caisse_order_json(o));
end;
$$;

-- Génère (ou régénère, tant qu'elle n'a pas servi) la clé d'une commande confirmée. La clé n'est montrée qu'ici.
create or replace function public.caisse_admin_generate_key(p_password text, p_order uuid)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  o caisse_payment_orders%rowtype;
  v_raw text;
  v_key text;
begin
  if not caisse_admin_ok(p_password) then return caisse_admin_error(); end if;
  select * into o from caisse_payment_orders where id = p_order for update;
  if not found then return json_build_object('error', 'Commande introuvable.'); end if;
  if o.status <> 'confirmee' then return json_build_object('error', 'Confirmez d’abord le paiement.'); end if;
  if o.key_redeemed_at is not null then return json_build_object('error', 'La clé de cette commande a déjà été activée.'); end if;
  v_raw := caisse_random_text(16);
  v_key := substr(v_raw, 1, 4) || '-' || substr(v_raw, 5, 4) || '-' || substr(v_raw, 9, 4) || '-' || substr(v_raw, 13, 4);
  update caisse_payment_orders
     set key_hash = caisse_sha256(v_key), key_hint = substr(v_raw, 13, 4), key_created_at = now()
   where id = o.id
  returning * into o;
  return json_build_object('key', v_key, 'order', caisse_order_json(o));
end;
$$;

create or replace function public.caisse_admin_license_action(p_password text, p_license text, p_action text)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  if not caisse_admin_ok(p_password) then return caisse_admin_error(); end if;
  if p_action = 'revoke' then
    update caisse_licenses set revoked = true, updated_at = now() where license_id = p_license;
  elsif p_action = 'restore' then
    update caisse_licenses set revoked = false, updated_at = now() where license_id = p_license;
  else
    return json_build_object('error', 'Action inconnue.');
  end if;
  if not found then return json_build_object('error', 'Licence introuvable.'); end if;
  return json_build_object('ok', true);
end;
$$;

create or replace function public.caisse_admin_update_billing(p_password text, p_billing jsonb)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_iban text := upper(regexp_replace(coalesce(p_billing->>'iban', ''), '\s', '', 'g'));
  v_whatsapp text := regexp_replace(coalesce(p_billing->>'whatsapp', ''), '[^0-9]', '', 'g');
  v_monthly int := (p_billing->>'price_monthly')::int;
  v_lifetime int := (p_billing->>'price_lifetime')::int;
begin
  if not caisse_admin_ok(p_password) then return caisse_admin_error(); end if;
  if v_iban !~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{8,30}$' then return json_build_object('error', 'IBAN invalide.'); end if;
  if length(v_whatsapp) < 8 or length(v_whatsapp) > 15 then return json_build_object('error', 'Numéro WhatsApp invalide (indicatif pays compris, ex. 32465…).'); end if;
  if v_monthly is null or v_monthly < 100 or v_lifetime is null or v_lifetime < 100 then
    return json_build_object('error', 'Prix invalides.');
  end if;
  update caisse_billing set
    business_name = left(trim(coalesce(p_billing->>'business_name', business_name)), 80),
    first_name = left(trim(coalesce(p_billing->>'first_name', first_name)), 60),
    last_name = left(trim(coalesce(p_billing->>'last_name', last_name)), 60),
    holder = left(trim(coalesce(p_billing->>'holder', holder)), 80),
    iban = v_iban, whatsapp = v_whatsapp,
    price_monthly = v_monthly, price_lifetime = v_lifetime, updated_at = now()
  where id = 1;
  return json_build_object('billing', caisse_billing_json());
end;
$$;

create or replace function public.caisse_admin_change_password(p_password text, p_new text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not caisse_admin_ok(p_password) then return caisse_admin_error(); end if;
  if p_new is null or length(p_new) < 10 then return json_build_object('error', 'Nouveau mot de passe trop court (10 caractères minimum).'); end if;
  update caisse_admin set password_hash = crypt(p_new, gen_salt('bf', 10)) where id = 1;
  return json_build_object('ok', true);
end;
$$;

-- ---------- Droits ----------

revoke execute on function public.caisse_random_text(int) from public, anon, authenticated;
revoke execute on function public.caisse_sha256(text) from public, anon, authenticated;
revoke execute on function public.caisse_admin_ok(text) from public, anon, authenticated;
revoke execute on function public.caisse_admin_error() from public, anon, authenticated;
revoke execute on function public.caisse_admin_set_password(text) from public, anon, authenticated;
revoke execute on function public.caisse_billing_json() from public, anon, authenticated;
revoke execute on function public.caisse_order_json(public.caisse_payment_orders) from public, anon, authenticated;

revoke execute on function public.caisse_billing_public() from public;
revoke execute on function public.caisse_create_payment_order(text, text, text, text, text, text) from public;
revoke execute on function public.caisse_payment_order_status(uuid, text) from public;
revoke execute on function public.caisse_payment_proof_sent(uuid, text) from public;
revoke execute on function public.caisse_payment_cancel(uuid, text) from public;
revoke execute on function public.caisse_redeem_key(text, text) from public;
revoke execute on function public.caisse_license_check(text) from public;
revoke execute on function public.caisse_admin_login(text) from public;
revoke execute on function public.caisse_admin_dashboard(text) from public;
revoke execute on function public.caisse_admin_confirm(text, uuid, text) from public;
revoke execute on function public.caisse_admin_reject(text, uuid, text) from public;
revoke execute on function public.caisse_admin_generate_key(text, uuid) from public;
revoke execute on function public.caisse_admin_license_action(text, text, text) from public;
revoke execute on function public.caisse_admin_update_billing(text, jsonb) from public;
revoke execute on function public.caisse_admin_change_password(text, text) from public;

grant execute on function public.caisse_billing_public() to anon, authenticated;
grant execute on function public.caisse_create_payment_order(text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.caisse_payment_order_status(uuid, text) to anon, authenticated;
grant execute on function public.caisse_payment_proof_sent(uuid, text) to anon, authenticated;
grant execute on function public.caisse_payment_cancel(uuid, text) to anon, authenticated;
grant execute on function public.caisse_redeem_key(text, text) to anon, authenticated;
grant execute on function public.caisse_license_check(text) to anon, authenticated;
grant execute on function public.caisse_admin_login(text) to anon, authenticated;
grant execute on function public.caisse_admin_dashboard(text) to anon, authenticated;
grant execute on function public.caisse_admin_confirm(text, uuid, text) to anon, authenticated;
grant execute on function public.caisse_admin_reject(text, uuid, text) to anon, authenticated;
grant execute on function public.caisse_admin_generate_key(text, uuid) to anon, authenticated;
grant execute on function public.caisse_admin_license_action(text, text, text) to anon, authenticated;
grant execute on function public.caisse_admin_update_billing(text, jsonb) to anon, authenticated;
grant execute on function public.caisse_admin_change_password(text, text) to anon, authenticated;
