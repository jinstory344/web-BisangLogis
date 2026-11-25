-- 차계부 1단계
--
-- 1) cars: 차 목록. 기본 행 '내 트럭'(업무용), '승용차'(개인).
-- 2) expenses.odometer_km: 지출(차량 › 정비·주유비·요소수)에 적는 주행거리(km).
-- 3) car_items: 항목 목록. kind='service' 정비 세부 항목(트럭·승용차 공용), kind='log' 승용차 기록 종류.
-- 4) car_logs: 차계부에만 쓰는 기록(승용차 등). 지출·HOME·통계·검색·백업에 섞지 않는다. 소프트 삭제 → 휴지통.
-- 5) car_service_items: 정비 항목 줄. 지출(할부면 첫 회차 줄) 또는 car_logs 한쪽에만 붙는다.
--    저장할 때 그 기록의 줄을 모두 지우고 다시 넣는 "하위 줄" 표라 deleted_at이 없다
--    (변경 이력은 부모 기록의 감사 로그 after_data에 줄 목록을 함께 남긴다).
-- 6) car_item_cycles: 교체 주기 표(차·항목별). 트럭 기본 행 '엔진오일'(주기 비움).
-- 7) 예전 지출 소분류 '엔진오일' → '정비' + 항목 줄 '엔진오일'. 분류표의 '차량 › 엔진오일' 소프트 삭제.
-- 8) soft_delete / restore_deleted / purge_deleted / purge_expired_trash 허용 목록에 car_logs 추가.
--    (write_audit_log는 표 이름 허용 목록이 없고 action만 검사하므로 고치지 않는다.)
--
-- 전체가 하나의 트랜잭션이라 중간에 오류가 나면 아무것도 바뀌지 않는다.

begin;

-- ─────────────────────────────────────────────
-- 1) cars
-- ─────────────────────────────────────────────
create table public.cars (
  id uuid primary key default gen_random_uuid(),
  name text not null
    check (length(btrim(name)) between 1 and 20),
  plate_no text
    check (plate_no is null or length(btrim(plate_no)) between 1 and 20),
  kind text not null check (kind in ('business', 'personal')),
  sort_order integer not null default 0,
  memo text
    check (memo is null or length(memo) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  deleted_at timestamptz
);

create trigger cars_set_updated_at
  before update on public.cars
  for each row execute function public.set_updated_at();

alter table public.cars enable row level security;

create policy "authenticated_full_access" on public.cars
  for all to authenticated
  using (true)
  with check (true);

insert into public.cars (name, kind, sort_order) values
  ('내 트럭', 'business', 0),
  ('승용차', 'personal', 10);

-- ─────────────────────────────────────────────
-- 2) expenses.odometer_km
-- ─────────────────────────────────────────────
alter table public.expenses
  add column odometer_km integer
    check (odometer_km is null or (odometer_km >= 0 and odometer_km <= 9999999));

-- ─────────────────────────────────────────────
-- 3) car_items
-- ─────────────────────────────────────────────
create table public.car_items (
  id uuid primary key default gen_random_uuid(),
  name text not null
    check (length(btrim(name)) between 1 and 20),
  kind text not null check (kind in ('service', 'log')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  deleted_at timestamptz
);

-- 살아 있는 것끼리 (종류, 이름)이 겹치지 않는다.
create unique index car_items_active_uniq
  on public.car_items (kind, name)
  where deleted_at is null;

create trigger car_items_set_updated_at
  before update on public.car_items
  for each row execute function public.set_updated_at();

alter table public.car_items enable row level security;

create policy "authenticated_full_access" on public.car_items
  for all to authenticated
  using (true)
  with check (true);

insert into public.car_items (kind, name, sort_order)
select 'service', t.name, t.ord * 10
from unnest(array[
  '엔진오일', '미션오일', '데후오일', '타이어', '브레이크 라이닝', '브레이크 패드',
  '배터리', '에어필터', '에어컨필터', '와이퍼', '냉각수', '얼라인먼트'
]) with ordinality as t(name, ord);

-- 주유·정비는 화면에서 지우지 못하게 막는다(DB에서는 막지 않음).
insert into public.car_items (kind, name, sort_order) values
  ('log', '주유', 10),
  ('log', '정비', 20),
  ('log', '세차', 30);

-- ─────────────────────────────────────────────
-- 4) car_logs
-- ─────────────────────────────────────────────
create table public.car_logs (
  id uuid primary key default gen_random_uuid(),
  car_id uuid not null references public.cars (id),
  log_date date not null,
  -- car_items(kind='log')의 이름을 글자로 저장(목록에서 지워도 지난 기록 표시는 그대로)
  kind text not null
    check (length(btrim(kind)) between 1 and 20),
  amount bigint not null
    check (amount >= 0 and amount <= 99999999999),
  liters numeric(7, 1)
    check (liters is null or (liters > 0 and liters < 100000)),
  odometer_km integer
    check (odometer_km is null or (odometer_km >= 0 and odometer_km <= 9999999)),
  vendor text,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  deleted_at timestamptz
);

