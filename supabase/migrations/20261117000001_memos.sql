-- 메모 (배차메모·업무메모)
--
-- kind = 'DISPATCH' 배차메모: 차주에게 보내는 배차내용 문구. 배차 목록의 [차주 문자] 판에서 골라 쓴다.
-- kind = 'WORK'     업무메모: 배차와 꼭 붙지 않아도 자주 확인하는 메모. 홈 오른쪽 아래 버튼에서 본다.
-- client_id 가 비어 있으면 공통(모든 거래처), 있으면 그 거래처 메모.
-- pinned = 맨 위 고정(★).
--
-- 전체가 하나의 트랜잭션이라 중간에 오류가 나면 아무것도 바뀌지 않는다.

begin;

create table public.memos (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('DISPATCH', 'WORK')),
  client_id uuid references public.clients (id),
  title text not null
    check (length(btrim(title)) between 1 and 100),
  body text not null default ''
    check (length(body) <= 5000),
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  deleted_at timestamptz
);

create index memos_kind_client_idx
  on public.memos (kind, client_id)
  where deleted_at is null;

create trigger memos_set_updated_at
  before update on public.memos
  for each row execute function public.set_updated_at();

alter table public.memos enable row level security;

create policy "authenticated_full_access" on public.memos
  for all to authenticated
  using (true)
  with check (true);

commit;
