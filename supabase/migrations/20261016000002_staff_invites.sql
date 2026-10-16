-- Staff invitations: teachers, coordinators and administrators aren't on the student
-- register, so the college desk invites them by email, with the role they'll have.
-- Runs after 20261016000001; safe to run again.

create table if not exists staff_invites (
  email text primary key,
  name text not null,
  role text not null check (role in ('faculty', 'coordinator', 'admin')),
  branch text,
  branch_name text,
  invited_by bigint references users(id) on delete set null,
  created_at bigint not null,
  expires_at bigint not null,
  used_at bigint
);

-- A staff member's join is checked against their invitation, like a student's against the register.
alter table auth_intents drop constraint if exists auth_intents_purpose_check;
alter table auth_intents add constraint auth_intents_purpose_check check (purpose in ('join', 'reset', 'staff'));

alter table staff_invites enable row level security;
