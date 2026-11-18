-- 메모 종류에 "오더메모"(ORDER) 추가. 기존 배차(DISPATCH)·업무(WORK) 메모는 그대로.

begin;

alter table public.memos drop constraint memos_kind_check;

alter table public.memos
  add constraint memos_kind_check check (kind in ('DISPATCH', 'WORK', 'ORDER'));

commit;
