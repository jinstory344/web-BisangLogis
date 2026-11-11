-- 지출 분류(대분류/소분류)를 코드 상수에서 DB 테이블로 옮긴다.
-- 앱에서 분류를 직접 추가·삭제할 수 있게 하기 위함이다 (삭제는 소프트 삭제).
--
-- 한 테이블에 두 단계를 담는다:
--   - 대분류 행: minor가 null
--   - 소분류 행: minor가 값
-- 모든 대분류에는 소분류 "기타"가 하나 있다 (선택하면 폼에서 직접 입력한 값을 소분류로 저장하는 기존 동작).
--
-- 기존 지출(expenses)은 분류 이름을 글자로 그대로 가지고 있어서 이 테이블이 바뀌거나 삭제돼도 영향이 없다.
-- 전체가 한 트랜잭션이라 중간에 실패하면 아무것도 바뀌지 않는다.

begin;

create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  major text not null
    check (length(btrim(major)) between 1 and 20),
  minor text
    check (minor is null or length(btrim(minor)) between 1 and 20),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  deleted_at timestamptz
);

-- 삭제되지 않은 행끼리는 (대분류, 소분류)가 겹치지 않는다. 대분류 행은 minor가 null이라 빈 글자로 비교한다.
create unique index expense_categories_active_uniq
  on public.expense_categories (major, coalesce(minor, ''))
  where deleted_at is null;

create index expense_categories_deleted_at_idx
  on public.expense_categories (deleted_at);

create trigger expense_categories_set_updated_at
  before update on public.expense_categories
  for each row execute function public.set_updated_at();

alter table public.expense_categories enable row level security;

create policy "authenticated_full_access" on public.expense_categories
  for all to authenticated
  using (true)
  with check (true);

-- 지금 쓰고 있는 분류를 그대로 옮겨 담는다.
-- 대분류는 10, 20, 30, 40 / 소분류는 10씩 늘려 가고, "기타"는 항상 맨 뒤(9999).
insert into public.expense_categories (major, minor, sort_order)
values
  ('차량', null, 10),
  ('생활', null, 20),
  ('고정지출', null, 30),
  ('금융·세금', null, 40),

  ('차량', '유류', 10),
  ('차량', '요소수', 20),
  ('차량', '첨가제', 30),
  ('차량', '하이패스', 40),
  ('차량', '주차', 50),
  ('차량', '정비', 60),
  ('차량', '용품', 70),
  ('차량', '24시적립금', 80),
  ('차량', '기타', 9999),

  ('생활', '식비', 10),
  ('생활', '커피', 20),
  ('생활', '편의점', 30),
  ('생활', '우편', 40),
  ('생활', '숙박', 50),
  ('생활', '병원', 60),
  ('생활', '약국', 70),
  ('생활', '선물', 80),
  ('생활', '기타', 9999),

  ('고정지출', '관리비', 10),
  ('고정지출', '보험료', 20),
  ('고정지출', '세금', 30),
  ('고정지출', '기타', 9999),

  ('금융·세금', '대출', 10),
  ('금융·세금', '부가가치세', 20),
  ('금융·세금', '종합소득세', 30),
  ('금융·세금', '지방세', 40),
  ('금융·세금', '과태료', 50),
  ('금융·세금', '용차비', 60),
  ('금융·세금', '기타', 9999);

commit;
