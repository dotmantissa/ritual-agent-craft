
-- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  wallet_address text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles are viewable by everyone"
  on public.profiles for select using (true);
create policy "users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);
create policy "users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- agents
create table public.agents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'active' check (status in ('active','paused')),
  trigger jsonb not null default '{}'::jsonb,
  ai_prompt text,
  action jsonb not null default '{}'::jsonb,
  is_template boolean not null default false,
  forked_from uuid references public.agents(id) on delete set null,
  category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index agents_owner_idx on public.agents(owner_id);
create index agents_template_idx on public.agents(is_template) where is_template = true;

alter table public.agents enable row level security;

create policy "agents visible to owner or if template"
  on public.agents for select
  using (is_template = true or owner_id = auth.uid());
create policy "users can create own agents"
  on public.agents for insert
  with check (owner_id = auth.uid());
create policy "users can update own agents"
  on public.agents for update
  using (owner_id = auth.uid());
create policy "users can delete own agents"
  on public.agents for delete
  using (owner_id = auth.uid());

-- agent_runs
create table public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete cascade,
  triggered_at timestamptz not null default now(),
  trigger_payload jsonb not null default '{}'::jsonb,
  ai_decision jsonb,
  action_result jsonb,
  status text not null check (status in ('success','skipped','failed')),
  tx_hash text,
  created_at timestamptz not null default now()
);

create index agent_runs_agent_idx on public.agent_runs(agent_id, created_at desc);
create index agent_runs_owner_idx on public.agent_runs(owner_id, created_at desc);

alter table public.agent_runs enable row level security;

create policy "users see runs for their agents"
  on public.agent_runs for select
  using (owner_id = auth.uid());
create policy "users can insert runs for their agents"
  on public.agent_runs for insert
  with check (owner_id = auth.uid());

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger agents_set_updated_at
  before update on public.agents
  for each row execute function public.set_updated_at();

-- auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, wallet_address)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', 'Agent Operator'),
    new.raw_user_meta_data->>'wallet_address'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- enable realtime on agent_runs for live log streaming
alter publication supabase_realtime add table public.agent_runs;
