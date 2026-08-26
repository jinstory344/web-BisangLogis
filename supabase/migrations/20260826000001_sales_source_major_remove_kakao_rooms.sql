-- 출처 대분류에서 해피/에이스/스마일 제거.
-- 실제로는 "카카오톡" 채널 안의 오더방 이름이었을 뿐이라, 별도 대분류로
-- 노출할 필요가 없다는 판단(카카오톡 하나로 충분). 기존 5건 중 이 세
-- 값을 쓰는 행은 없음을 확인 후 진행.

alter table public.sales
  drop constraint sales_source_major_check;

alter table public.sales
  add constraint sales_source_major_check
  check (
    source_major is null
    or source_major in ('거래처', '지인', '카카오톡', '밴드', '24시콜화물', '기타')
  );

create or replace function public.create_sale(
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
set search_path to 'public'
as $function$
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
     and p_source_major not in ('거래처', '지인', '카카오톡', '밴드', '24시콜화물', '기타')
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
$function$;

create or replace function public.update_sale(
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
set search_path to 'public'
as $function$
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
     and p_source_major not in ('거래처', '지인', '카카오톡', '밴드', '24시콜화물', '기타')
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
$function$;