create index car_logs_car_date_idx
  on public.car_logs (car_id, log_date desc)
  where deleted_at is null;

create index car_logs_deleted_at_idx on public.car_logs (deleted_at);

create trigger car_logs_set_updated_at
  before update on public.car_logs
  for each row execute function public.set_updated_at();

alter table public.car_logs enable row level security;

create policy "authenticated_full_access" on public.car_logs
  for all to authenticated
  using (true)
  with check (true);

-- ─────────────────────────────────────────────
-- 5) car_service_items
-- ─────────────────────────────────────────────
create table public.car_service_items (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid references public.expenses (id) on delete cascade,
  car_log_id uuid references public.car_logs (id) on delete cascade,
  item text not null
    check (length(btrim(item)) between 1 and 30),
  amount bigint
    check (amount is null or (amount >= 0 and amount <= 99999999999)),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  -- 지출 또는 차계부 기록 중 정확히 하나에만 붙는다
  constraint car_service_items_one_parent check (num_nonnulls(expense_id, car_log_id) = 1)
);

create index car_service_items_expense_idx
  on public.car_service_items (expense_id)
  where expense_id is not null;

create index car_service_items_car_log_idx
  on public.car_service_items (car_log_id)
  where car_log_id is not null;

create index car_service_items_item_idx on public.car_service_items (item);

alter table public.car_service_items enable row level security;

create policy "authenticated_full_access" on public.car_service_items
  for all to authenticated
  using (true)
  with check (true);

-- ─────────────────────────────────────────────
-- 6) car_item_cycles
-- ─────────────────────────────────────────────
create table public.car_item_cycles (
  id uuid primary key default gen_random_uuid(),
  car_id uuid not null references public.cars (id),
  item text not null
    check (length(btrim(item)) between 1 and 30),
  cycle_km integer
    check (cycle_km is null or (cycle_km >= 1 and cycle_km <= 9999999)),
  -- 최근 교체를 직접 고친 값(비어 있으면 정비 기록에서 자동)
  manual_date date,
  manual_km integer
    check (manual_km is null or (manual_km >= 0 and manual_km <= 9999999)),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  -- 행 삭제도 소프트 삭제(감사 규칙). 지운 뒤 같은 항목을 다시 추가하면 새 행.
  deleted_at timestamptz
);

-- 살아 있는 것끼리 (차, 항목)이 겹치지 않는다.
create unique index car_item_cycles_active_uniq
  on public.car_item_cycles (car_id, item)
  where deleted_at is null;

create trigger car_item_cycles_set_updated_at
  before update on public.car_item_cycles
  for each row execute function public.set_updated_at();

alter table public.car_item_cycles enable row level security;

create policy "authenticated_full_access" on public.car_item_cycles
  for all to authenticated
  using (true)
  with check (true);

insert into public.car_item_cycles (car_id, item, sort_order)
select id, '엔진오일', 0 from public.cars where name = '내 트럭' and kind = 'business';

-- ─────────────────────────────────────────────
-- 권한: 서울 새 프로젝트에서 누락된 적이 있어 기존 표(memos 등)와 똑같이 직접 준다.
-- ─────────────────────────────────────────────
grant all on table
  public.cars, public.car_items, public.car_logs, public.car_service_items, public.car_item_cycles
  to anon, authenticated, service_role;

-- ─────────────────────────────────────────────
-- 7) 예전 지출 소분류 '엔진오일' → '정비' + 항목 줄 '엔진오일'
--    휴지통에 있는 줄(지운 할부 묶음)도 함께 옮겨, 되살렸을 때 분류가 맞도록 한다.
--    항목 줄은 일시불 줄 또는 할부 첫 회차 줄에만 붙이고, 금액은 일시불=그 금액, 할부=묶음 합계.
-- ─────────────────────────────────────────────
do $$
declare
  r record;
  v_after jsonb;
  v_item_amount bigint;
  v_items jsonb;
