-- Stand With Them: production schema, access controls, and atomic workflows.
-- Apply with the Supabase CLI after reviewing the target project.

create extension if not exists pgcrypto with schema extensions;

do $$ begin
  create type public.admin_role as enum ('super_administrator', 'payment_reviewer', 'fulfilment_manager');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.soldier_status as enum ('active', 'inactive');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.donation_kind as enum ('soldier', 'general');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.payment_method as enum ('gift_card', 'cryptocurrency');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.payment_status as enum ('pending', 'confirmed', 'declined');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.fulfilment_status as enum (
    'awaiting_payment_confirmation', 'awaiting_allocation', 'funds_allocated',
    'purchase_in_progress', 'awaiting_delivery', 'delivered',
    'unable_to_fulfil', 'cancelled'
  );
exception when duplicate_object then null; end $$;

create sequence if not exists public.receipt_number_seq start 1;

create table if not exists public.admin_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.admin_role not null,
  display_name text not null check (char_length(display_name) between 2 and 120),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  name text not null check (char_length(name) between 2 and 100),
  description text not null check (char_length(description) between 10 and 1000),
  icon text not null default 'package',
  active boolean not null default true,
  allows_soldier boolean not null default true,
  allows_general boolean not null default true,
  suggested_amounts_minor integer[] not null default array[2500, 5000, 10000],
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (array_length(suggested_amounts_minor, 1) is null or
    (0 < all(suggested_amounts_minor) and 100000000 >= all(suggested_amounts_minor)))
);

create table if not exists public.soldiers (
  id uuid primary key default gen_random_uuid(),
  tag text not null unique check (tag ~ '^SLD-[A-HJ-NP-Z2-9]{8}$'),
  private_identifier text not null check (char_length(private_identifier) between 2 and 120),
  mobile_number_ciphertext text,
  status public.soldier_status not null default 'active',
  internal_notes text check (internal_notes is null or char_length(internal_notes) <= 2000),
  created_by uuid not null references public.admin_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deactivated_at timestamptz,
  deactivated_by uuid references public.admin_profiles(id)
);

create table if not exists public.soldier_category_eligibility (
  soldier_id uuid not null references public.soldiers(id) on delete cascade,
  category_id uuid not null references public.support_categories(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (soldier_id, category_id)
);

create table if not exists public.donations (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique check (reference ~ '^DON-[0-9]{8}-[A-HJ-NP-Z2-9]{8}$'),
  kind public.donation_kind not null,
  soldier_id uuid references public.soldiers(id) on delete restrict,
  soldier_tag_snapshot text,
  category_id uuid not null references public.support_categories(id) on delete restrict,
  amount_minor bigint not null check (amount_minor between 100 and 100000000),
  currency char(3) not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  donor_name text check (donor_name is null or char_length(donor_name) <= 100),
  donor_email text check (donor_email is null or char_length(donor_email) <= 254),
  access_code_hash bytea not null unique,
  payment_status public.payment_status not null default 'pending',
  fulfilment_status public.fulfilment_status not null default 'awaiting_payment_confirmation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind = 'soldier' and soldier_id is not null and soldier_tag_snapshot is not null)
    or (kind = 'general' and soldier_id is null and soldier_tag_snapshot is null))
);

create table if not exists public.payment_options (
  id uuid primary key default gen_random_uuid(),
  method public.payment_method not null,
  label text not null check (char_length(label) between 2 and 100),
  instructions text not null check (char_length(instructions) between 5 and 2000),
  config jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references public.admin_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_submissions (
  id uuid primary key default gen_random_uuid(),
  donation_id uuid not null unique references public.donations(id) on delete restrict,
  method public.payment_method not null,
  payment_option_id uuid not null references public.payment_options(id) on delete restrict,
  gift_card_code_ciphertext text,
  transaction_hash text,
  status public.payment_status not null default 'pending',
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references public.admin_profiles(id),
  reviewed_at timestamptz,
  review_notes text check (review_notes is null or char_length(review_notes) <= 2000),
  decline_reason text check (decline_reason is null or char_length(decline_reason) <= 500),
  check (
    (method = 'gift_card' and gift_card_code_ciphertext is not null and transaction_hash is null)
    or (method = 'cryptocurrency' and transaction_hash is not null and gift_card_code_ciphertext is null)
  ),
  check ((status = 'pending' and reviewed_by is null and reviewed_at is null)
    or (status <> 'pending' and reviewed_by is not null and reviewed_at is not null)),
  check (status <> 'declined' or decline_reason is not null)
);

create table if not exists public.payment_evidence (
  id uuid primary key default gen_random_uuid(),
  payment_submission_id uuid not null references public.payment_submissions(id) on delete cascade,
  bucket_name text not null default 'payment-evidence',
  object_path text not null unique,
  original_filename text not null,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp','application/pdf')),
  size_bytes bigint not null check (size_bytes between 1 and 5242880),
  uploaded_at timestamptz not null default now()
);

create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  donation_id uuid not null unique references public.donations(id) on delete restrict,
  receipt_number text not null unique check (receipt_number ~ '^STW-[0-9]{4}-[0-9]{6,}$'),
  verification_code_hash bytea not null unique,
  generated_at timestamptz not null default now()
);

