begin;

-- Motolab. Aplicar uma vez em um projeto Supabase dedicado.
-- Valores monetários são inteiros em centavos. Datas de negócio usam date.
create table public.ml_workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 120),
  created_at timestamptz not null default now()
);
create table public.ml_members (
  workspace_id uuid not null references public.ml_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (workspace_id, user_id)
);
create index ml_members_user_idx on public.ml_members(user_id, workspace_id);

create table public.ml_campaigns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.ml_workspaces(id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 160),
  offer text not null check (offer in ('financiamento','consorcio','mista')),
  created_at timestamptz not null default now(),
  unique (workspace_id, id)
);
create unique index ml_campaigns_name_idx
  on public.ml_campaigns(workspace_id, lower(trim(name)));

create table public.ml_leads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.ml_workspaces(id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 120),
  phone text check (phone ~ '^[1-9][0-9]{9,14}$'),
  instagram text check (instagram ~ '^[A-Za-z0-9_.]{1,30}$'),
  region text check (length(region) <= 120),
  motorcycle text check (length(motorcycle) <= 120),
  source text not null default 'outro'
    check (source in ('meta','instagram','indicacao','loja','outro')),
  campaign_id uuid,
  stage text not null default 'novo'
    check (stage in ('novo','atendimento','proposta','acompanhamento','ganho','perdido')),
  qualified boolean not null default false,
  acquired_on date not null default ((now() at time zone 'America/Sao_Paulo')::date),
  outcome_reason text check (length(outcome_reason) <= 300),
  notes text check (length(notes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (phone is not null or instagram is not null),
  check (source = 'meta' or campaign_id is null),
  check (stage <> 'perdido' or length(trim(coalesce(outcome_reason,''))) > 0),
  unique (workspace_id, id),
  foreign key (workspace_id, campaign_id) references public.ml_campaigns(workspace_id,id)
);
create unique index ml_leads_phone_idx on public.ml_leads(workspace_id,phone) where phone is not null;
create index ml_leads_period_idx on public.ml_leads(workspace_id,acquired_on,stage);
create index ml_leads_campaign_idx on public.ml_leads(workspace_id,campaign_id) where campaign_id is not null;

create table public.ml_followups (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  lead_id uuid not null,
  due_on date not null,
  due_time time,
  note text check (length(note) <= 1000),
  state text not null default 'pendente' check (state in ('pendente','concluido','cancelado')),
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (workspace_id,lead_id) references public.ml_leads(workspace_id,id) on delete cascade
);
create unique index ml_followups_open_idx
  on public.ml_followups(workspace_id,lead_id) where state='pendente';
create index ml_followups_calendar_idx on public.ml_followups(workspace_id,state,due_on,due_time);
create index ml_followups_lead_idx on public.ml_followups(workspace_id,lead_id);

create table public.ml_sales (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  lead_id uuid not null,
  sold_on date not null,
  kind text not null check (kind in ('financiamento','consorcio','avista')),
  expected_cents integer not null check (expected_cents between 0 and 100000000),
  reason text not null check (length(trim(reason)) between 1 and 300),
  created_at timestamptz not null default now(),
  unique (workspace_id,id),
  unique (workspace_id,lead_id),
  foreign key (workspace_id,lead_id) references public.ml_leads(workspace_id,id)
);
create index ml_sales_period_idx on public.ml_sales(workspace_id,sold_on);

create table public.ml_receipts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  sale_id uuid not null,
  received_on date not null,
  cents integer not null check (cents between 1 and 100000000),
  note text check (length(note) <= 500),
  created_at timestamptz not null default now(),
  foreign key (workspace_id,sale_id) references public.ml_sales(workspace_id,id)
);
create index ml_receipts_sale_idx on public.ml_receipts(workspace_id,sale_id);
create index ml_receipts_period_idx on public.ml_receipts(workspace_id,received_on);