begin
  for r in
    select e.*, to_jsonb(e) as before_data
    from public.expenses e
    where e.category_major = '차량' and e.category_minor = '엔진오일'
    order by e.expense_date, e.installment_no nulls first
  loop
    update public.expenses set category_minor = '정비' where id = r.id;

    v_items := '[]'::jsonb;
    if r.installment_group_id is null or r.installment_no = 1 then
      if r.installment_group_id is null then
        v_item_amount := r.amount;
      else
        select sum(amount) into v_item_amount
        from public.expenses
        where installment_group_id = r.installment_group_id;
      end if;

      insert into public.car_service_items (expense_id, item, amount, sort_order)
      values (r.id, '엔진오일', v_item_amount, 0);

      v_items := jsonb_build_array(jsonb_build_object('item', '엔진오일', 'amount', v_item_amount));
    end if;

    select to_jsonb(e) || jsonb_build_object('car_service_items', v_items)
      into v_after
    from public.expenses e where e.id = r.id;

    perform public.write_audit_log('expenses', r.id, 'UPDATE', r.before_data, v_after);
  end loop;

  for r in
    select c.id, to_jsonb(c) as before_data
    from public.expense_categories c
    where c.major = '차량' and c.minor = '엔진오일' and c.deleted_at is null
  loop
    update public.expense_categories set deleted_at = now() where id = r.id;
    perform public.write_audit_log('expense_categories', r.id, 'DELETE', r.before_data, null);
  end loop;
end;
$$;

-- ─────────────────────────────────────────────
-- 8) 소프트 삭제·복구·완전 삭제 함수에 car_logs 추가 (시그니처 그대로, 본문은 라이브 정의 + car_logs)
-- ─────────────────────────────────────────────
create or replace function public.soft_delete(p_table_name text, p_record_id uuid)
returns void
language plpgsql
set search_path to 'public'
as $function$
declare
  v_before jsonb;
begin
  if p_table_name not in
    ('clients', 'vehicles', 'dispatches', 'sales', 'expenses', 'tax_invoices', 'purchase_invoices', 'car_logs')
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
$function$;

create or replace function public.restore_deleted(p_table_name text, p_record_id uuid)
returns void
language plpgsql
set search_path to 'public'
as $function$
declare
  v_before jsonb;
  v_after jsonb;
begin
  if p_table_name not in
    ('clients', 'vehicles', 'dispatches', 'sales', 'expenses', 'tax_invoices', 'purchase_invoices', 'memos', 'car_logs')
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
$function$;

-- car_logs를 완전 삭제하면 그 정비 항목 줄(car_service_items)은 on delete cascade로 함께 지워진다.
-- 지출(expenses)을 완전 삭제할 때도 마찬가지.
create or replace function public.purge_deleted(p_table_name text, p_record_id uuid)
returns void
language plpgsql
set search_path to 'public'
as $function$
declare
  v_before jsonb;
begin
  if p_table_name not in ('clients', 'vehicles', 'dispatches', 'sales', 'expenses', 'memos', 'car_logs') then
    raise exception '완전 삭제를 지원하지 않는 테이블: %', p_table_name;
  end if;

  execute format(
    'select to_jsonb(t) from public.%I t where id = $1 and deleted_at is not null',
    p_table_name
  ) into v_before using p_record_id;

  if v_before is null then
    raise exception '휴지통에 없는 항목이에요: % (%)', p_table_name, p_record_id;
  end if;

  if p_table_name = 'clients' and (
    exists (select 1 from public.dispatches where client_id = p_record_id)
    or exists (select 1 from public.sales where client_id = p_record_id)
    or exists (select 1 from public.memos where client_id = p_record_id)
    or exists (select 1 from public.tax_invoices where client_id = p_record_id)
  ) then
    raise exception '이 거래처를 쓰는 배차·매출·메모 기록이 있어서 완전히 지울 수 없어요';
  end if;

  if p_table_name = 'dispatches'
    and exists (select 1 from public.tax_invoice_dispatches where dispatch_id = p_record_id)
  then
    raise exception '세금계산서에 묶인 배차라 완전히 지울 수 없어요';
  end if;

  if p_table_name = 'vehicles' then
    -- 배차에는 차량번호·차주가 따로 적혀 있어 연결만 끊어도 기록이 남는다
    update public.dispatches set vehicle_id = null where vehicle_id = p_record_id;
  end if;

  execute format('delete from public.%I where id = $1', p_table_name) using p_record_id;

  perform public.write_audit_log(p_table_name, p_record_id, 'PURGE', v_before, null);
end;
$function$;

create or replace function public.purge_expired_trash()
returns integer
language plpgsql
set search_path to 'public'
as $function$
declare
  v_table text;
  v_id uuid;
  v_count integer := 0;
begin
  -- 거래처·차량은 그 기록(배차·매출·메모)이 먼저 지워진 뒤에 지워지도록 맨 뒤에
  foreach v_table in array array['memos', 'car_logs', 'dispatches', 'sales', 'expenses', 'vehicles', 'clients'] loop
    for v_id in execute format(
      'select id from public.%I where deleted_at is not null and deleted_at < now() - interval ''30 days''',
      v_table
    ) loop
      begin
        perform public.purge_deleted(v_table, v_id);
        v_count := v_count + 1;
      exception when others then
        -- 지울 수 없는 건(기록이 있는 거래처 등)은 건너뛰고 휴지통에 남긴다
        null;
      end;
    end loop;
  end loop;
  return v_count;
end;
$function$;

commit;
