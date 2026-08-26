-- 매출(sales)에서 "사업자정보"(carrier_name) 필드 제거.
-- 계산서발행할사업자(billing_entity_name)로 충분하다는 판단. carrier_name을
-- 쓰던 기존 3건(제이케이 x2, 흑룡운수 x1)은 원본 행 전체를 audit_logs에
-- 남겨 손실 없이 보존한 뒤 컬럼을 제거한다.

begin;

do $$
declare
  r record;
begin
  for r in select * from public.sales where carrier_name is not null
  loop
    perform public.write_audit_log(
      'sales',
      r.id,
      'UPDATE',
      to_jsonb(r),
      to_jsonb(r) - 'carrier_name'
    );
  end loop;
end $$;

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
      and p.proname in ('create_sale', 'update_sale')
  loop
    execute format('drop function %s', r.sig);
  end loop;
end $$;

alter table public.sales
  drop column carrier_name;

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
    memo,
    billing_entity_name, order_contact_phone
  ) values (
    p_sale_date, p_origin, p_destination,
    p_supply_amount, v_vat_amount, v_total_amount, p_is_vat_exempt,
    p_payment_method, 'UNPAID',
    p_source_major, p_source_minor, p_source_note,
    p_memo,
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
      'memo', p_memo,
      'billing_entity_name', p_billing_entity_name,
      'order_contact_phone', p_order_contact_phone
    )
  );

  return v_id;
end;
$function$;

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

commit;
