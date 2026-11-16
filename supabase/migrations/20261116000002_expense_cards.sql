-- 지출 결제방법이 "카드"일 때 고르는 카드 이름(예: 신한복지, 우리기업).
--
-- 1) expense_cards: 카드 이름 목록. 앱에서 추가·이름 바꾸기·순서 바꾸기·삭제(소프트 삭제)한다.
-- 2) expenses.card_name: 고른 카드 이름을 글자로 저장한다(목록에서 지워도 지난 지출 표시는 그대로).
--
-- 전체가 하나의 트랜잭션이라 중간에 오류가 나면 아무것도 바뀌지 않는다.

begin;

create table public.expense_cards (
  id uuid primary key default gen_random_uuid(),
  name text not null
    check (length(btrim(name)) between 1 and 20),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  deleted_at timestamptz
);

-- 삭제되지 않은 카드끼리는 이름이 겹치지 않는다.
create unique index expense_cards_active_uniq
  on public.expense_cards (name)
  where deleted_at is null;

create trigger expense_cards_set_updated_at
  before update on public.expense_cards
  for each row execute function public.set_updated_at();

alter table public.expense_cards enable row level security;

create policy "authenticated_full_access" on public.expense_cards
  for all to authenticated
  using (true)
  with check (true);

alter table public.expenses
  add column card_name text
    check (card_name is null or length(btrim(card_name)) between 1 and 20);

commit;