create table public.ml_spend (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  campaign_id uuid not null,
  spent_on date not null,
  media_cents integer not null default 0 check (media_cents between 0 and 100000000),
  direct_cents integer not null default 0 check (direct_cents between 0 and 100000000),
  conversations integer not null default 0 check (conversations >= 0),
  created_at timestamptz not null default now(),
  unique (workspace_id,campaign_id,spent_on),
  foreign key (workspace_id,campaign_id) references public.ml_campaigns(workspace_id,id)
);
create index ml_spend_period_idx on public.ml_spend(workspace_id,spent_on);

alter table public.ml_workspaces enable row level security;
alter table public.ml_members enable row level security;
create policy ml_members_read_own on public.ml_members for select to authenticated
  using (user_id = (select auth.uid()));
create policy ml_workspaces_read_member on public.ml_workspaces for select to authenticated
  using (id in (select workspace_id from public.ml_members where user_id = (select auth.uid())));
revoke all on public.ml_workspaces, public.ml_members from public, anon, authenticated;
grant select on public.ml_workspaces, public.ml_members to authenticated;

do $$
declare t text;
begin
  foreach t in array array['ml_campaigns','ml_leads','ml_followups','ml_sales','ml_receipts','ml_spend']
  loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public, anon, authenticated',t);
    execute format('grant select, insert on public.%I to authenticated',t);
    execute format('create policy member_read on public.%I for select to authenticated using
      (workspace_id in (select workspace_id from public.ml_members where user_id = (select auth.uid())))',t);
    execute format('create policy member_insert on public.%I for insert to authenticated with check
      (workspace_id in (select workspace_id from public.ml_members where user_id = (select auth.uid())))',t);
  end loop;
  foreach t in array array['ml_leads','ml_followups','ml_spend']
  loop
    execute format('create policy member_update on public.%I for update to authenticated using
      (workspace_id in (select workspace_id from public.ml_members where user_id = (select auth.uid())))
      with check (workspace_id in (select workspace_id from public.ml_members where user_id = (select auth.uid())))',t);
  end loop;
end
$$;
grant update (name,phone,instagram,region,motorcycle,source,campaign_id,stage,qualified,
  outcome_reason,notes) on public.ml_leads to authenticated;
grant update (state) on public.ml_followups to authenticated;
grant update (media_cents,direct_cents,conversations) on public.ml_spend to authenticated;

create function public.ml_guard_lead()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.stage='ganho' and not exists (
    select 1 from public.ml_sales s where s.workspace_id=new.workspace_id and s.lead_id=new.id
  ) then raise exception 'Registre a venda para marcar o lead como ganho.'; end if;
  if tg_op='UPDATE' then
    if old.stage='ganho' and row(new.stage,new.source,new.campaign_id)
        is distinct from row(old.stage,old.source,old.campaign_id) then
      raise exception 'A etapa e a atribuição da venda já foram registradas.';
    end if;
  end if;
  new.updated_at := now();
  return new;
end
$$;
create trigger ml_guard_lead before insert or update on public.ml_leads
  for each row execute function public.ml_guard_lead();

create function public.ml_cancel_closed_followups()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.stage in ('ganho','perdido') and new.stage is distinct from old.stage then
    update public.ml_followups set state='cancelado'
    where workspace_id=new.workspace_id and lead_id=new.id and state='pendente';
  end if;
  return new;
end
$$;
create trigger ml_cancel_closed_followups after update of stage on public.ml_leads
  for each row execute function public.ml_cancel_closed_followups();

create function public.ml_followup_guard()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare lead_stage text;
begin
  if tg_op='INSERT' or new.state='pendente' then
    select l.stage into lead_stage from public.ml_leads l
      where l.workspace_id=new.workspace_id and l.id=new.lead_id for update;
    if not found or lead_stage in ('ganho','perdido')
      then raise exception 'Agende apenas para um lead em aberto.'; end if;
  end if;
  new.finished_at := case when new.state='pendente' then null else coalesce(new.finished_at,now()) end;
  return new;
end
$$;
create trigger ml_followup_guard before insert or update on public.ml_followups
  for each row execute function public.ml_followup_guard();

create function public.ml_schedule(
  p_workspace uuid, p_lead uuid, p_due_on date, p_due_time time, p_note text
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare new_id uuid; current_stage text;
begin
  select stage into current_stage from public.ml_leads
    where id=p_lead and workspace_id=p_workspace for update;
  if not found or current_stage in ('ganho','perdido')
    then raise exception 'Lead em aberto não encontrado.'; end if;
  update public.ml_followups set state='cancelado'
    where workspace_id=p_workspace and lead_id=p_lead and state='pendente';
  insert into public.ml_followups(workspace_id,lead_id,due_on,due_time,note)
    values(p_workspace,p_lead,p_due_on,p_due_time,p_note) returning id into new_id;
  return new_id;
end
$$;
revoke all on function public.ml_schedule(uuid,uuid,date,time,text) from public, anon;
grant execute on function public.ml_schedule(uuid,uuid,date,time,text) to authenticated;

create function public.ml_sale_before_insert()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare acquired date; lead_stage text;
begin
  select l.acquired_on,l.stage into acquired,lead_stage from public.ml_leads l
    where l.workspace_id=new.workspace_id and l.id=new.lead_id for update;
  if not found or lead_stage in ('ganho','perdido')
    then raise exception 'Selecione um lead em aberto.'; end if;
  if new.sold_on > (now() at time zone 'America/Sao_Paulo')::date then raise exception 'Use a data de uma venda já realizada.'; end if;
  if new.sold_on<acquired then raise exception 'A venda não pode anteceder a entrada do lead.'; end if;
  return new;
end
$$;
create trigger ml_sale_before_insert before insert on public.ml_sales
  for each row execute function public.ml_sale_before_insert();

create function public.ml_sale_after_insert()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  update public.ml_leads set stage='ganho', outcome_reason=new.reason
    where id=new.lead_id and workspace_id=new.workspace_id;
  return new;
end
$$;
create trigger ml_sale_after_insert after insert on public.ml_sales
  for each row execute function public.ml_sale_after_insert();

create function public.ml_receipt_guard()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare expected integer; sold date; actual bigint;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.sale_id::text,0));
  select expected_cents,sold_on into expected,sold from public.ml_sales
    where id=new.sale_id and workspace_id=new.workspace_id;
  if not found then raise exception 'Venda não encontrada.'; end if;
  select coalesce(sum(cents),0) into actual from public.ml_receipts
    where sale_id=new.sale_id and workspace_id=new.workspace_id;
  if new.received_on > (now() at time zone 'America/Sao_Paulo')::date then raise exception 'Use a data de um valor já recebido.'; end if;
  if new.received_on<sold then raise exception 'O recebimento não pode anteceder a venda.'; end if;
  if new.cents+actual>expected then raise exception 'O valor ultrapassa o saldo da comissão.'; end if;
  return new;
end
$$;
create trigger ml_receipt_guard before insert on public.ml_receipts
  for each row execute function public.ml_receipt_guard();
revoke execute on function public.ml_guard_lead(), public.ml_cancel_closed_followups(),
  public.ml_followup_guard(), public.ml_sale_before_insert(), public.ml_sale_after_insert(),
  public.ml_receipt_guard() from public, anon, authenticated;

-- Evidências privadas. O caminho é <workspace id>/<lead id>/<arquivo>.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('motolab-evidencias','motolab-evidencias',false,5242880,
       array['image/jpeg','image/png','image/webp','application/pdf']);
create policy ml_evidence_read on storage.objects for select to authenticated using (
  bucket_id='motolab-evidencias' and exists (
    select 1 from public.ml_leads l
    where l.workspace_id::text=(storage.foldername(storage.objects.name))[1]
      and l.id::text=(storage.foldername(storage.objects.name))[2]
  )
);
create policy ml_evidence_insert on storage.objects for insert to authenticated with check (
  bucket_id='motolab-evidencias' and exists (
    select 1 from public.ml_leads l
    where l.workspace_id::text=(storage.foldername(storage.objects.name))[1]
      and l.id::text=(storage.foldername(storage.objects.name))[2]
  )
);

commit;
