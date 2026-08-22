-- 배차(dispatches)와 매출(sales)의 완전 분리
--
-- 배경: PRD 5.3은 "dispatches — 배차 (매출과 1:1 연동)"으로 설계되어 있었으나,
-- 실제 업무는 다르다. 배차는 사용자가 차량을 섭외(중개)해주는 행위로 수익이
-- 발생하지 않고, 매출은 사용자가 직접 운행하거나 일부 업체로부터 받는 수수료로
-- 발생하는 실제 수익이다. 둘은 1:1도 아니고 서로 독립적이다.
-- 사용자가 이 사실을 확인하고 완전 분리를 명시적으로 승인했으므로,
-- PRD 3.1~3.3 / 4.3.9 / 5.3의 "배차=매출 1:1 자동생성" 설계를 의도적으로 뒤집는다.
-- (배차 -> 매출 수수료 연결 기능은 이번 범위가 아니며 추후 별도 마이그레이션으로 다룬다.)
--
-- 이 마이그레이션이 하는 일:
--   1. tax_invoice_dispatches가 비어있는지 확인 (FK 안전장치)
--   2. sales 테이블 신규 생성 (인덱스/트리거/RLS 포함)
--   3. dispatches의 모든 행(소프트 삭제된 것 포함)을 sales로 이관 (id/created_at 보존)
--   4. 이관 전 원본 행 전체를 audit_logs에 보존 + 행 수/금액 합계 정합성 검증
--   5. dispatches 비우기
--   6. dispatches에서 금액/결제/출처 관련 컬럼과 제약 전부 제거
--   7. soft_delete/restore_deleted 허용 목록에 sales 추가
--   8. create_dispatch/update_dispatch 축소 재작성 + create_sale/update_sale 신규 작성
--
-- 주의: 이 파일 전체는 하나의 트랜잭션으로 실행되어야 한다
-- (supabase db push 및 Management API의 simple query 모두 암묵적 단일 트랜잭션).

-- =========================================================
-- 1. 사전 안전장치 — 세금계산서-배차 연결이 남아 있으면 중단
-- =========================================================
do $$
declare
  v_cnt bigint;
begin
  select count(*) into v_cnt from public.tax_invoice_dispatches;
  if v_cnt > 0 then
    raise exception
      'tax_invoice_dispatches에 %건의 연결이 남아 있어 dispatches를 비울 수 없습니다. 연결 정리 후 재시도하십시오.',
      v_cnt;
  end if;
end $$;

-- =========================================================
-- 2. sales — 매출 (배차와 독립)
-- =========================================================
create table public.sales (
  id uuid primary key default gen_random_uuid(),
  sale_date date not null,
  origin text,
  destination text,
  supply_amount bigint not null,
  vat_amount bigint not null,
  total_amount bigint not null,
  is_vat_exempt boolean not null default false,
  payment_method text not null
    check (payment_method in ('TAX_INVOICE', 'TRANSFER', 'CASH')),
  payment_status text not null default 'UNPAID'
    check (payment_status in ('UNPAID', 'PAID')),
  paid_at date,
  source_major text,
  source_minor text,
  source_note text,
  -- 사업자정보 (매출처/운송사 명칭)
  carrier_name text,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  deleted_at timestamptz,
  -- 4.3 금액·정확성 규칙: 공급가액 + 부가세 = 합계금액, 모든 금액은 0 이상
  constraint sales_amount_sum_check
    check (supply_amount + vat_amount = total_amount),
  constraint sales_amount_nonneg_check
    check (
      total_amount >= 0 and total_amount <= 99999999999
      and supply_amount >= 0
      and vat_amount >= 0
    ),
  constraint sales_source_major_check
    check (
      source_major is null
      or source_major in (
        '거래처', '지인', '해피', '에이스', '스마일',
        '카카오톡', '밴드', '24시콜화물', '기타'
      )
    )
);

create index sales_deleted_at_idx on public.sales (deleted_at);
create index sales_sale_date_idx on public.sales (sale_date desc);
create index sales_payment_status_idx on public.sales (payment_status);
-- 4.3.6 중복 입력 감지 조회용
create index sales_dup_check_idx
  on public.sales (sale_date, origin, destination, supply_amount);

