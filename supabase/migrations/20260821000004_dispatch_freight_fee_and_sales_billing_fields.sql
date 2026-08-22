-- 배차/매출 분리(20260821000003) 후속 — 사용자 확인을 거쳐 확정된 필드 4개 추가
--
-- dispatches (배차 = 물류·섭외 정보 + 지급 비용 기록):
--   - freight_amount "운임": 배차 완료 후 해당 기사/차량에게 지급하는 금액.
--     매출과 무관한 단순 비용 기록이므로 PRD 4.3의 "공급가액 + 부가세 = 합계"
--     상호 검증 규칙을 적용하지 않는다(부가세 분리 계산 없음).
--     범위 검증만 수행: 0 이상 99,999,999,999 이하. 미입력(null) 허용.
--   - fee_amount "수수료": 일부 거래처(사업자)에 한해 발생하는 수수료.
--     지금은 단순 기록용이며 매출 레코드를 자동 생성하지 않는다
--     (배차 -> 매출 수수료 연결 기능은 추후 별도 구현, 이번 범위 아님).
--
--   참고: fee_amount는 분리 이전 dispatches에도 있던 컬럼이고 20260821000003에서
--   제거됐다. 그 시점 실 데이터(합계 20,000원)는 audit_logs.before_data에 원본 행
--   전체로 보존돼 있으므로, 추후 수수료 연결 기능 구현 시 복원할 수 있다.
--   현재 dispatches는 0행이라 default 0이 적용될 기존 행은 없다.
--
-- sales (매출):
--   - billing_entity_name "계산서발행할사업자": 사용자가 직접 운송을 진행한 건에서
--     운임을 지급하고 계산서를 받을 상대 사업자명. FK가 아닌 단순 상호명 텍스트로,
--     기존 carrier_name과 동일하게 최근 입력값 자동완성 대상이 된다.
--   - order_contact_phone "오더자 전화번호": 기존 source_minor(오더자)와 함께 쓰는 연락처.
--     포맷 검증은 driver_phone_snapshot과 동일하게 프론트에서만 처리하고 DB는 plain text.
--
-- 새 컬럼은 모두 null 허용이거나 default가 있어 기존 행(sales 5행)을 깨지 않는다.

-- =========================================================
-- 1. dispatches — 운임 / 수수료
-- =========================================================
alter table public.dispatches
  add column freight_amount bigint,
  add column fee_amount bigint not null default 0;

alter table public.dispatches
  add constraint dispatches_freight_amount_check
  check (
    freight_amount is null
    or (freight_amount >= 0 and freight_amount <= 99999999999)
  );

alter table public.dispatches
  add constraint dispatches_fee_amount_check
  check (fee_amount >= 0 and fee_amount <= 99999999999);

-- =========================================================
-- 2. sales — 계산서발행할사업자 / 오더자 전화번호
-- =========================================================
alter table public.sales
  add column billing_entity_name text,
  add column order_contact_phone text;

-- =========================================================
-- 3. RPC 재작성
--    시그니처를 하드코딩하지 않고 pg_proc에서 실제 오버로드를 전부 찾아 삭제한다
--    (20260806000004 / 20260821000002에서 하드코딩 시그니처 불일치로
--     중복 오버로드가 남는 사고가 두 번 있었다. 20260821000003과 동일 패턴).
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
-- 3-1. create_dispatch — 기존 파라미터 순서/이름 유지, 신규 2개를 끝에 추가
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
  p_cargo_box_type text default null,
  p_freight_amount bigint default null,
  p_fee_amount bigint default 0
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
  v_fee_amount bigint;
begin
  if p_dropoff_type is null or p_dropoff_type not in ('SAME_DAY', 'NEXT_DAY') then
    raise exception '하차일 구분값이 올바르지 않습니다: %', p_dropoff_type;
  end if;

  if p_cargo_box_type is not null
     and p_cargo_box_type not in ('CARGO', 'BOX', 'WING', 'REFRIGERATED', 'OTHER')
  then
    raise exception '적재함 종류값이 올바르지 않습니다: %', p_cargo_box_type;
  end if;

  -- 운임: 미입력(null) 허용. 값이 있으면 범위만 검증한다.
  if p_freight_amount is not null
     and (p_freight_amount < 0 or p_freight_amount > 99999999999)
  then
    raise exception '운임이 허용 범위를 벗어났습니다: %', p_freight_amount;
  end if;

  -- 수수료: 컬럼이 not null이므로 미입력은 0으로 본다.
  v_fee_amount := coalesce(p_fee_amount, 0);
  if v_fee_amount < 0 or v_fee_amount > 99999999999 then
    raise exception '수수료가 허용 범위를 벗어났습니다: %', v_fee_amount;
  end if;

  insert into public.dispatches (
    dispatch_date, client_id, origin, destination, dropoff_type,
    pallet_count, weight_ton, cargo_box_type,
    vehicle_id, plate_no_snapshot, driver_name_snapshot, driver_phone_snapshot,
    carrier_name, contact_name, memo,
    freight_amount, fee_amount
  ) values (
    p_dispatch_date, p_client_id, p_origin, p_destination, p_dropoff_type,
    p_pallet_count, p_weight_ton, p_cargo_box_type,
    p_vehicle_id, p_plate_no_snapshot, p_driver_name_snapshot, p_driver_phone_snapshot,
    p_carrier_name, p_contact_name, p_memo,
    p_freight_amount, v_fee_amount
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
      'memo', p_memo,
      'freight_amount', p_freight_amount,
      'fee_amount', v_fee_amount
    )
  );

  return v_id;
end;
$$;

-- ---------------------------------------------------------
-- 3-2. update_dispatch
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
  p_cargo_box_type text default null,
  p_freight_amount bigint default null,
  p_fee_amount bigint default 0
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_before jsonb;
  v_fee_amount bigint;
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

  if p_freight_amount is not null
     and (p_freight_amount < 0 or p_freight_amount > 99999999999)
  then
    raise exception '운임이 허용 범위를 벗어났습니다: %', p_freight_amount;
  end if;

  v_fee_amount := coalesce(p_fee_amount, 0);
  if v_fee_amount < 0 or v_fee_amount > 99999999999 then
    raise exception '수수료가 허용 범위를 벗어났습니다: %', v_fee_amount;
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
    memo = p_memo,
    freight_amount = p_freight_amount,
    fee_amount = v_fee_amount
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
-- 3-3. create_sale — 신규 2개를 끝에 추가 (단순 텍스트, 별도 검증 없음)
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
  p_memo text default null,
  p_billing_entity_name text default null,
  p_order_contact_phone text default null
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
    carrier_name, memo,
    billing_entity_name, order_contact_phone
  ) values (
    p_sale_date, p_origin, p_destination,
    p_supply_amount, v_vat_amount, v_total_amount, p_is_vat_exempt,
    p_payment_method, 'UNPAID',
    p_source_major, p_source_minor, p_source_note,
    p_carrier_name, p_memo,
    p_billing_entity_name, p_order_contact_phone
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
      'memo', p_memo,
      'billing_entity_name', p_billing_entity_name,
      'order_contact_phone', p_order_contact_phone
    )
  );

  return v_id;
end;
$$;

-- ---------------------------------------------------------
-- 3-4. update_sale
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
  p_memo text default null,
  p_billing_entity_name text default null,
  p_order_contact_phone text default null
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
    memo = p_memo,
    billing_entity_name = p_billing_entity_name,
    order_contact_phone = p_order_contact_phone
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
