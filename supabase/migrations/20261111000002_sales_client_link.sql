-- 매출(sales)에 거래처 연결(client_id) 추가.
--
-- 매출 폼에서 출처 대분류가 "거래처"일 때 소분류를 거래처 명단(clients)에서 고르게 되면서,
-- 어떤 거래처의 매출인지 연결해 둔다. 배차(dispatches)와 같은 방식(clients 참조)이며,
-- 배차와 매출 사이의 연결이 아니라 둘 다 같은 거래처 명단을 가리킬 뿐이다.
--   - source_minor(이름)는 그대로 남긴다: 거래처 이름을 나중에 바꿔도 지난 매출 표시는 변하지 않는다.
--   - client_id는 출처 대분류가 "거래처"인 건에만 의미가 있다 (그 외 출처는 null).
--
-- 1) 컬럼·인덱스 추가
-- 2) 기존 "거래처" 출처 건 중 이름이 삭제되지 않은 거래처 한 곳과 정확히 일치하는 건만 연결
--    (연결할 때마다 audit_logs에 변경 전/후를 남긴다)
-- 3) create_sale / update_sale에 p_client_id 추가 (기존 오버로드를 모두 지우고 다시 만든다)
--
-- 전체가 하나의 트랜잭션이라 중간에 오류가 나면 아무것도 바뀌지 않는다.

begin;

alter table public.sales
  add column client_id uuid references public.clients (id);

create index sales_client_id_idx on public.sales (client_id);

do $$
declare
  r record;
  v_before jsonb;
begin
  for r in
    select s.id as sale_id, c.id as client_id
    from public.sales s
    join public.clients c
      on c.name = s.source_minor
     and c.deleted_at is null
    where s.source_major = '거래처'
      and s.client_id is null
      and s.deleted_at is null
      and (
        select count(*)
        from public.clients c2
        where c2.name = s.source_minor
          and c2.deleted_at is null
      ) = 1
  loop
    select to_jsonb(t) into v_before from public.sales t where t.id = r.sale_id;

    update public.sales set client_id = r.client_id where id = r.sale_id;

    perform public.write_audit_log(
      'sales',
      r.sale_id,
      'UPDATE',
      v_before,
      (select to_jsonb(t) from public.sales t where t.id = r.sale_id)
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
  p_client_id uuid default null
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
    source_major, source_minor, source_note,
    memo,
    billing_entity_name, order_contact_phone,
    client_id
  ) values (
    p_sale_date, p_origin, p_destination,
    p_supply_amount, v_vat_amount, v_total_amount, p_is_vat_exempt,
    p_payment_method, 'UNPAID',
    p_source_major, p_source_minor, p_source_note,
    p_memo,
    p_billing_entity_name, p_order_contact_phone,
    p_client_id
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
      'order_contact_phone', p_order_contact_phone,
      'client_id', p_client_id
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
  p_client_id uuid default null
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
    source_minor = p_source_minor,
    source_note = p_source_note,
    memo = p_memo,
    billing_entity_name = p_billing_entity_name,
    order_contact_phone = p_order_contact_phone,
    client_id = p_client_id
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
