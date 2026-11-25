-- 차계부: 11월 이전 정비 기록(사용자 엑셀 "포터 차계부"에서 옮긴 것). 보기 전용 목록.
-- 지출(가계부)과는 이어지지 않는다 — 돈 기록은 지출에 따로 있고, 이건 차 정비 이력만.
create table public.car_service_history (
  id uuid primary key default gen_random_uuid(),
  car_id uuid not null references public.cars (id),
  service_date date not null,
  odometer_km integer
    check (odometer_km is null or (odometer_km >= 0 and odometer_km <= 9999999)),
  -- 정비 내역(엑셀 칸 그대로, 줄바꿈 포함)
  content text not null check (length(btrim(content)) between 1 and 2000),
  amount bigint check (amount is null or (amount >= 0 and amount <= 99999999999)),
  vendor text check (vendor is null or length(vendor) <= 100),
  -- 같은 날 여러 건일 때 엑셀 순서
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  deleted_at timestamptz
);

create index car_service_history_car_date_idx
  on public.car_service_history (car_id, service_date)
  where deleted_at is null;

create trigger car_service_history_set_updated_at
  before update on public.car_service_history
  for each row execute function public.set_updated_at();

alter table public.car_service_history enable row level security;

create policy "authenticated_full_access" on public.car_service_history
  for all to authenticated
  using (true)
  with check (true);

grant all on table public.car_service_history to anon, authenticated, service_role;
