-- 4.3.7 변경 이력 로그 + 4.2 소프트 삭제 공통 함수
-- 소프트 삭제 대상 테이블(휴지통 화면 8.2: 배차/지출/거래처/차량)만 허용 목록으로 제한한다.

create or replace function public.write_audit_log(
  p_table_name text,
  p_record_id uuid,
  p_action text,
  p_before_data jsonb default null,
  p_after_data jsonb default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if p_action not in ('CREATE', 'UPDATE', 'DELETE', 'RESTORE') then
    raise exception '알 수 없는 action: %', p_action;
  end if;

  insert into public.audit_logs
    (table_name, record_id, action, before_data, after_data, actor_id)
  values
    (p_table_name, p_record_id, p_action, p_before_data, p_after_data, auth.uid());
end;
$$;

create or replace function public.soft_delete(
  p_table_name text,
  p_record_id uuid
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_before jsonb;
begin
  if p_table_name not in
    ('clients', 'vehicles', 'dispatches', 'expenses', 'tax_invoices', 'purchase_invoices')
  then
    raise exception '소프트 삭제를 지원하지 않는 테이블: %', p_table_name;
  end if;

  execute format(
    'select to_jsonb(t) from public.%I t where id = $1 and deleted_at is null',
    p_table_name
  ) into v_before using p_record_id;

  if v_before is null then
    raise exception '대상을 찾을 수 없거나 이미 삭제됨: % (%)', p_table_name, p_record_id;
  end if;

  execute format(
    'update public.%I set deleted_at = now() where id = $1',
    p_table_name
  ) using p_record_id;

  perform public.write_audit_log(p_table_name, p_record_id, 'DELETE', v_before, null);
end;
$$;

create or replace function public.restore_deleted(
  p_table_name text,
  p_record_id uuid
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_before jsonb;
  v_after jsonb;
begin
  if p_table_name not in
    ('clients', 'vehicles', 'dispatches', 'expenses', 'tax_invoices', 'purchase_invoices')
  then
    raise exception '소프트 삭제를 지원하지 않는 테이블: %', p_table_name;
  end if;

  execute format(
    'select to_jsonb(t) from public.%I t where id = $1 and deleted_at is not null',
    p_table_name
  ) into v_before using p_record_id;

  if v_before is null then
    raise exception '대상을 찾을 수 없거나 삭제된 상태가 아님: % (%)', p_table_name, p_record_id;
  end if;

  execute format(
    'update public.%I set deleted_at = null where id = $1',
    p_table_name
  ) using p_record_id;

  execute format(
    'select to_jsonb(t) from public.%I t where id = $1',
    p_table_name
  ) into v_after using p_record_id;

  perform public.write_audit_log(p_table_name, p_record_id, 'RESTORE', v_before, v_after);
end;
$$;
