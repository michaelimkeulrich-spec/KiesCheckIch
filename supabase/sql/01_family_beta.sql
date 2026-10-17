-- KiesCheckIch Family Beta. In Supabase SQL Editor ausführen, nach Backup.
-- Bestehende Finanz-Tabellen bleiben erhalten.
create table if not exists public.kc_families (
 id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 1 and 80),
 created_at timestamptz not null default now()
);
create table if not exists public.kc_family_parents (
 family_id uuid not null references public.kc_families(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 primary key(family_id,user_id)
);
create table if not exists public.kc_family_children (
 family_id uuid not null references public.kc_families(id) on delete cascade,
 user_id uuid not null unique references auth.users(id) on delete cascade,
 birth_date date not null,
 created_at timestamptz not null default now(), primary key(family_id,user_id)
);
create table if not exists public.kc_invitations (
 id uuid primary key default gen_random_uuid(), token_hash text not null unique,
 email text not null, kind text not null check(kind in ('parent','child')),
 family_id uuid references public.kc_families(id) on delete cascade,
 created_by uuid not null references auth.users(id),
 expires_at timestamptz not null, used_at timestamptz,
 created_at timestamptz not null default now(),
 check ((kind='parent' and family_id is null) or (kind='child' and family_id is not null))
);
create table if not exists public.kc_feedback (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 category text not null check(category in ('lob','idee','unklar','fehler')),
 message text not null check(length(trim(message)) between 3 and 2000),
 state text not null default 'offen' check(state in ('offen','in_arbeit','erledigt')),
 created_at timestamptz not null default now()
);
create table if not exists public.kc_admin_audit (
 id bigint generated always as identity primary key,
 actor_id uuid, action text not null, target_id uuid,
 created_at timestamptz not null default now()
);

alter table public.kc_families enable row level security;
alter table public.kc_family_parents enable row level security;
alter table public.kc_family_children enable row level security;
alter table public.kc_invitations enable row level security;
alter table public.kc_feedback enable row level security;
alter table public.kc_admin_audit enable row level security;

-- Nur Edge Function (service_role) darf Einladungen und Audit lesen/schreiben.
revoke all on public.kc_invitations, public.kc_admin_audit from anon, authenticated;
revoke all on public.kc_families, public.kc_family_parents, public.kc_family_children from anon;
grant select on public.kc_families, public.kc_family_parents, public.kc_family_children to authenticated;
grant select, insert on public.kc_feedback to authenticated;
grant select, update on public.kc_feedback to authenticated;

create policy kc_parents_own on public.kc_family_parents for select to authenticated
 using(user_id=(select auth.uid()));
create policy kc_children_parent_view on public.kc_family_children for select to authenticated
 using(user_id=(select auth.uid()) or exists(
 select 1 from public.kc_family_parents p where p.family_id=kc_family_children.family_id and p.user_id=(select auth.uid())
 ));
create policy kc_family_parent_view on public.kc_families for select to authenticated
 using(exists(select 1 from public.kc_family_parents p where p.family_id=kc_families.id and p.user_id=(select auth.uid()))
 or exists(select 1 from public.kc_family_children c where c.family_id=kc_families.id and c.user_id=(select auth.uid())));
create policy kc_feedback_own_read on public.kc_feedback for select to authenticated
 using(user_id=(select auth.uid()) or exists(select 1 from public.app_admins a where a.user_id=(select auth.uid())));
create policy kc_feedback_own_insert on public.kc_feedback for insert to authenticated
 with check(user_id=(select auth.uid()));
create policy kc_feedback_admin_update on public.kc_feedback for update to authenticated
 using(exists(select 1 from public.app_admins a where a.user_id=(select auth.uid())))
 with check(exists(select 1 from public.app_admins a where a.user_id=(select auth.uid())));

-- Eltern dürfen die Finanzdaten verknüpfter minderjähriger Kinder lesen, nicht ändern.
-- Volljährige Kinder sind nur mit separater expliziter Freigabe zugänglich (nicht Teil von Beta 1).
create policy kc_parent_read_transactions on public.transactions for select to authenticated
 using(exists(select 1 from public.kc_family_children c
 join public.kc_family_parents p on p.family_id=c.family_id
 where c.user_id=transactions.user_id and p.user_id=(select auth.uid())
 and c.birth_date > (current_date - interval '18 years')::date));
create policy kc_parent_read_goals on public.savings_goals for select to authenticated
 using(exists(select 1 from public.kc_family_children c
 join public.kc_family_parents p on p.family_id=c.family_id
 where c.user_id=savings_goals.user_id and p.user_id=(select auth.uid())
 and c.birth_date > (current_date - interval '18 years')::date));
create policy kc_parent_read_budgets on public.budgets for select to authenticated
 using(exists(select 1 from public.kc_family_children c
 join public.kc_family_parents p on p.family_id=c.family_id
 where c.user_id=budgets.user_id and p.user_id=(select auth.uid())
 and c.birth_date > (current_date - interval '18 years')::date));

-- Kein öffentlicher Schreibzugriff auf Familienbeziehungen.
-- Nur serverseitig mit verifizierter Rolle anlegen.

create table if not exists public.kc_allowances (
 child_id uuid primary key references auth.users(id) on delete cascade,
 monthly_cents bigint not null default 0 check(monthly_cents>=0),
 updated_by uuid references auth.users(id) on delete set null,
 updated_at timestamptz not null default now()
);
alter table public.kc_allowances enable row level security;
grant select on public.kc_allowances to authenticated;
create policy kc_allowance_read on public.kc_allowances for select to authenticated
 using(child_id=(select auth.uid()) or exists(select 1 from public.kc_family_children c
 join public.kc_family_parents p on p.family_id=c.family_id
 where c.user_id=kc_allowances.child_id and p.user_id=(select auth.uid())
 and c.birth_date > (current_date - interval '18 years')::date));

create table if not exists public.kc_child_setups (
 child_id uuid primary key references auth.users(id) on delete cascade,
 configured_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now()
);
alter table public.kc_child_setups enable row level security;
revoke all on public.kc_child_setups from anon, authenticated;
