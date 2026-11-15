-- 카드 할부 지출을 달마다 한 줄씩 나눠 저장한다.
-- 같은 할부의 줄들은 installment_group_id가 같고, installment_no가 회차(1부터)다.
-- 일시불·예전 지출은 두 칸 모두 null이라 영향이 없다.
alter table public.expenses
  add column installment_group_id uuid,
  add column installment_no integer
    check (installment_no is null or (installment_no >= 1 and installment_no <= 12));

create index expenses_installment_group_idx
  on public.expenses (installment_group_id)
  where installment_group_id is not null;
