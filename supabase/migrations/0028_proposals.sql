-- ADEX Mission Control — 0028: proposals
--
-- Connor's placement, and the right one: a proposal belongs to an opportunity,
-- and "has it gone out?" is a pipeline question.
--
-- Sometimes a proposal is a simple email offer; sometimes it is a deck like
-- Benson Goldstein or Affinity Water. Both are recorded the same way, because
-- the question the CRM has to answer is the same either way: what did we
-- propose, which version, when did it go, and what came of it.
--
-- WHAT IS STORED: the content, as structure, not the finished file. The deck
-- is rebuilt from it on demand. That keeps the rows small, and means an
-- improvement to the template reaches every proposal rather than only new
-- ones. The exact file a client received is in the sender's own sent mail,
-- which is the better record of what was actually sent anyway.
--
-- Safe to re-run.

create table if not exists proposals (
  id uuid primary key default gen_random_uuid(),
  -- The opportunity it is for. Kept when the opportunity is deleted so the
  -- history of what was proposed does not vanish with it.
  lead_id uuid references leads (id) on delete set null,
  organisation_id uuid not null references organisations (id) on delete cascade,
  title text not null,
  -- 'email' for a written offer, 'deck' for a presentation.
  kind text not null default 'deck' check (kind in ('email', 'deck')),
  status text not null default 'Draft'
    check (status in ('Draft', 'Sent', 'Won', 'Lost', 'Superseded')),
  -- Benson Goldstein reached v7, so versions are normal, not exceptional.
  version integer not null default 1,
  /* The deck specification, or the email body. Shaped by lib/proposal-theme. */
  content jsonb not null default '{}'::jsonb,
  owner_id uuid references profiles (id),
  sent_at timestamptz,
  sent_by uuid references profiles (id),
  /* How it was marked sent: by a person, or noticed in the outbound mail. */
  sent_detected_from text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists proposals_lead_idx on proposals (lead_id);
create index if not exists proposals_org_idx on proposals (organisation_id, created_at desc);
create index if not exists proposals_status_idx on proposals (status);

alter table proposals enable row level security;

-- Connor: owners and admins. An admin sees everything; everyone else sees the
-- proposals they own. Restricted users see none.
drop policy if exists "proposals for owners and admins" on proposals;
create policy "proposals for owners and admins" on proposals for all to authenticated
  using (not is_restricted() and (is_admin() or owner_id = auth.uid() or created_by = auth.uid()))
  with check (not is_restricted() and (is_admin() or owner_id = auth.uid() or created_by = auth.uid()));

-- Keep updated_at honest without the app having to remember.
create or replace function touch_proposal()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end; $$;

drop trigger if exists proposals_touch on proposals;
create trigger proposals_touch before update on proposals
  for each row execute function touch_proposal();

notify pgrst, 'reload schema';
select '0028_proposals complete' as result;
