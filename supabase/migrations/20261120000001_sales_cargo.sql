-- 매출 "물량"(냉동3p)·"중량"(톤) 칸. 배차의 물량(20261118000002)과 같은 뜻.
-- 텔레그램 봇 매출에 "냉동 3, 1.0"을 쓰면 물량 냉동3p · 중량 1.0톤으로 들어간다.
-- 매출은 늘 내 차로 하므로 차종 칸은 만들지 않는다(사용자 요청).
--
-- 1) sales.cargo_note, sales.weight_ton 추가 (기존 건은 null)
-- 2) create_sale / update_sale 끝에 p_cargo_note, p_weight_ton (default null) 추가
--    기존 함수를 지우고 다시 만든다. 금액(부가세) 계산·검증은 지금 DB에 있는 정의와 똑같다.
--
-- 전체가 한 트랜잭션이라 중간에 실패하면 아무것도 바뀌지 않는다.

begin;

alter table public.sales
  add column cargo_note text,
  add column weight_ton numeric(6, 2) check (weight_ton is null or (weight_ton >= 0 and weight_ton < 10000));

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
  p_order_contact_phone text default null,
  p_client_id uuid default null,
  p_source_sub text default null,
  p_cargo_note text default null,
  p_weight_ton numeric default null
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

  -- 출처 대분류·하위분류는 앱에서 추가·삭제하는 목록(sale_sources)이라 이름 길이만 확인한다.
  -- (지운 출처로 등록했던 지난 매출도 그대로 수정할 수 있어야 한다)
  if p_source_major is not null and length(btrim(p_source_major)) not between 1 and 20 then
    raise exception '출처 대분류값이 올바르지 않습니다: %', p_source_major;
  end if;

  if p_source_sub is not null and length(btrim(p_source_sub)) not between 1 and 20 then
    raise exception '출처 하위분류값이 올바르지 않습니다: %', p_source_sub;
  end if;

  if p_client_id is not null then
    if p_source_major is distinct from '거래처' then
      raise exception '거래처 연결은 출처 대분류가 거래처일 때만 할 수 있습니다: %', p_source_major;
    end if;

    if not exists (
      select 1 from public.clients c
      where c.id = p_client_id and c.deleted_at is null
    ) then
      raise exception '거래처를 찾을 수 없습니다: %', p_client_id;
    end if;
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
    source_major, source_sub, source_minor, source_note,
    memo,
    billing_entity_name, order_contact_phone,
    client_id,
    cargo_note, weight_ton
  ) values (
    p_sale_date, p_origin, p_destination,
    p_supply_amount, v_vat_amount, v_total_amount, p_is_vat_exempt,
    p_payment_method, 'UNPAID',
    p_source_major, p_source_sub, p_source_minor, p_source_note,
    p_memo,
    p_billing_entity_name, p_order_contact_phone,
    p_client_id,
    nullif(btrim(p_cargo_note), ''), p_weight_ton
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
      'source_sub', p_source_sub,
      'source_minor', p_source_minor,
      'source_note', p_source_note,
      'memo', p_memo,
      'billing_entity_name', p_billing_entity_name,
      'order_contact_phone', p_order_contact_phone,
      'client_id', p_client_id,
      'cargo_note', nullif(btrim(p_cargo_note), ''),
      'weight_ton', p_weight_ton
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
  p_order_contact_phone text default null,
  p_client_id uuid default null,
  p_source_sub text default null,
  p_cargo_note text default null,
  p_weight_ton numeric default null
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

  -- 출처 대분류·하위분류는 앱에서 추가·삭제하는 목록(sale_sources)이라 이름 길이만 확인한다.
  -- (지운 출처로 등록했던 지난 매출도 그대로 수정할 수 있어야 한다)
  if p_source_major is not null and length(btrim(p_source_major)) not between 1 and 20 then
    raise exception '출처 대분류값이 올바르지 않습니다: %', p_source_major;
  end if;

  if p_source_sub is not null and length(btrim(p_source_sub)) not between 1 and 20 then
    raise exception '출처 하위분류값이 올바르지 않습니다: %', p_source_sub;
  end if;

  if p_client_id is not null then
    if p_source_major is distinct from '거래처' then
      raise exception '거래처 연결은 출처 대분류가 거래처일 때만 할 수 있습니다: %', p_source_major;
    end if;

    if not exists (
      select 1 from public.clients c
      where c.id = p_client_id and c.deleted_at is null
    ) then
      raise exception '거래처를 찾을 수 없습니다: %', p_client_id;
    end if;
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
    source_sub = p_source_sub,
    source_minor = p_source_minor,
    source_note = p_source_note,
    memo = p_memo,
    billing_entity_name = p_billing_entity_name,
    order_contact_phone = p_order_contact_phone,
    client_id = p_client_id,
    cargo_note = nullif(btrim(p_cargo_note), ''),
    weight_ton = p_weight_ton
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
