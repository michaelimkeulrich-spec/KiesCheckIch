-- KiesCheckIch V2.3: Einladung eines weiteren Elternteils zu einer bestehenden Familie.
-- In Supabase SQL Editor EINMAL ausführen. Bestehende Familien und Buchungen bleiben unverändert.
create table if not exists public.kc_parent_join_invites (
 token_hash bytea primary key,
 family_id uuid not null references public.kc_families(id) on delete cascade,
 invited_email text not null,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null,
 accepted_at timestamptz,
 accepted_by uuid references auth.users(id)
);
alter table public.kc_parent_join_invites enable row level security;
revoke all on public.kc_parent_join_invites from anon, authenticated;

create or replace function public.kc_invite_second_parent(p_family uuid, p_email text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid()); v_email text := lower(btrim(p_email)); v_token text;
begin
 if v_actor is null then raise exception 'Bitte anmelden'; end if;
 if not exists(select 1 from public.kc_family_parents where family_id=p_family and user_id=v_actor) then raise exception 'Keine Berechtigung für diese Familie'; end if;
 if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(v_email)>254 then raise exception 'Ungültige E-Mail-Adresse'; end if;
 if exists(select 1 from auth.users where id=v_actor and lower(email)=v_email) then raise exception 'Du bist bereits Mitglied dieser Familie'; end if;
 if exists(select 1 from public.kc_family_parents fp join auth.users u on u.id=fp.user_id where fp.family_id=p_family and lower(u.email)=v_email) then raise exception 'Dieser Elternteil ist bereits Mitglied'; end if;
 v_token:=encode(gen_random_bytes(32),'hex');
 insert into public.kc_parent_join_invites(token_hash,family_id,invited_email,created_by,expires_at)
 values (sha256(decode(v_token,'hex')),p_family,v_email,v_actor,now()+interval '7 days');
 return v_token;
end $$;

create or replace function public.kc_accept_second_parent(p_token text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid()); v_email text; v_inv public.kc_parent_join_invites%rowtype;
begin
 if v_actor is null then raise exception 'Bitte anmelden'; end if;
 select lower(email) into v_email from auth.users where id=v_actor and email_confirmed_at is not null;
 if v_email is null then raise exception 'Bitte zuerst E-Mail-Adresse bestätigen'; end if;
 if p_token !~ '^[0-9a-f]{64}$' then raise exception 'Ungültiger Einladungslink'; end if;
 select * into v_inv from public.kc_parent_join_invites
 where token_hash=sha256(decode(p_token,'hex')) and accepted_at is null and expires_at>now() for update;
 if not found then raise exception 'Einladung ungültig oder abgelaufen'; end if;
 if v_inv.invited_email<>v_email then raise exception 'Einladung gilt für eine andere E-Mail-Adresse'; end if;
 insert into public.kc_family_parents(family_id,user_id) values(v_inv.family_id,v_actor)
 on conflict (family_id,user_id) do nothing;
 update public.kc_parent_join_invites set accepted_at=now(),accepted_by=v_actor where token_hash=v_inv.token_hash;
 return 'Elternkonto erfolgreich mit Familie verbunden';
end $$;
revoke all on function public.kc_invite_second_parent(uuid,text) from public, anon;
revoke all on function public.kc_accept_second_parent(text) from public, anon;
grant execute on function public.kc_invite_second_parent(uuid,text) to authenticated;
grant execute on function public.kc_accept_second_parent(text) to authenticated;
