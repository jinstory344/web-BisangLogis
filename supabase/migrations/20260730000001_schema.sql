-- 비상로지스 초기 스키마 (PRD 5장 데이터 모델 기준)

create extension if not exists "pgcrypto" with schema extensions;

-- 모든 테이블 공통 updated_at 자동 갱신 트리거
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================================================
-- 5.1 clients — 거래처
-- =========================================================
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  biz_no text,
  ceo_name text,
  address text,
  biz_type text,
  biz_item text,
  contact_name text,
  contact_phone text,
  contact_email text,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  deleted_at timestamptz
);

create index clients_deleted_at_idx on public.clients (deleted_at);
create index clients_name_idx on public.clients (name);

create trigger clients_set_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

-- =========================================================
-- 5.2 vehicles — 차량·기사
-- =========================================================
create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  plate_no text not null,
  driver_name text not null,
  driver_phone text,
  carrier_name text,
  vehicle_type text,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  deleted_at timestamptz
);

-- 소프트 삭제되지 않은 차량번호만 유일해야 함
create unique index vehicles_plate_no_unique_idx
  on public.vehicles (plate_no)
  where deleted_at is null;

create index vehicles_deleted_at_idx on public.vehicles (deleted_at);

create trigger vehicles_set_updated_at
  before update on public.vehicles
  for each row execute function public.set_updated_at();

-- =========================================================
-- 5.3 dispatches — 배차 (매출과 1:1 연동)
-- =========================================================
create table public.dispatches (
  id uuid primary key default gen_random_uuid(),
  dispatch_date date not null,
  client_id uuid references public.clients (id),
  origin text not null,
  destination text not null,
  pallet_count integer,
  vehicle_id uuid references public.vehicles (id),
  plate_no_snapshot text,
  driver_name_snapshot text,
  driver_phone_snapshot text,
  carrier_name text,
  dispatcher_name text,
  total_amount bigint not null,
  supply_amount bigint not null,
  vat_amount bigint not null,
  is_vat_exempt boolean not null default false,
  fee_amount bigint not null default 0,
  payment_method text not null
    check (payment_method in ('TAX_INVOICE', 'TRANSFER', 'CASH')),
  payment_status text not null default 'UNPAID'
    check (payment_status in ('UNPAID', 'PAID')),
  paid_at date,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  deleted_at timestamptz,
  -- 4.3 금액·정확성 규칙: 공급가액 + 부가세 = 합계금액, 모든 금액은 0 이상
  constraint dispatches_amount_sum_check
    check (supply_amount + vat_amount = total_amount),
  constraint dispatches_amount_nonneg_check
    check (
      total_amount >= 0 and total_amount <= 99999999999
      and supply_amount >= 0
      and vat_amount >= 0
      and fee_amount >= 0
    )
);

create index dispatches_deleted_at_idx on public.dispatches (deleted_at);
create index dispatches_dispatch_date_idx on public.dispatches (dispatch_date desc);
create index dispatches_client_id_idx on public.dispatches (client_id);
create index dispatches_vehicle_id_idx on public.dispatches (vehicle_id);
create index dispatches_payment_status_idx on public.dispatches (payment_status);
-- 4.3.6 중복 입력 감지 조회용
create index dispatches_dup_check_idx
  on public.dispatches (dispatch_date, client_id, origin, destination, total_amount);

create trigger dispatches_set_updated_at
  before update on public.dispatches
  for each row execute function public.set_updated_at();

-- =========================================================
-- 5.4 expenses — 지출
-- =========================================================
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null,
  category_major text not null,
  category_minor text not null,
  amount bigint not null
    check (amount >= 0 and amount <= 99999999999),
  payment_method text
    check (payment_method in ('CARD', 'TRANSFER', 'CASH')),
  vendor text,
  has_tax_invoice boolean not null default false,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  deleted_at timestamptz
);

create index expenses_deleted_at_idx on public.expenses (deleted_at);
create index expenses_expense_date_idx on public.expenses (expense_date desc);
create index expenses_category_idx on public.expenses (category_major, category_minor);

create trigger expenses_set_updated_at
  before update on public.expenses
  for each row execute function public.set_updated_at();

