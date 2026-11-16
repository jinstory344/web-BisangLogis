-- 메모 순서 바꾸기: memos.sort_order (작을수록 위). 지금 있는 메모는 최근에 만든 것이 위로 오게 채운다.

begin;

alter table public.memos
  add column sort_order integer not null default 0;

update public.memos m
set sort_order = s.rn * 10
from (
  select id, row_number() over (order by created_at desc) as rn
  from public.memos
) s
where s.id = m.id;

commit;
