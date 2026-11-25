-- 지출 결제방법에 토스페이·카카오페이 추가 (사용자 요청 2026-11-26)
alter table public.expenses drop constraint expenses_payment_method_check;
alter table public.expenses add constraint expenses_payment_method_check
  check (payment_method in ('CARD', 'TRANSFER', 'CASH', 'TOSS_PAY', 'KAKAO_PAY'));
