-- 거래처 상단 고정: 값이 있으면 고정(1부터 순서), 없으면 일반. 최대 10곳은 앱에서 지킨다.
alter table public.clients
  add column pin_order smallint
  check (pin_order between 1 and 10);
