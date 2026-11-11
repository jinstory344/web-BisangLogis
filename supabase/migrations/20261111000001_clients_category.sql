-- 거래처 구분(내 거래처 / 타 거래처).
--
-- 한 명단 안에서 보기 편하게 걸러 주는 표시일 뿐이라 입력 항목이나 동작은 구분에 따라 달라지지 않는다.
--   MINE  = 내 거래처 (나에게 배차·차량 섭외를 요청하는 단골 업체 등)
--   OTHER = 타 거래처 (매출 오더를 주는 그 밖의 업체)
--
-- 기존 거래처의 처음 값은 사용 이력으로 정한다 (앱의 거래처 수정 화면에서 바꿀 수 있다):
--   삭제되지 않은 배차 이력이 있으면 MINE, 없으면 OTHER.
--
-- 주의: 아래 update는 set_updated_at 트리거 때문에 바뀐 행의 updated_at도 갱신한다.

alter table public.clients
  add column category text not null default 'MINE',
  add constraint clients_category_check check (category in ('MINE', 'OTHER'));

update public.clients c
set category = 'OTHER'
where not exists (
  select 1
  from public.dispatches d
  where d.client_id = c.id
    and d.deleted_at is null
);
