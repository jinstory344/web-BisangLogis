-- 배차 등록 폼 개편
-- - 담당자(contact_name)/하차일 구분(dropoff_type)/중량(weight_ton) 컬럼 추가
-- - 배차자(dispatcher_name)는 신규 입력을 받지 않음(RPC 파라미터에서 제외). 기존 이력은
--   컬럼을 남겨두어 과거 데이터·수정 시 그대로 보존한다.
-- - 운임 입력 방향을 "합계운임 입력 -> 공급가액/부가세 역산"에서
--   "공급가액 입력 -> 부가세/합계 정산"으로 변경한다.

alter table public.dispatches
  add column contact_name text,
  add column dropoff_type text not null default 'SAME_DAY'
    check (dropoff_type in ('SAME_DAY', 'NEXT_DAY')),
  add column weight_ton numeric(6, 2)
    check (weight_ton is null or weight_ton >= 0);

-- 4.3.6 중복 입력 감지가 이제 공급가액 기준이므로 인덱스도 맞춰 교체한다.
drop index if exists public.dispatches_dup_check_idx;
create index dispatches_dup_check_idx
  on public.dispatches (dispatch_date, client_id, origin, destination, supply_amount);

drop function if exists public.create_dispatch(
  date, uuid, text, text, integer, uuid, text, text, text, text, text,
  bigint, boolean, bigint, text, text
);

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
  p_supply_amount bigint,
  p_is_vat_exempt boolean,
  p_fee_amount bigint,
  p_payment_method text,
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
  if p_supply_amount < 0 or p_supply_amount > 99999999999 then
    raise exception '공급가액이 허용 범위를 벗어났습니다: %', p_supply_amount;
  end if;

  if p_fee_amount < 0 or p_fee_amount > 99999999999 then
    raise exception '수수료가 허용 범위를 벗어났습니다: %', p_fee_amount;
  end if;

  if p_dropoff_type not in ('SAME_DAY', 'NEXT_DAY') then
    raise exception '하차일 구분값이 올바르지 않습니다: %', p_dropoff_type;
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

  insert into public.dispatches (
    dispatch_date, client_id, origin, destination, dropoff_type,
    pallet_count, weight_ton,
    vehicle_id, plate_no_snapshot, driver_name_snapshot, driver_phone_snapshot,
    carrier_name, contact_name,
    total_amount, supply_amount, vat_amount, is_vat_exempt, fee_amount,
    payment_method, payment_status, memo
  ) values (
    p_dispatch_date, p_client_id, p_origin, p_destination, p_dropoff_type,
    p_pallet_count, p_weight_ton,
    p_vehicle_id, p_plate_no_snapshot, p_driver_name_snapshot, p_driver_phone_snapshot,
    p_carrier_name, p_contact_name,
    v_total_amount, p_supply_amount, v_vat_amount, p_is_vat_exempt, p_fee_amount,
    p_payment_method, 'UNPAID', p_memo
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
      'vehicle_id', p_vehicle_id,
      'plate_no_snapshot', p_plate_no_snapshot,
      'driver_name_snapshot', p_driver_name_snapshot,
      'driver_phone_snapshot', p_driver_phone_snapshot,
      'carrier_name', p_carrier_name,
      'contact_name', p_contact_name,
      'total_amount', v_total_amount,
      'supply_amount', p_supply_amount,
      'vat_amount', v_vat_amount,
      'is_vat_exempt', p_is_vat_exempt,
      'fee_amount', p_fee_amount,
      'payment_method', p_payment_method,
      'payment_status', 'UNPAID',
      'memo', p_memo
    )
  );

  return v_id;
end;
$$;

drop function if exists public.update_dispatch(
  uuid, date, uuid, text, text, integer, uuid, text, text, text, text, text,
  bigint, boolean, bigint, text, text
);

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
  p_supply_amount bigint,
  p_is_vat_exempt boolean,
  p_fee_amount bigint,
  p_payment_method text,
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
  from public.dispatches t
  where t.id = p_id and t.deleted_at is null;

  if v_before is null then
    raise exception '대상 배차를 찾을 수 없습니다: %', p_id;
  end if;

  if p_supply_amount < 0 or p_supply_amount > 99999999999 then
    raise exception '공급가액이 허용 범위를 벗어났습니다: %', p_supply_amount;
  end if;

  if p_fee_amount < 0 or p_fee_amount > 99999999999 then
    raise exception '수수료가 허용 범위를 벗어났습니다: %', p_fee_amount;
  end if;

  if p_dropoff_type not in ('SAME_DAY', 'NEXT_DAY') then
    raise exception '하차일 구분값이 올바르지 않습니다: %', p_dropoff_type;
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

  update public.dispatches set
    dispatch_date = p_dispatch_date,
    client_id = p_client_id,
    origin = p_origin,
    destination = p_destination,
    dropoff_type = p_dropoff_type,
    pallet_count = p_pallet_count,
    weight_ton = p_weight_ton,
    vehicle_id = p_vehicle_id,
    plate_no_snapshot = p_plate_no_snapshot,
    driver_name_snapshot = p_driver_name_snapshot,
    driver_phone_snapshot = p_driver_phone_snapshot,
    carrier_name = p_carrier_name,
    contact_name = p_contact_name,
    total_amount = v_total_amount,
    supply_amount = p_supply_amount,
    vat_amount = v_vat_amount,
    is_vat_exempt = p_is_vat_exempt,
    fee_amount = p_fee_amount,
    payment_method = p_payment_method,
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
