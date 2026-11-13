-- 매출 출처를 세 단계로: 대분류 › 하위분류(예: 카카오톡 › 스마일) › 오더자(source_minor, 그대로).
--
-- 1) sale_sources: 출처 대분류·하위분류 목록. 앱에서 직접 추가·삭제한다(소프트 삭제).
--    - 대분류 행: sub가 null / 하위분류 행: sub가 값
--    - "거래처" 대분류는 하위분류 대신 거래처 명단(clients)에서 고른다(앱 규칙).
-- 2) sales.source_sub: 고른 하위분류 이름을 글자로 저장한다(목록에서 지워도 지난 매출 표시는 그대로).
-- 3) 출처 대분류를 고정된 6개로만 받던 제약을 이름 길이 제약으로 바꾼다(새 대분류를 추가할 수 있게).
-- 4) create_sale / update_sale에 p_source_sub 추가 (기존 오버로드를 모두 지우고 다시 만든다).
--
-- 전체가 하나의 트랜잭션이라 중간에 오류가 나면 아무것도 바뀌지 않는다.

begin;

create table public.sale_sources (
  id uuid primary key default gen_random_uuid(),
  major text not null
    check (length(btrim(major)) between 1 and 20),
  sub text
    check (sub is null or length(btrim(sub)) between 1 and 20),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  deleted_at timestamptz
);

-- 삭제되지 않은 행끼리는 (대분류, 하위분류)가 겹치지 않는다. 대분류 행은 sub가 null이라 빈 글자로 비교한다.
create unique index sale_sources_active_uniq
  on public.sale_sources (major, coalesce(sub, ''))
  where deleted_at is null;

create index sale_sources_deleted_at_idx
  on public.sale_sources (deleted_at);

create trigger sale_sources_set_updated_at
  before update on public.sale_sources
  for each row execute function public.set_updated_at();

alter table public.sale_sources enable row level security;

create policy "authenticated_full_access" on public.sale_sources
  for all to authenticated
  using (true)
  with check (true);

-- 지금 쓰는 출처 대분류 + 카카오톡 오더방(예전에 대분류였다가 빠진 해피·에이스·스마일)
insert into public.sale_sources (major, sub, sort_order)
values
  ('거래처', null, 10),
  ('지인', null, 20),
  ('카카오톡', null, 30),
  ('밴드', null, 40),
  ('24시콜화물', null, 50),
  ('기타', null, 60),
  ('카카오톡', '스마일', 10),
  ('카카오톡', '해피', 20),
  ('카카오톡', '에이스', 30);

alter table public.sales
  add column source_sub text
    check (source_sub is null or length(btrim(source_sub)) between 1 and 20);

alter table public.sales
  drop constraint sales_source_major_check;

alter table public.sales
  add constraint sales_source_major_check
  check (source_major is null or length(btrim(source_major)) between 1 and 20);

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
  p_source_sub text default null
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
    client_id
  ) values (
    p_sale_date, p_origin, p_destination,
    p_supply_amount, v_vat_amount, v_total_amount, p_is_vat_exempt,
    p_payment_method, 'UNPAID',
    p_source_major, p_source_sub, p_source_minor, p_source_note,
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
      'source_sub', p_source_sub,
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
  p_client_id uuid default null,
  p_source_sub text default null
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
