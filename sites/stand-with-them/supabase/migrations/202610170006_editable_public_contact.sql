-- Publish support email and phone together through one validated, audited update.

insert into public.app_settings(key,value,public) values
  ('contact.email','null'::jsonb,true),
  ('contact.phone','null'::jsonb,true)
on conflict(key) do update set public=true;

create or replace function public.update_public_contact(
  p_admin_id uuid, p_email text, p_phone text
) returns boolean language plpgsql security definer set search_path = public as $$
declare v_role public.admin_role; v_email text; v_phone text;
begin
  select role into v_role from public.admin_profiles where id=p_admin_id and active;
  if v_role is null or v_role <> 'super_administrator' then raise exception 'forbidden'; end if;
  v_email := lower(nullif(trim(p_email),''));
  v_phone := nullif(trim(p_phone),'');
  if v_email is null and v_phone is null then raise exception 'contact_required'; end if;
  if v_email is not null and (char_length(v_email) > 254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
    then raise exception 'invalid_email'; end if;
  if v_phone is not null and (char_length(v_phone) > 40 or v_phone !~ '^[+()0-9. -]{6,40}$')
    then raise exception 'invalid_phone'; end if;
  insert into public.app_settings(key,value,public,updated_by) values
    ('contact.email',coalesce(to_jsonb(v_email),'null'::jsonb),true,p_admin_id),
    ('contact.phone',coalesce(to_jsonb(v_phone),'null'::jsonb),true,p_admin_id)
  on conflict(key) do update set value=excluded.value,public=true,updated_by=p_admin_id,updated_at=now();
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(p_admin_id,'contact.updated','app_setting','contact',jsonb_build_object(
    'email_configured',v_email is not null,'phone_configured',v_phone is not null));
  return true;
end; $$;

revoke all on function public.update_public_contact(uuid,text,text) from public;
grant execute on function public.update_public_contact(uuid,text,text) to service_role;
