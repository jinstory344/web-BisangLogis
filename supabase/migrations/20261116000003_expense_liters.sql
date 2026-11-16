-- 지출(차량 › 주유비·요소수)에 넣은 양(리터). 안 적어도 된다(null). 소수 첫째 자리까지.
-- 통계 › 지출에서 이번 달 리터와 월 평균 리터를 보여 준다.
alter table public.expenses
  add column liters numeric(7, 1)
    check (liters is null or (liters > 0 and liters < 100000));