create trigger sales_set_updated_at
  before update on public.sales
  for each row execute function public.set_updated_at();

-- RLS: dispatches와 동일한 인증 모델(로그인한 사용자만 접근)
alter table public.sales enable row level security;

create policy "authenticated_full_access" on public.sales
  for all to authenticated
  using (true)
  with check (true);

-- =========================================================
-- 3. 기존 dispatches 데이터를 sales로 이관 (전부, deleted_at 포함)
-- =========================================================
insert into public.sales (
  id, sale_date, origin, destination,
  supply_amount, vat_amount, total_amount, is_vat_exempt,
  payment_method, payment_status, paid_at,
  source_major, source_minor, source_note,
  carrier_name, memo,
  created_at, updated_at, deleted_at
)
select
  d.id, d.dispatch_date, d.origin, d.destination,
  d.supply_amount, d.vat_amount, d.total_amount, d.is_vat_exempt,
  d.payment_method, d.payment_status, d.paid_at,
  d.source_major, d.source_minor, d.source_note,
  d.carrier_name, d.memo,
  d.created_at, d.updated_at, d.deleted_at
from public.dispatches d;

-- =========================================================
-- 4. 이관 이력을 audit_logs에 남긴다.
--    dispatches 원본 행 전체(fee_amount / client_id / vehicle_id / 기사 스냅샷 등
--    sales로 넘어가지 않는 필드 포함)를 before_data에 통째로 보존하므로,
--    이 마이그레이션 이후에도 원본 값을 audit_logs에서 복원할 수 있다.
-- =========================================================
do $$
declare
  r record;
begin
  for r in select d.id as id, to_jsonb(d) as row_json from public.dispatches d loop
    perform public.write_audit_log('dispatches', r.id, 'DELETE', r.row_json, null);
    perform public.write_audit_log(
      'sales',
      r.id,
      'CREATE',
      null,
      (select to_jsonb(s) from public.sales s where s.id = r.id)
    );
  end loop;
end $$;

-- 이관 정합성 검증 (행 수 / 합계금액)
do $$
declare
  v_dispatch_cnt bigint;
  v_sales_cnt bigint;
  v_dispatch_sum bigint;
  v_sales_sum bigint;
  v_fee_sum bigint;
begin
  select count(*), coalesce(sum(total_amount), 0), coalesce(sum(fee_amount), 0)
    into v_dispatch_cnt, v_dispatch_sum, v_fee_sum
  from public.dispatches;

  select count(*), coalesce(sum(total_amount), 0)
    into v_sales_cnt, v_sales_sum
  from public.sales;

  if v_dispatch_cnt <> v_sales_cnt then
    raise exception '이관 행 수 불일치: dispatches=%, sales=%', v_dispatch_cnt, v_sales_cnt;
  end if;

  if v_dispatch_sum <> v_sales_sum then
    raise exception '이관 합계금액 불일치: dispatches=%, sales=%', v_dispatch_sum, v_sales_sum;
  end if;

  raise notice
    '이관 검증 통과 — 행수=%, total_amount 합계=%, sales로 넘기지 않는 fee_amount 합계=% (audit_logs.before_data에 원본 보존)',
    v_dispatch_cnt, v_dispatch_sum, v_fee_sum;
end $$;

-- =========================================================
-- 5. dispatches 비우기 (모든 행이 sales로 이관 완료됨)
-- =========================================================
delete from public.dispatches;

-- =========================================================
-- 6. dispatches에서 금액/결제/출처 컬럼과 관련 제약 제거
--    (배차는 이제 물류·섭외 정보만 담는다)
-- =========================================================
alter table public.dispatches
  drop constraint if exists dispatches_amount_sum_check,
  drop constraint if exists dispatches_amount_nonneg_check,
  drop constraint if exists dispatches_source_major_check;

-- payment_method / payment_status의 인라인 CHECK 제약은 컬럼과 함께 자동 제거된다.
alter table public.dispatches
  drop column if exists total_amount,
  drop column if exists supply_amount,
  drop column if exists vat_amount,
  drop column if exists is_vat_exempt,
  drop column if exists fee_amount,
  drop column if exists payment_method,
  drop column if exists payment_status,
  drop column if exists paid_at,
  drop column if exists source_major,
  drop column if exists source_minor,
  drop column if exists source_note;

