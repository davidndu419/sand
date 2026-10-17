-- Preserve the required SLD- prefix while normalising only the random suffix.
-- This replaces the initially deployed function without changing existing data.

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
    v_tag := 'SLD-' || regexp_replace(
      upper(substr(translate(encode(gen_random_bytes(8),'base64'), '/+=01IO', 'ABCDEFG'),1,8)),
      '[^A-HJ-NP-Z2-9]', 'K', 'g'
    );
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

revoke all on function public.register_soldier(uuid,text,text,text,uuid[]) from public;
grant execute on function public.register_soldier(uuid,text,text,text,uuid[]) to service_role;
