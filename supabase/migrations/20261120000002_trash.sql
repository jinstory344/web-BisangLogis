-- 휴지통: 되살리기(복구)·완전 삭제·30일 지나면 자동 완전 삭제.
--
-- 1) audit_logs.action 에 'PURGE'(완전 삭제) 추가
-- 2) restore_deleted: 메모(memos)도 되살릴 수 있게 허용 목록에 추가 (나머지 동작은 그대로)
-- 3) purge_deleted(표, id): 휴지통에 있는 한 건을 완전히 지운다(되돌릴 수 없음). 감사 기록 'PURGE'.
--    - 거래처: 배차·매출·메모·세금계산서 기록이 가리키고 있으면 지우지 않는다(기록이 '-'로 깨지지 않게 휴지통에 보관).
--    - 차량: 배차에는 차량번호·차주 이름이 따로 적혀 있으므로 배차의 차량 연결만 끊고 지운다.
--    - 배차: 세금계산서에 묶여 있으면 지우지 않는다.
-- 4) purge_expired_trash(): 지운 지 30일이 지난 것을 모두 완전 삭제(지울 수 없는 건 건너뜀). 지운 건수를 돌려준다.
-- 5) 매일 새벽 4시(한국 시각)에 4)를 부르는 pg_cron 잡 'bisang-trash-purge'
--
-- 전체가 한 트랜잭션이라 중간에 실패하면 아무것도 바뀌지 않는다.

begin;

alter table public.audit_logs drop constraint audit_logs_action_check;
alter table public.audit_logs
  add constraint audit_logs_action_check check (action in ('CREATE', 'UPDATE', 'DELETE', 'RESTORE', 'PURGE'));

create or replace function public.restore_deleted(p_table_name text, p_record_id uuid)
returns void
language plpgsql
set search_path to 'public'
as $function$
declare
  v_before jsonb;
  v_after jsonb;
begin
  if p_table_name not in
    ('clients', 'vehicles', 'dispatches', 'sales', 'expenses', 'tax_invoices', 'purchase_invoices', 'memos')
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
$function$;

create function public.purge_deleted(p_table_name text, p_record_id uuid)
returns void
language plpgsql
set search_path to 'public'
as $function$
declare
  v_before jsonb;
begin
  if p_table_name not in ('clients', 'vehicles', 'dispatches', 'sales', 'expenses', 'memos') then
    raise exception '완전 삭제를 지원하지 않는 테이블: %', p_table_name;
  end if;

  execute format(
    'select to_jsonb(t) from public.%I t where id = $1 and deleted_at is not null',
    p_table_name
  ) into v_before using p_record_id;

  if v_before is null then
    raise exception '휴지통에 없는 항목이에요: % (%)', p_table_name, p_record_id;
  end if;

  if p_table_name = 'clients' and (
    exists (select 1 from public.dispatches where client_id = p_record_id)
    or exists (select 1 from public.sales where client_id = p_record_id)
    or exists (select 1 from public.memos where client_id = p_record_id)
    or exists (select 1 from public.tax_invoices where client_id = p_record_id)
  ) then
    raise exception '이 거래처를 쓰는 배차·매출·메모 기록이 있어서 완전히 지울 수 없어요';
  end if;

  if p_table_name = 'dispatches'
    and exists (select 1 from public.tax_invoice_dispatches where dispatch_id = p_record_id)
  then
    raise exception '세금계산서에 묶인 배차라 완전히 지울 수 없어요';
  end if;

  if p_table_name = 'vehicles' then
    -- 배차에는 차량번호·차주가 따로 적혀 있어 연결만 끊어도 기록이 남는다
    update public.dispatches set vehicle_id = null where vehicle_id = p_record_id;
  end if;

  execute format('delete from public.%I where id = $1', p_table_name) using p_record_id;

  perform public.write_audit_log(p_table_name, p_record_id, 'PURGE', v_before, null);
end;
$function$;

create function public.purge_expired_trash()
returns integer
language plpgsql
set search_path to 'public'
as $function$
declare
  v_table text;
  v_id uuid;
  v_count integer := 0;
begin
  -- 거래처·차량은 그 기록(배차·매출·메모)이 먼저 지워진 뒤에 지워지도록 맨 뒤에
  foreach v_table in array array['memos', 'dispatches', 'sales', 'expenses', 'vehicles', 'clients'] loop
    for v_id in execute format(
      'select id from public.%I where deleted_at is not null and deleted_at < now() - interval ''30 days''',
      v_table
    ) loop
      begin
        perform public.purge_deleted(v_table, v_id);
        v_count := v_count + 1;
      exception when others then
        -- 지울 수 없는 건(기록이 있는 거래처 등)은 건너뛰고 휴지통에 남긴다
        null;
      end;
    end loop;
  end loop;
  return v_count;
end;
$function$;

-- 매일 새벽 4시(한국) = 19시(UTC)
select cron.schedule('bisang-trash-purge', '0 19 * * *', 'select public.purge_expired_trash()');

commit;