-- supply_amount / payment_status에 걸려 있던 인덱스는 컬럼과 함께 사라진다.
-- 4.3.6 중복 입력 감지는 금액 없이 물류 정보 기준으로 다시 만든다.
drop index if exists public.dispatches_dup_check_idx;
create index dispatches_dup_check_idx
  on public.dispatches (dispatch_date, client_id, origin, destination);

-- =========================================================
-- 7. 소프트 삭제 허용 목록에 sales 추가
--    (앱의 softDelete()/restoreRecord() 헬퍼가 sales에도 동작해야 함)
--    시그니처(text, uuid)는 그대로이므로 오버로드가 생기지 않는다.
-- =========================================================
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
    ('clients', 'vehicles', 'dispatches', 'sales', 'expenses', 'tax_invoices', 'purchase_invoices')
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
    ('clients', 'vehicles', 'dispatches', 'sales', 'expenses', 'tax_invoices', 'purchase_invoices')
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

-- =========================================================
-- 8. RPC 재작성
--    과거 세션에서 DROP FUNCTION의 하드코딩 시그니처가 실제 라이브 시그니처와
--    달라 중복 오버로드가 남는 사고가 반복됐다(20260806000004, 20260821000002).
--    시그니처를 추측하지 않고 pg_proc에서 실제 오버로드를 전부 찾아 삭제한다.
-- =========================================================
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and p.proname in ('create_dispatch', 'update_dispatch', 'create_sale', 'update_sale')
  loop
    execute format('drop function %s', r.sig);
    raise notice '기존 함수 삭제: %', r.sig;
  end loop;
end $$;

