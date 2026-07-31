-- 3.7 배차 수정: create_dispatch와 동일한 서버측 부가세 재계산 로직을 사용해
-- 정합성을 유지하고, 수정 전/후 값을 감사 로그에 함께 남긴다.

create or replace function public.update_dispatch(
  p_id uuid,
  p_dispatch_date date,
  p_client_id uuid,
  p_origin text,
  p_destination text,
  p_pallet_count integer,
  p_vehicle_id uuid,
  p_plate_no_snapshot text,
  p_driver_name_snapshot text,
  p_driver_phone_snapshot text,
  p_carrier_name text,
  p_dispatcher_name text,
  p_total_amount bigint,
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
  v_supply_amount bigint;
  v_vat_amount bigint;
  v_numerator bigint;
  v_quotient bigint;
  v_remainder bigint;
  v_before jsonb;
begin
  select to_jsonb(t) into v_before
  from public.dispatches t
  where t.id = p_id and t.deleted_at is null;

  if v_before is null then
    raise exception '대상 배차를 찾을 수 없습니다: %', p_id;
  end if;

  if p_total_amount < 0 or p_total_amount > 99999999999 then
    raise exception '합계금액이 허용 범위를 벗어났습니다: %', p_total_amount;
  end if;

  if p_fee_amount < 0 or p_fee_amount > 99999999999 then
    raise exception '수수료가 허용 범위를 벗어났습니다: %', p_fee_amount;
  end if;

  if p_is_vat_exempt then
    v_supply_amount := p_total_amount;
    v_vat_amount := 0;
  else
    v_numerator := p_total_amount * 10;
    v_quotient := v_numerator / 11;
    v_remainder := v_numerator % 11;
    if v_remainder * 2 >= 11 then
      v_quotient := v_quotient + 1;
    end if;
    v_supply_amount := v_quotient;
    v_vat_amount := p_total_amount - v_supply_amount;
  end if;

  if v_supply_amount + v_vat_amount != p_total_amount then
    raise exception '부가세 정합성 오류: 공급가액(%) + 부가세(%) != 합계금액(%)',
      v_supply_amount, v_vat_amount, p_total_amount;
  end if;

  update public.dispatches set
    dispatch_date = p_dispatch_date,
    client_id = p_client_id,
    origin = p_origin,
    destination = p_destination,
    pallet_count = p_pallet_count,
    vehicle_id = p_vehicle_id,
    plate_no_snapshot = p_plate_no_snapshot,
    driver_name_snapshot = p_driver_name_snapshot,
    driver_phone_snapshot = p_driver_phone_snapshot,
    carrier_name = p_carrier_name,
    dispatcher_name = p_dispatcher_name,
    total_amount = p_total_amount,
    supply_amount = v_supply_amount,
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