create table if not exists public.fund_allocations (
  id uuid primary key default gen_random_uuid(),
  donation_id uuid not null references public.donations(id) on delete restrict,
  amount_minor bigint not null check (amount_minor > 0),
  notes text check (notes is null or char_length(notes) <= 2000),
  allocated_by uuid not null references public.admin_profiles(id),
  allocated_at timestamptz not null default now()
);

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  donation_id uuid not null references public.donations(id) on delete restrict,
  allocation_id uuid references public.fund_allocations(id) on delete restrict,
  items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) > 0),
  actual_cost_minor bigint not null check (actual_cost_minor >= 0),
  provider_reference text check (provider_reference is null or char_length(provider_reference) <= 200),
  purchased_at timestamptz not null default now(),
  recorded_by uuid not null references public.admin_profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.volunteer_assignments (
  id uuid primary key default gen_random_uuid(),
  donation_id uuid not null references public.donations(id) on delete restrict,
  volunteer_reference text not null check (char_length(volunteer_reference) between 2 and 120),
  assignment_notes text check (assignment_notes is null or char_length(assignment_notes) <= 1000),
  assigned_by uuid not null references public.admin_profiles(id),
  assigned_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.fulfilment_records (
  id uuid primary key default gen_random_uuid(),
  donation_id uuid not null references public.donations(id) on delete restrict,
  status public.fulfilment_status not null,
  note text not null check (char_length(note) between 2 and 2000),
  confirmed_by uuid not null references public.admin_profiles(id),
  confirmed_at timestamptz not null default now()
);

create table if not exists public.fulfilment_evidence (
  id uuid primary key default gen_random_uuid(),
  donation_id uuid not null references public.donations(id) on delete restrict,
  bucket_name text not null default 'fulfilment-evidence',
  object_path text not null unique,
  original_filename text not null,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp','application/pdf')),
  size_bytes bigint not null check (size_bytes between 1 and 5242880),
  uploaded_by uuid not null references public.admin_profiles(id),
  uploaded_at timestamptz not null default now()
);

create table if not exists public.fulfilment_events (
  id bigint generated always as identity primary key,
  donation_id uuid not null references public.donations(id) on delete cascade,
  event_type text not null,
  public_description text not null check (char_length(public_description) between 2 and 500),
  event_at timestamptz not null default now(),
  created_by uuid references public.admin_profiles(id)
);

create table if not exists public.general_fund_transactions (
  id uuid primary key default gen_random_uuid(),
  donation_id uuid references public.donations(id) on delete restrict,
  transaction_type text not null check (transaction_type in ('contribution','allocation','expenditure','refund','adjustment')),
  amount_minor bigint not null check (amount_minor <> 0),
  description text not null check (char_length(description) between 2 and 1000),
  recorded_by uuid references public.admin_profiles(id),
  recorded_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.admin_profiles(id),
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  key text primary key check (key ~ '^[a-z0-9_.-]{2,100}$'),
  value jsonb not null,
  public boolean not null default false,
  updated_by uuid references public.admin_profiles(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.public_rate_limits (
  scope text not null,
  key_hash text not null,
  window_started_at timestamptz not null,
  request_count integer not null check (request_count > 0),
  primary key (scope, key_hash)
);

create index if not exists donations_created_idx on public.donations(created_at desc);
create index if not exists donations_status_idx on public.donations(payment_status, fulfilment_status);
create index if not exists donations_soldier_idx on public.donations(soldier_id, created_at desc);
create index if not exists payment_status_idx on public.payment_submissions(status, submitted_at desc);
create index if not exists allocations_donation_idx on public.fund_allocations(donation_id);
create index if not exists purchases_donation_idx on public.purchases(donation_id);
create index if not exists fulfilment_events_donation_idx on public.fulfilment_events(donation_id, event_at);
create index if not exists audit_logs_entity_idx on public.audit_logs(entity_type, entity_id, created_at desc);
create index if not exists rate_limits_window_idx on public.public_rate_limits(window_started_at);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists admin_profiles_updated_at on public.admin_profiles;
create trigger admin_profiles_updated_at before update on public.admin_profiles
for each row execute function public.set_updated_at();
drop trigger if exists support_categories_updated_at on public.support_categories;
create trigger support_categories_updated_at before update on public.support_categories
for each row execute function public.set_updated_at();
drop trigger if exists soldiers_updated_at on public.soldiers;
create trigger soldiers_updated_at before update on public.soldiers
for each row execute function public.set_updated_at();
drop trigger if exists donations_updated_at on public.donations;
create trigger donations_updated_at before update on public.donations
for each row execute function public.set_updated_at();
drop trigger if exists payment_options_updated_at on public.payment_options;
create trigger payment_options_updated_at before update on public.payment_options
for each row execute function public.set_updated_at();

create or replace function public.consume_public_rate_limit(
  p_scope text, p_key_hash text, p_limit integer, p_window_seconds integer
) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_count integer; v_started timestamptz;
begin
  if p_limit < 1 or p_window_seconds < 1 then return false; end if;
  insert into public.public_rate_limits(scope, key_hash, window_started_at, request_count)
  values (p_scope, p_key_hash, now(), 1)
  on conflict (scope, key_hash) do update set
    window_started_at = case
      when public.public_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds)
      then now() else public.public_rate_limits.window_started_at end,
    request_count = case
      when public.public_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds)
      then 1 else public.public_rate_limits.request_count + 1 end
  returning request_count, window_started_at into v_count, v_started;
  return v_count <= p_limit and v_started > now() - make_interval(secs => p_window_seconds);
end; $$;

create or replace function public.register_soldier(
  p_admin_id uuid, p_private_identifier text, p_mobile_ciphertext text,
  p_notes text, p_category_ids uuid[]
) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v_tag text; v_id uuid; v_role public.admin_role; v_attempt integer := 0;
begin
  select role into v_role from public.admin_profiles where id = p_admin_id and active;
  if v_role is null or v_role not in ('super_administrator','fulfilment_manager') then raise exception 'forbidden'; end if;
  if coalesce(array_length(p_category_ids,1),0) = 0 then raise exception 'category_required'; end if;
  if exists(
    select 1 from unnest(p_category_ids) requested(id)
    left join public.support_categories c on c.id=requested.id and c.active and c.allows_soldier
    where c.id is null
  ) then raise exception 'invalid_categories'; end if;
  loop
    v_attempt := v_attempt + 1;
    v_tag := 'SLD-' || upper(substr(translate(encode(gen_random_bytes(8),'base64'), '/+=01IO', 'ABCDEFG'),1,8));
    v_tag := regexp_replace(v_tag, '[^A-HJ-NP-Z2-9]', 'K', 'g');
    exit when not exists(select 1 from public.soldiers where tag = v_tag);
    if v_attempt > 10 then raise exception 'tag_generation_failed'; end if;
  end loop;
  insert into public.soldiers(tag, private_identifier, mobile_number_ciphertext, internal_notes, created_by)
  values (v_tag, trim(p_private_identifier), nullif(p_mobile_ciphertext,''), nullif(trim(p_notes),''), p_admin_id)
  returning id into v_id;
  insert into public.soldier_category_eligibility(soldier_id, category_id)
  select v_id, id from public.support_categories where id = any(p_category_ids) and active and allows_soldier;
  if not found then raise exception 'invalid_categories'; end if;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (p_admin_id, 'soldier.registered', 'soldier', v_id::text, jsonb_build_object('tag',v_tag));
  return jsonb_build_object('id',v_id,'tag',v_tag);
end; $$;

create or replace function public.validate_soldier_tag(p_tag text, p_category_slug text default null)
returns jsonb language sql security definer set search_path = public as $$
  select case when exists(
    select 1 from public.soldiers s
    join public.soldier_category_eligibility e on e.soldier_id=s.id
    join public.support_categories c on c.id=e.category_id
    where s.tag=upper(trim(p_tag)) and s.status='active' and c.active
      and (p_category_slug is null or c.slug=p_category_slug)
  ) then jsonb_build_object('valid',true,'tag',upper(trim(p_tag)))
  else jsonb_build_object('valid',false) end;
$$;

create or replace function public.create_donation_draft(
  p_kind text, p_soldier_tag text, p_category_slug text, p_amount_minor bigint,
  p_currency text, p_donor_name text, p_donor_email text
) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v_kind public.donation_kind; v_category public.support_categories; v_soldier public.soldiers;
  v_access text; v_reference text; v_id uuid;
begin
  v_kind := p_kind::public.donation_kind;
  if p_amount_minor < 100 or p_amount_minor > 100000000 then raise exception 'invalid_amount'; end if;
  if upper(p_currency) <> 'USD' then raise exception 'unsupported_currency'; end if;
  select * into v_category from public.support_categories
  where slug=p_category_slug and active and ((v_kind='soldier' and allows_soldier) or (v_kind='general' and allows_general));
  if not found then raise exception 'category_unavailable'; end if;
  if v_kind='soldier' then
    select s.* into v_soldier from public.soldiers s
    join public.soldier_category_eligibility e on e.soldier_id=s.id and e.category_id=v_category.id
    where s.tag=upper(trim(p_soldier_tag)) and s.status='active';
    if not found then raise exception 'tag_unavailable'; end if;
  end if;
  v_access := upper(encode(gen_random_bytes(18),'hex'));
  v_reference := 'DON-' || to_char(now() at time zone 'UTC','YYYYMMDD') || '-' ||
    upper(substr(translate(encode(gen_random_bytes(8),'base64'), '/+=01IO', 'ABCDEFG'),1,8));
  v_reference := regexp_replace(v_reference, '[^A-Z0-9-]', 'K', 'g');
  insert into public.donations(reference,kind,soldier_id,soldier_tag_snapshot,category_id,
    amount_minor,currency,donor_name,donor_email,access_code_hash)
  values(v_reference,v_kind,case when v_kind='soldier' then v_soldier.id end,
    case when v_kind='soldier' then v_soldier.tag end,v_category.id,p_amount_minor,upper(p_currency),
    nullif(trim(p_donor_name),''),nullif(lower(trim(p_donor_email)),''),digest(v_access,'sha256'))
  returning id into v_id;
  insert into public.fulfilment_events(donation_id,event_type,public_description)
  values(v_id,'donation_started','Donation details were recorded; payment submission is still required.');
  return jsonb_build_object('donationId',v_id,'reference',v_reference,'accessCode',v_access);
end; $$;

create or replace function public.get_donation_payment_context(p_donation_id uuid, p_access_code text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_result jsonb;
begin
  select jsonb_build_object(
    'id',d.id,'reference',d.reference,'kind',d.kind,'soldierTag',d.soldier_tag_snapshot,
    'categoryName',c.name,'amountMinor',d.amount_minor,'currency',d.currency,
    'paymentSubmitted',exists(select 1 from public.payment_submissions ps where ps.donation_id=d.id),
    'paymentOptions',coalesce((select jsonb_agg(jsonb_build_object(
      'id',po.id,'method',po.method,'label',po.label,'instructions',po.instructions,'config',po.config
    ) order by po.sort_order,po.label) from public.payment_options po where po.active),'[]'::jsonb)
  ) into v_result
  from public.donations d join public.support_categories c on c.id=d.category_id
  where d.id=p_donation_id and d.access_code_hash=digest(p_access_code,'sha256');
  if v_result is null then raise exception 'not_found'; end if;
  return v_result;
end; $$;

create or replace function public.submit_payment(
  p_donation_id uuid, p_access_code text, p_method text, p_payment_option_id uuid,
  p_gift_code_ciphertext text, p_transaction_hash text,
  p_evidence_path text, p_evidence_name text, p_evidence_mime text, p_evidence_size bigint
) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v_donation public.donations; v_option public.payment_options; v_payment_id uuid;
  v_receipt text; v_verification text;
begin
  select * into v_donation from public.donations where id=p_donation_id
    and access_code_hash=digest(p_access_code,'sha256') for update;
  if not found then raise exception 'not_found'; end if;
  if exists(select 1 from public.payment_submissions where donation_id=p_donation_id) then raise exception 'already_submitted'; end if;
  select * into v_option from public.payment_options where id=p_payment_option_id and active and method=p_method::public.payment_method;
  if not found then raise exception 'payment_option_unavailable'; end if;
  if p_method='gift_card' and nullif(p_gift_code_ciphertext,'') is null then raise exception 'gift_code_required'; end if;
  if p_method='cryptocurrency' and nullif(p_transaction_hash,'') is null then raise exception 'transaction_hash_required'; end if;
  insert into public.payment_submissions(donation_id,method,payment_option_id,gift_card_code_ciphertext,transaction_hash)
  values(p_donation_id,p_method::public.payment_method,p_payment_option_id,
    case when p_method='gift_card' then p_gift_code_ciphertext end,
    case when p_method='cryptocurrency' then p_transaction_hash end)
  returning id into v_payment_id;
  if p_evidence_path is not null then
    insert into public.payment_evidence(payment_submission_id,object_path,original_filename,mime_type,size_bytes)
    values(v_payment_id,p_evidence_path,p_evidence_name,p_evidence_mime,p_evidence_size);
  end if;
  v_receipt := 'STW-' || to_char(now() at time zone 'UTC','YYYY') || '-' || lpad(nextval('public.receipt_number_seq')::text,6,'0');
  v_verification := upper(encode(gen_random_bytes(16),'hex'));
  insert into public.receipts(donation_id,receipt_number,verification_code_hash)
  values(p_donation_id,v_receipt,digest(v_verification,'sha256'));
  insert into public.fulfilment_events(donation_id,event_type,public_description)
  values(p_donation_id,'payment_submitted','Payment evidence was submitted and is awaiting administrative verification.');
  return jsonb_build_object('donationId',p_donation_id,'reference',v_donation.reference,
    'receiptNumber',v_receipt,'verificationCode',v_verification,'accessCode',p_access_code);
end; $$;

create or replace function public.public_verify_receipt(p_verification_code text)
returns jsonb language sql security definer set search_path = public, extensions as $$
  select jsonb_build_object(
    'donation_id',d.id,'receipt_number',r.receipt_number,'donation_reference',d.reference,
    'donation_date',d.created_at,'soldier_tag',d.soldier_tag_snapshot,'category_name',c.name,
    'amount_minor',d.amount_minor,'currency',d.currency,'payment_method',ps.method,
    'payment_status',ps.status,'generated_at',r.generated_at
  ) from public.receipts r join public.donations d on d.id=r.donation_id
  join public.support_categories c on c.id=d.category_id
  join public.payment_submissions ps on ps.donation_id=d.id
  where r.verification_code_hash=digest(upper(trim(p_verification_code)),'sha256');
$$;

create or replace function public.public_get_receipt(p_donation_id uuid, p_verification_code text)
returns jsonb language sql security definer set search_path = public, extensions as $$
  select jsonb_build_object(
    'donation_id',d.id,'receipt_number',r.receipt_number,'donation_reference',d.reference,
    'donation_date',d.created_at,'soldier_tag',d.soldier_tag_snapshot,'category_name',c.name,
    'amount_minor',d.amount_minor,'currency',d.currency,'payment_method',ps.method,
    'payment_status',ps.status,'generated_at',r.generated_at
  ) from public.donations d join public.receipts r on r.donation_id=d.id
  join public.support_categories c on c.id=d.category_id
  join public.payment_submissions ps on ps.donation_id=d.id
  where d.id=p_donation_id and r.verification_code_hash=digest(upper(trim(p_verification_code)),'sha256');
$$;

create or replace function public.public_track_donation(p_reference text, p_access_code text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_result jsonb;
begin
  select jsonb_build_object(
    'reference',d.reference,'soldierTag',d.soldier_tag_snapshot,'categoryName',c.name,
    'amountMinor',d.amount_minor,'currency',d.currency,'paymentStatus',d.payment_status,
    'fulfilmentStatus',d.fulfilment_status,'createdAt',d.created_at,
    'events',coalesce((select jsonb_agg(jsonb_build_object('type',e.event_type,
      'description',e.public_description,'at',e.event_at) order by e.event_at)
      from public.fulfilment_events e where e.donation_id=d.id),'[]'::jsonb)
  ) into v_result from public.donations d join public.support_categories c on c.id=d.category_id
  where d.reference=upper(trim(p_reference)) and d.access_code_hash=digest(upper(trim(p_access_code)),'sha256');
  return v_result;
end; $$;

create or replace function public.review_payment(
  p_admin_id uuid, p_payment_id uuid, p_status text, p_review_notes text, p_decline_reason text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_role public.admin_role; v_payment public.payment_submissions; v_donation public.donations; v_new public.payment_status;
begin
  select role into v_role from public.admin_profiles where id=p_admin_id and active;
  if v_role is null or v_role not in ('super_administrator','payment_reviewer') then raise exception 'forbidden'; end if;
  v_new := p_status::public.payment_status;
  if v_new not in ('confirmed','declined') then raise exception 'invalid_status'; end if;
  select * into v_payment from public.payment_submissions where id=p_payment_id for update;
  if not found then raise exception 'not_found'; end if;
  if v_payment.status <> 'pending' then raise exception 'invalid_transition'; end if;
  select * into v_donation from public.donations where id=v_payment.donation_id for update;
  if v_new='declined' and nullif(trim(p_decline_reason),'') is null then raise exception 'decline_reason_required'; end if;
  update public.payment_submissions set status=v_new,reviewed_by=p_admin_id,reviewed_at=now(),
    review_notes=nullif(trim(p_review_notes),''),decline_reason=case when v_new='declined' then trim(p_decline_reason) end
    where id=p_payment_id;
  update public.donations set payment_status=v_new,
    fulfilment_status=case when v_new='confirmed' then 'awaiting_allocation'::public.fulfilment_status else fulfilment_status end
    where id=v_payment.donation_id;
  if v_new='confirmed' and v_donation.kind='general' then
    insert into public.general_fund_transactions(donation_id,transaction_type,amount_minor,description,recorded_by)
    values(v_donation.id,'contribution',v_donation.amount_minor,'Confirmed general-support contribution',p_admin_id);
  end if;
  insert into public.fulfilment_events(donation_id,event_type,public_description,created_by)
  values(v_payment.donation_id,'payment_'||v_new,
    case when v_new='confirmed' then 'The submitted payment was confirmed by an authorised reviewer.'
    else 'The submitted payment was declined after administrative review.' end,p_admin_id);
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(p_admin_id,'payment.'||v_new,'payment_submission',p_payment_id::text,
    jsonb_build_object('donation_id',v_payment.donation_id));
  return jsonb_build_object('paymentId',p_payment_id,'status',v_new);
end; $$;

create or replace function public.record_general_fund_transaction(
  p_admin_id uuid, p_donation_id uuid, p_transaction_type text,
  p_amount_minor bigint, p_description text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_role public.admin_role; v_id uuid; v_amount bigint; v_type text;
begin
  select role into v_role from public.admin_profiles where id=p_admin_id and active;
  if v_role is null or v_role not in ('super_administrator','fulfilment_manager') then raise exception 'forbidden'; end if;
  v_type := lower(trim(p_transaction_type));
  if v_type not in ('allocation','expenditure','refund','adjustment') then raise exception 'invalid_transaction_type'; end if;
  if p_amount_minor = 0 or abs(p_amount_minor) > 100000000 then raise exception 'invalid_amount'; end if;
  if p_donation_id is not null and not exists(
    select 1 from public.donations where id=p_donation_id and kind='general' and payment_status='confirmed'
  ) then raise exception 'invalid_general_donation'; end if;
  v_amount := case when v_type in ('allocation','expenditure','refund') then -abs(p_amount_minor) else p_amount_minor end;
  insert into public.general_fund_transactions(donation_id,transaction_type,amount_minor,description,recorded_by)
  values(p_donation_id,v_type,v_amount,trim(p_description),p_admin_id) returning id into v_id;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(p_admin_id,'general_fund.'||v_type,'general_fund_transaction',v_id::text,
    jsonb_build_object('amount_minor',v_amount,'donation_id',p_donation_id));
  return jsonb_build_object('transactionId',v_id,'amountMinor',v_amount);
end; $$;

create or replace function public.set_soldier_status(p_admin_id uuid, p_soldier_id uuid, p_status text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_role public.admin_role; v_status public.soldier_status;
begin
  select role into v_role from public.admin_profiles where id=p_admin_id and active;
  if v_role is null or v_role not in ('super_administrator','fulfilment_manager') then raise exception 'forbidden'; end if;
  v_status := p_status::public.soldier_status;
  update public.soldiers set status=v_status,
    deactivated_at=case when v_status='inactive' then now() else null end,
    deactivated_by=case when v_status='inactive' then p_admin_id else null end
  where id=p_soldier_id;
  if not found then raise exception 'not_found'; end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(p_admin_id,'soldier.status_changed','soldier',p_soldier_id::text,jsonb_build_object('status',v_status));
  return true;
end; $$;

create or replace function public.record_fund_allocation(
  p_admin_id uuid, p_donation_id uuid, p_amount_minor bigint, p_notes text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_role public.admin_role; v_donation public.donations; v_total bigint; v_id uuid;
begin
  select role into v_role from public.admin_profiles where id=p_admin_id and active;
  if v_role is null or v_role not in ('super_administrator','fulfilment_manager') then raise exception 'forbidden'; end if;
  select * into v_donation from public.donations where id=p_donation_id for update;
  if not found then raise exception 'not_found'; end if;
  if v_donation.payment_status <> 'confirmed' then raise exception 'payment_not_confirmed'; end if;
  if v_donation.kind <> 'soldier' then raise exception 'general_fund_required'; end if;
  if v_donation.fulfilment_status not in ('awaiting_allocation','funds_allocated') then raise exception 'invalid_transition'; end if;
  select coalesce(sum(amount_minor),0) into v_total from public.fund_allocations where donation_id=p_donation_id;
  if p_amount_minor <= 0 or v_total+p_amount_minor > v_donation.amount_minor then raise exception 'invalid_allocation'; end if;
  insert into public.fund_allocations(donation_id,amount_minor,notes,allocated_by)
  values(p_donation_id,p_amount_minor,nullif(trim(p_notes),''),p_admin_id) returning id into v_id;
  update public.donations set fulfilment_status='funds_allocated' where id=p_donation_id;
  insert into public.fulfilment_events(donation_id,event_type,public_description,created_by)
  values(p_donation_id,'funds_allocated','Funds were allocated to the intended support category.',p_admin_id);
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(p_admin_id,'allocation.created','fund_allocation',v_id::text,jsonb_build_object('donation_id',p_donation_id,'amount_minor',p_amount_minor));
  return jsonb_build_object('allocationId',v_id);
end; $$;

create or replace function public.record_purchase(
  p_admin_id uuid, p_donation_id uuid, p_items jsonb, p_actual_cost_minor bigint,
  p_provider_reference text, p_notes text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_role public.admin_role; v_donation public.donations; v_id uuid; v_allocation uuid;
  v_allocated bigint; v_spent bigint;
begin
  select role into v_role from public.admin_profiles where id=p_admin_id and active;
  if v_role is null or v_role not in ('super_administrator','fulfilment_manager') then raise exception 'forbidden'; end if;
  select * into v_donation from public.donations where id=p_donation_id for update;
  if not found then raise exception 'not_found'; end if;
  if v_donation.payment_status <> 'confirmed' or v_donation.fulfilment_status not in ('funds_allocated','purchase_in_progress') then raise exception 'invalid_transition'; end if;
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'items_required'; end if;
  select id into v_allocation from public.fund_allocations where donation_id=p_donation_id order by allocated_at desc limit 1;
  if v_allocation is null then raise exception 'allocation_required'; end if;
  select coalesce(sum(amount_minor),0) into v_allocated from public.fund_allocations where donation_id=p_donation_id;
  select coalesce(sum(actual_cost_minor),0) into v_spent from public.purchases where donation_id=p_donation_id;
  if p_actual_cost_minor < 0 or v_spent+p_actual_cost_minor > v_allocated then raise exception 'cost_exceeds_allocation'; end if;
  insert into public.purchases(donation_id,allocation_id,items,actual_cost_minor,provider_reference,recorded_by)
  values(p_donation_id,v_allocation,p_items,p_actual_cost_minor,nullif(trim(p_provider_reference),''),p_admin_id)
  returning id into v_id;
  update public.donations set fulfilment_status='purchase_in_progress' where id=p_donation_id;
  insert into public.fulfilment_events(donation_id,event_type,public_description,created_by)
  values(p_donation_id,'purchase_recorded','The approved support is being purchased or arranged.',p_admin_id);
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(p_admin_id,'purchase.created','purchase',v_id::text,jsonb_build_object('donation_id',p_donation_id,'notes',left(coalesce(p_notes,''),200)));
  return jsonb_build_object('purchaseId',v_id);
end; $$;

create or replace function public.set_fulfilment_status(
  p_admin_id uuid, p_donation_id uuid, p_status text, p_note text
) returns boolean language plpgsql security definer set search_path = public as $$
declare v_role public.admin_role; v_donation public.donations; v_new public.fulfilment_status; v_allowed boolean := false;
begin
  select role into v_role from public.admin_profiles where id=p_admin_id and active;
  if v_role is null or v_role not in ('super_administrator','fulfilment_manager') then raise exception 'forbidden'; end if;
  select * into v_donation from public.donations where id=p_donation_id for update;
  if not found then raise exception 'not_found'; end if;
  if v_donation.payment_status <> 'confirmed' then raise exception 'payment_not_confirmed'; end if;
  v_new := p_status::public.fulfilment_status;
  v_allowed := case v_donation.fulfilment_status
    when 'awaiting_allocation' then v_new in ('funds_allocated','unable_to_fulfil','cancelled')
    when 'funds_allocated' then v_new in ('purchase_in_progress','awaiting_delivery','unable_to_fulfil','cancelled')
    when 'purchase_in_progress' then v_new in ('awaiting_delivery','delivered','unable_to_fulfil','cancelled')
    when 'awaiting_delivery' then v_new in ('delivered','unable_to_fulfil','cancelled')
    else false end;
  if not v_allowed then raise exception 'invalid_transition'; end if;
  if nullif(trim(p_note),'') is null then raise exception 'note_required'; end if;
  if v_new='delivered' and not exists(select 1 from public.purchases where donation_id=p_donation_id) then raise exception 'purchase_required'; end if;
  update public.donations set fulfilment_status=v_new where id=p_donation_id;
  insert into public.fulfilment_records(donation_id,status,note,confirmed_by)
  values(p_donation_id,v_new,trim(p_note),p_admin_id);
  insert into public.fulfilment_events(donation_id,event_type,public_description,created_by)
  values(p_donation_id,'fulfilment_'||v_new,
    case v_new when 'awaiting_delivery' then 'The support is ready and awaiting delivery or service completion.'
      when 'delivered' then 'An authorised fulfilment manager confirmed that support was delivered or completed.'
      when 'unable_to_fulfil' then 'The intended support could not be fulfilled; the case is under administrative handling.'
      when 'cancelled' then 'The fulfilment was cancelled under the donation terms.'
      else 'The fulfilment status was updated.' end,p_admin_id);
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(p_admin_id,'fulfilment.status_changed','donation',p_donation_id::text,jsonb_build_object('status',v_new));
  return true;
end; $$;

create or replace function public.update_app_setting(
  p_admin_id uuid, p_key text, p_value jsonb, p_public boolean
) returns boolean language plpgsql security definer set search_path = public as $$
declare v_role public.admin_role;
begin
  select role into v_role from public.admin_profiles where id=p_admin_id and active;
  if v_role is null or v_role <> 'super_administrator' then raise exception 'forbidden'; end if;
  insert into public.app_settings(key,value,public,updated_by) values(p_key,p_value,p_public,p_admin_id)
  on conflict(key) do update set value=excluded.value,public=excluded.public,updated_by=p_admin_id,updated_at=now();
  insert into public.audit_logs(actor_id,action,entity_type,entity_id)
  values(p_admin_id,'setting.updated','app_setting',p_key);
  return true;
end; $$;

-- No browser receives direct table access. Authenticated administrators use server routes,
-- which re-check their active profile and role before service-role operations.
alter table public.admin_profiles enable row level security;
alter table public.support_categories enable row level security;
alter table public.soldiers enable row level security;
alter table public.soldier_category_eligibility enable row level security;
alter table public.donations enable row level security;
alter table public.payment_options enable row level security;
alter table public.payment_submissions enable row level security;
alter table public.payment_evidence enable row level security;
alter table public.receipts enable row level security;
alter table public.fund_allocations enable row level security;
alter table public.purchases enable row level security;
alter table public.volunteer_assignments enable row level security;
alter table public.fulfilment_records enable row level security;
alter table public.fulfilment_evidence enable row level security;
alter table public.fulfilment_events enable row level security;
alter table public.general_fund_transactions enable row level security;
alter table public.audit_logs enable row level security;
alter table public.app_settings enable row level security;
alter table public.public_rate_limits enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on function public.consume_public_rate_limit(text,text,integer,integer) from public;
revoke all on function public.register_soldier(uuid,text,text,text,uuid[]) from public;
revoke all on function public.validate_soldier_tag(text,text) from public;
revoke all on function public.create_donation_draft(text,text,text,bigint,text,text,text) from public;
revoke all on function public.get_donation_payment_context(uuid,text) from public;
revoke all on function public.submit_payment(uuid,text,text,uuid,text,text,text,text,text,bigint) from public;
revoke all on function public.public_verify_receipt(text) from public;
revoke all on function public.public_get_receipt(uuid,text) from public;
revoke all on function public.public_track_donation(text,text) from public;
revoke all on function public.review_payment(uuid,uuid,text,text,text) from public;
revoke all on function public.set_soldier_status(uuid,uuid,text) from public;
revoke all on function public.record_fund_allocation(uuid,uuid,bigint,text) from public;
revoke all on function public.record_purchase(uuid,uuid,jsonb,bigint,text,text) from public;
revoke all on function public.set_fulfilment_status(uuid,uuid,text,text) from public;
revoke all on function public.update_app_setting(uuid,text,jsonb,boolean) from public;
revoke all on function public.record_general_fund_transaction(uuid,uuid,text,bigint,text) from public;

grant execute on function public.consume_public_rate_limit(text,text,integer,integer) to service_role;
grant execute on function public.register_soldier(uuid,text,text,text,uuid[]) to service_role;
grant execute on function public.validate_soldier_tag(text,text) to service_role;
grant execute on function public.create_donation_draft(text,text,text,bigint,text,text,text) to service_role;
grant execute on function public.get_donation_payment_context(uuid,text) to service_role;
grant execute on function public.submit_payment(uuid,text,text,uuid,text,text,text,text,text,bigint) to service_role;
grant execute on function public.public_verify_receipt(text) to service_role;
grant execute on function public.public_get_receipt(uuid,text) to service_role;
grant execute on function public.public_track_donation(text,text) to service_role;
grant execute on function public.review_payment(uuid,uuid,text,text,text) to service_role;
grant execute on function public.set_soldier_status(uuid,uuid,text) to service_role;
grant execute on function public.record_fund_allocation(uuid,uuid,bigint,text) to service_role;
grant execute on function public.record_purchase(uuid,uuid,jsonb,bigint,text,text) to service_role;
grant execute on function public.set_fulfilment_status(uuid,uuid,text,text) to service_role;
grant execute on function public.update_app_setting(uuid,text,jsonb,boolean) to service_role;
grant execute on function public.record_general_fund_transaction(uuid,uuid,text,bigint,text) to service_role;

insert into public.support_categories(slug,name,description,icon,allows_soldier,allows_general,sort_order,suggested_amounts_minor)
values
 ('food-provisions','Food & provisions','Staple food, drinking water, and approved field provisions arranged for an eligible beneficiary.','utensils',true,true,10,array[2500,5000,10000]),
 ('data-bundles','Data bundles','Mobile data support fulfilled privately to the registered number linked to an eligible soldier tag.','signal',true,true,20,array[1000,2500,5000]),
 ('healthcare','Healthcare','Approved medicines, first-aid materials, and other documented health-related necessities.','heart-pulse',true,true,30,array[5000,10000,25000]),
 ('clothing-essentials','Clothing & essentials','Approved clothing, hygiene items, and practical essentials selected for the intended beneficiary.','shirt',true,true,40,array[5000,10000,20000]),
 ('other-approved','Other approved necessities','A controlled category for necessities reviewed and approved by authorised fulfilment personnel.','package',true,true,50,array[2500,5000,10000]),
 ('general-support','General soldier support','Flexible support held separately and allocated only through documented, authorised general-fund decisions.','shield',false,true,60,array[2500,5000,10000,25000])
on conflict(slug) do update set name=excluded.name,description=excluded.description,icon=excluded.icon,
  allows_soldier=excluded.allows_soldier,allows_general=excluded.allows_general,
  sort_order=excluded.sort_order,suggested_amounts_minor=excluded.suggested_amounts_minor;

insert into public.app_settings(key,value,public) values
 ('organisation.tagline','"Your Support. Their Strength."'::jsonb,true),
 ('donation.currency','"USD"'::jsonb,true),
 ('donation.minimum_minor','100'::jsonb,false),
 ('contact.email','null'::jsonb,true),
 ('content.mission','"We coordinate practical support for verified beneficiaries while preserving privacy, documenting payment review, and recording fulfilment decisions."'::jsonb,true)
on conflict(key) do nothing;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values
 ('payment-evidence','payment-evidence',false,5242880,array['image/jpeg','image/png','image/webp','application/pdf']),
 ('fulfilment-evidence','fulfilment-evidence',false,5242880,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

-- Intentionally no anon/authenticated storage policies: server-authorised service-role
-- operations and short-lived signed URLs are the only evidence access path.
