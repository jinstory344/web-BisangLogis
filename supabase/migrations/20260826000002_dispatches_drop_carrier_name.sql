-- 배차(dispatches)에서 "사업자"(carrier_name) 필드 제거.
-- 실사용 결과 불필요하다고 판단됨. 기존 유일한 배차 행의 carrier_name이
-- null임을 확인 후 진행 (데이터 손실 없음). sales.carrier_name("사업자정보")은
-- 별개 테이블이라 영향 없음.

begin;

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
      and p.proname in ('create_dispatch', 'update_dispatch')
  loop
    execute format('drop function %s', r.sig);
  end loop;
end $$;

alter table public.dispatches
  drop column carrier_name;

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
  p_contact_name text,
  p_memo text default null,
  p_cargo_box_type text default null,
  p_freight_amount bigint default null,
  p_fee_amount bigint default 0
)
returns uuid
language plpgsql
set search_path to 'public'
as $function$
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

  if p_freight_amount is not null
     and (p_freight_amount < 0 or p_freight_amount > 99999999999)
  then
    raise exception '운임이 허용 범위를 벗어났습니다: %', p_freight_amount;
  end if;

  v_fee_amount := coalesce(p_fee_amount, 0);
  if v_fee_amount < 0 or v_fee_amount > 99999999999 then
    raise exception '수수료가 허용 범위를 벗어났습니다: %', v_fee_amount;
  end if;

  insert into public.dispatches (
    dispatch_date, client_id, origin, destination, dropoff_type,
    pallet_count, weight_ton, cargo_box_type,
    vehicle_id, plate_no_snapshot, driver_name_snapshot, driver_phone_snapshot,
    contact_name, memo,
    freight_amount, fee_amount
  ) values (
    p_dispatch_date, p_client_id, p_origin, p_destination, p_dropoff_type,
    p_pallet_count, p_weight_ton, p_cargo_box_type,
    p_vehicle_id, p_plate_no_snapshot, p_driver_name_snapshot, p_driver_phone_snapshot,
    p_contact_name, p_memo,
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
      'contact_name', p_contact_name,
      'memo', p_memo,
      'freight_amount', p_freight_amount,
      'fee_amount', v_fee_amount
    )
  );

  return v_id;
end;
$function$;

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
  p_contact_name text,
  p_memo text default null,
  p_cargo_box_type text default null,
  p_freight_amount bigint default null,
  p_fee_amount bigint default 0
)
returns void
language plpgsql
set search_path to 'public'
as $function$
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
$function$;

commit;
