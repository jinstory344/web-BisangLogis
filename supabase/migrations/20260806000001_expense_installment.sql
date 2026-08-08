-- 지출 등록 폼에 할부(신용카드 결제 시 개월수) 필드 추가.
alter table public.expenses
  add column installment_months integer
    check (installment_months is null or (installment_months >= 1 and installment_months <= 12));