-- =========================================================
-- 5.5 tax_invoices — 세금계산서 (발행/매출)
-- =========================================================
create table public.tax_invoices (
  id uuid primary key default gen_random_uuid(),
  issue_date date not null,
  client_id uuid references public.clients (id),
  mode text not null
    check (mode in ('MANUAL', 'POPBILL')),
  status text not null
    check (status in ('RECORDED', 'ISSUED', 'SENT', 'FAILED', 'CANCELLED')),
  supply_amount bigint not null check (supply_amount >= 0),
  vat_amount bigint not null check (vat_amount >= 0),
  total_amount bigint not null check (total_amount >= 0),
  item_name text default '운송용역',
  popbill_mgt_key text,
  popbill_nts_confirm_num text,
  popbill_error_message text,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  deleted_at timestamptz,
  constraint tax_invoices_amount_sum_check
    check (supply_amount + vat_amount = total_amount)
);

create index tax_invoices_deleted_at_idx on public.tax_invoices (deleted_at);
create index tax_invoices_issue_date_idx on public.tax_invoices (issue_date desc);
create index tax_invoices_client_id_idx on public.tax_invoices (client_id);
create index tax_invoices_status_idx on public.tax_invoices (status);

create trigger tax_invoices_set_updated_at
  before update on public.tax_invoices
  for each row execute function public.set_updated_at();

-- =========================================================
-- 5.6 tax_invoice_dispatches — 계산서-배차 연결 (N:M)
-- =========================================================
create table public.tax_invoice_dispatches (
  id uuid primary key default gen_random_uuid(),
  tax_invoice_id uuid not null references public.tax_invoices (id),
  dispatch_id uuid not null references public.dispatches (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  deleted_at timestamptz,
  constraint tax_invoice_dispatches_unique unique (tax_invoice_id, dispatch_id)
);

create index tax_invoice_dispatches_invoice_idx on public.tax_invoice_dispatches (tax_invoice_id);
create index tax_invoice_dispatches_dispatch_idx on public.tax_invoice_dispatches (dispatch_id);

create trigger tax_invoice_dispatches_set_updated_at
  before update on public.tax_invoice_dispatches
  for each row execute function public.set_updated_at();

-- =========================================================
-- 5.7 purchase_invoices — 매입 계산서 (조회 결과 저장)
-- =========================================================
create table public.purchase_invoices (
  id uuid primary key default gen_random_uuid(),
  issue_date date,
  supplier_name text,
  supplier_biz_no text,
  supply_amount bigint check (supply_amount >= 0),
  vat_amount bigint check (vat_amount >= 0),
  total_amount bigint check (total_amount >= 0),
  nts_confirm_num text,
  source text
    check (source in ('POPBILL', 'MANUAL')),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  deleted_at timestamptz
);

create index purchase_invoices_deleted_at_idx on public.purchase_invoices (deleted_at);
create index purchase_invoices_issue_date_idx on public.purchase_invoices (issue_date desc);

create trigger purchase_invoices_set_updated_at
  before update on public.purchase_invoices
  for each row execute function public.set_updated_at();

-- =========================================================
-- 5.8 audit_logs — 변경 이력 (불변 로그: updated_at/deleted_at 없음)
-- =========================================================
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id uuid not null,
  action text not null
    check (action in ('CREATE', 'UPDATE', 'DELETE', 'RESTORE')),
  before_data jsonb,
  after_data jsonb,
  actor_id uuid,
  created_at timestamptz not null default now()
);

create index audit_logs_table_record_idx on public.audit_logs (table_name, record_id);
create index audit_logs_created_at_idx on public.audit_logs (created_at desc);

-- =========================================================
-- 5.9 settings — 내 사업자 정보 / 연동 설정 (단일 행)
-- =========================================================
create table public.settings (
  id uuid primary key default gen_random_uuid(),
  my_biz_name text,
  my_biz_no text,
  my_ceo_name text,
  my_address text,
  my_biz_type text,
  my_biz_item text,
  popbill_enabled boolean not null default false,
  popbill_corp_num text,
  popbill_user_id text,
  popbill_is_test boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  deleted_at timestamptz
);

create trigger settings_set_updated_at
  before update on public.settings
  for each row execute function public.set_updated_at();

-- 단일 행 보장: 항상 고정 id로만 조회·갱신한다.
insert into public.settings (id, popbill_is_test)
values ('00000000-0000-0000-0000-000000000001', true);