-- ---------------------------------------------------------
-- 8-1. create_dispatch — 물류·섭외 정보만 (금액 검증 로직 전부 제거)
--      dispatcher_name은 20260804000001의 결정대로 신규 입력을 받지 않는다
--      (컬럼은 과거 이력 보존을 위해 유지).
-- ---------------------------------------------------------
create function public.create_dispatch(
  p_dispatch_date date,
  p_client_id uuid,
  p_origin text,
  p_destination text,
  p_dropoff_type text,
  p_pallet_count integer,
  p_weight_ton numeric,
  p_vehicle_id uuid,
  p_plate_no_snapshot text,
  p_driver_name_snapshot text,
  p_driver_phone_snapshot text,
  p_carrier_name text,
  p_contact_name text,
  p_memo text default null,
  p_cargo_box_type text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_dropoff_type is null or p_dropoff_type not in ('SAME_DAY', 'NEXT_DAY') then
    raise exception '하차일 구분값이 올바르지 않습니다: %', p_dropoff_type;
  end if;

  if p_cargo_box_type is not null
     and p_cargo_box_type not in ('CARGO', 'BOX', 'WING', 'REFRIGERATED', 'OTHER')
  then
    raise exception '적재함 종류값이 올바르지 않습니다: %', p_cargo_box_type;
  end if;

  insert into public.dispatches (
    dispatch_date, client_id, origin, destination, dropoff_type,
    pallet_count, weight_ton, cargo_box_type,
    vehicle_id, plate_no_snapshot, driver_name_snapshot, driver_phone_snapshot,
    carrier_name, contact_name, memo
  ) values (
    p_dispatch_date, p_client_id, p_origin, p_destination, p_dropoff_type,
    p_pallet_count, p_weight_ton, p_cargo_box_type,
    p_vehicle_id, p_plate_no_snapshot, p_driver_name_snapshot, p_driver_phone_snapshot,
    p_carrier_name, p_contact_name, p_memo
  )
  returning id into v_id;

  perform public.write_audit_log(
    'dispatches',
    v_id,
    'CREATE',
    null,
    jsonb_build_object(
      'dispatch_date', p_dispatch_date,
      'client_id', p_client_id,
      'origin', p_origin,
      'destination', p_destination,
      'dropoff_type', p_dropoff_type,
      'pallet_count', p_pallet_count,
      'weight_ton', p_weight_ton,
      'cargo_box_type', p_cargo_box_type,
      'vehicle_id', p_vehicle_id,
      'plate_no_snapshot', p_plate_no_snapshot,
      'driver_name_snapshot', p_driver_name_snapshot,
      'driver_phone_snapshot', p_driver_phone_snapshot,
      'carrier_name', p_carrier_name,
      'contact_name', p_contact_name,
      'memo', p_memo
    )
  );

  return v_id;
end;
$$;

-- ---------------------------------------------------------
-- 8-2. update_dispatch
-- ---------------------------------------------------------
create function public.update_dispatch(
  p_id uuid,
  p_dispatch_date date,
  p_client_id uuid,
  p_origin text,
  p_destination text,
  p_dropoff_type text,
  p_pallet_count integer,
  p_weight_ton numeric,
  p_vehicle_id uuid,
  p_plate_no_snapshot text,
  p_driver_name_snapshot text,
  p_driver_phone_snapshot text,
  p_carrier_name text,
  p_contact_name text,
  p_memo text default null,
  p_cargo_box_type text default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_before jsonb;
begin
  select to_jsonb(t) into v_before
  from public.dispatches t
  where t.id = p_id and t.deleted_at is null;

  if v_before is null then
    raise exception '대상 배차를 찾을 수 없습니다: %', p_id;
  end if;

  if p_dropoff_type is null or p_dropoff_type not in ('SAME_DAY', 'NEXT_DAY') then
    raise exception '하차일 구분값이 올바르지 않습니다: %', p_dropoff_type;
  end if;

  if p_cargo_box_type is not null
     and p_cargo_box_type not in ('CARGO', 'BOX', 'WING', 'REFRIGERATED', 'OTHER')
  then
    raise exception '적재함 종류값이 올바르지 않습니다: %', p_cargo_box_type;
  end if;

  update public.dispatches set
    dispatch_date = p_dispatch_date,
    client_id = p_client_id,
    origin = p_origin,
    destination = p_destination,
    dropoff_type = p_dropoff_type,
    pallet_count = p_pallet_count,
    weight_ton = p_weight_ton,
    cargo_box_type = p_cargo_box_type,
    vehicle_id = p_vehicle_id,
    plate_no_snapshot = p_plate_no_snapshot,
    driver_name_snapshot = p_driver_name_snapshot,
    driver_phone_snapshot = p_driver_phone_snapshot,
    carrier_name = p_carrier_name,
    contact_name = p_contact_name,
    memo = p_memo
  where id = p_id;

  perform public.write_audit_log(
    'dispatches',
    p_id,
    'UPDATE',
    v_before,
    (select to_jsonb(t) from public.dispatches t where t.id = p_id)
  );
end;
$$;

-- ---------------------------------------------------------
-- 8-3. create_sale — 금액 규칙(4.3)은 여기서 계산·검증한다.
--      공급가액 입력 -> round-half-up((공급가액 + 5) / 10)로 부가세 계산 -> 합계.
--      면세면 부가세 0, 합계 = 공급가액.
-- ---------------------------------------------------------
create function public.create_sale(
  p_sale_date date,
  p_origin text,
  p_destination text,
  p_supply_amount bigint,
  p_is_vat_exempt boolean,
  p_payment_method text,
  p_source_major text,
  p_source_minor text,
  p_source_note text,
  p_carrier_name text,
  p_memo text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_vat_amount bigint;
  v_total_amount bigint;
  v_id uuid;
begin
  if p_supply_amount is null or p_supply_amount < 0 or p_supply_amount > 99999999999 then
    raise exception '공급가액이 허용 범위를 벗어났습니다: %', p_supply_amount;
  end if;

  if p_payment_method is null or p_payment_method not in ('TAX_INVOICE', 'TRANSFER', 'CASH') then
    raise exception '결제수단값이 올바르지 않습니다: %', p_payment_method;
  end if;

  if p_source_major is not null
     and p_source_major not in (
       '거래처', '지인', '해피', '에이스', '스마일',
       '카카오톡', '밴드', '24시콜화물', '기타'
     )
  then
    raise exception '출처 대분류값이 올바르지 않습니다: %', p_source_major;
  end if;

  if p_is_vat_exempt then
    v_vat_amount := 0;
  else
    -- round-half-up(공급가액 / 10) — 정수 연산으로 부동소수점 오차를 없앤다.
    v_vat_amount := (p_supply_amount + 5) / 10;
  end if;
  v_total_amount := p_supply_amount + v_vat_amount;

  if v_total_amount > 99999999999 then
    raise exception '합계금액이 허용 범위를 벗어났습니다: %', v_total_amount;
  end if;

  insert into public.sales (
    sale_date, origin, destination,
    supply_amount, vat_amount, total_amount, is_vat_exempt,
    payment_method, payment_status,
    source_major, source_minor, source_note,
    carrier_name, memo
  ) values (
    p_sale_date, p_origin, p_destination,
    p_supply_amount, v_vat_amount, v_total_amount, p_is_vat_exempt,
    p_payment_method, 'UNPAID',
    p_source_major, p_source_minor, p_source_note,
    p_carrier_name, p_memo
  )
  returning id into v_id;

  perform public.write_audit_log(
    'sales',
    v_id,
    'CREATE',
    null,
    jsonb_build_object(
      'sale_date', p_sale_date,
      'origin', p_origin,
      'destination', p_destination,
      'supply_amount', p_supply_amount,
      'vat_amount', v_vat_amount,
      'total_amount', v_total_amount,
      'is_vat_exempt', p_is_vat_exempt,
      'payment_method', p_payment_method,
      'payment_status', 'UNPAID',
      'source_major', p_source_major,
      'source_minor', p_source_minor,
      'source_note', p_source_note,
      'carrier_name', p_carrier_name,
      'memo', p_memo
    )
  );

  return v_id;
end;
$$;

-- ---------------------------------------------------------
-- 8-4. update_sale
--      payment_status / paid_at은 dispatches와 동일하게 여기서 다루지 않는다
--      (수금 처리는 앱에서 별도 update + audit 기록으로 수행).
-- ---------------------------------------------------------
create function public.update_sale(
  p_id uuid,
  p_sale_date date,
  p_origin text,
  p_destination text,
  p_supply_amount bigint,
  p_is_vat_exempt boolean,
  p_payment_method text,
  p_source_major text,
  p_source_minor text,
  p_source_note text,
  p_carrier_name text,
  p_memo text default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_vat_amount bigint;
  v_total_amount bigint;
  v_before jsonb;
begin
  select to_jsonb(t) into v_before
  from public.sales t
  where t.id = p_id and t.deleted_at is null;

  if v_before is null then
    raise exception '대상 매출을 찾을 수 없습니다: %', p_id;
  end if;

  if p_supply_amount is null or p_supply_amount < 0 or p_supply_amount > 99999999999 then
    raise exception '공급가액이 허용 범위를 벗어났습니다: %', p_supply_amount;
  end if;

  if p_payment_method is null or p_payment_method not in ('TAX_INVOICE', 'TRANSFER', 'CASH') then
    raise exception '결제수단값이 올바르지 않습니다: %', p_payment_method;
  end if;

  if p_source_major is not null
     and p_source_major not in (
       '거래처', '지인', '해피', '에이스', '스마일',
       '카카오톡', '밴드', '24시콜화물', '기타'
     )
  then
    raise exception '출처 대분류값이 올바르지 않습니다: %', p_source_major;
  end if;

  if p_is_vat_exempt then
    v_vat_amount := 0;
  else
    v_vat_amount := (p_supply_amount + 5) / 10;
  end if;
  v_total_amount := p_supply_amount + v_vat_amount;

  if v_total_amount > 99999999999 then
    raise exception '합계금액이 허용 범위를 벗어났습니다: %', v_total_amount;
  end if;

  update public.sales set
    sale_date = p_sale_date,
    origin = p_origin,
    destination = p_destination,
    supply_amount = p_supply_amount,
    vat_amount = v_vat_amount,
    total_amount = v_total_amount,
    is_vat_exempt = p_is_vat_exempt,
    payment_method = p_payment_method,
    source_major = p_source_major,
    source_minor = p_source_minor,
    source_note = p_source_note,
    carrier_name = p_carrier_name,
    memo = p_memo
  where id = p_id;

  perform public.write_audit_log(
    'sales',
    p_id,
    'UPDATE',
    v_before,
    (select to_jsonb(t) from public.sales t where t.id = p_id)
  );
end;
$$;
