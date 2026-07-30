-- RLS 정책
-- 이 앱은 관리자 1인 전용이며(4.1), 테이블에 별도 owner_id 컬럼을 두지 않는다(5장 스키마 고정, 지시문 #3).
-- 따라서 "인증된 소유자만 접근 가능"은 곧 "로그인한 사용자만 접근 가능"으로 구현한다.
-- service_role 키를 쓰는 서버 전용 클라이언트(admin.ts)는 RLS를 우회한다.

alter table public.clients enable row level security;
alter table public.vehicles enable row level security;
alter table public.dispatches enable row level security;
alter table public.expenses enable row level security;
alter table public.tax_invoices enable row level security;
alter table public.tax_invoice_dispatches enable row level security;
alter table public.purchase_invoices enable row level security;
alter table public.audit_logs enable row level security;
alter table public.settings enable row level security;

create policy "authenticated_full_access" on public.clients
  for all to authenticated
  using (true)
  with check (true);

create policy "authenticated_full_access" on public.vehicles
  for all to authenticated
  using (true)
  with check (true);

create policy "authenticated_full_access" on public.dispatches
  for all to authenticated
  using (true)
  with check (true);

create policy "authenticated_full_access" on public.expenses
  for all to authenticated
  using (true)
  with check (true);

create policy "authenticated_full_access" on public.tax_invoices
  for all to authenticated
  using (true)
  with check (true);

create policy "authenticated_full_access" on public.tax_invoice_dispatches
  for all to authenticated
  using (true)
  with check (true);

create policy "authenticated_full_access" on public.purchase_invoices
  for all to authenticated
  using (true)
  with check (true);

create policy "authenticated_full_access" on public.audit_logs
  for all to authenticated
  using (true)
  with check (true);

create policy "authenticated_full_access" on public.settings
  for all to authenticated
  using (true)
  with check (true);
