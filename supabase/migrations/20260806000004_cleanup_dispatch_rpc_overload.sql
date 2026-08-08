-- 이전 마이그레이션의 drop function 시그니처가 실제 함수와 달라(text 인자 하나 누락)
-- 이전 버전 함수가 삭제되지 않고 새 버전과 함께 오버로드로 남아있었다. 정리한다.

drop function if exists public.create_dispatch(
  date, uuid, text, text, text, integer, numeric, uuid, text, text, text, text, text,
  text, text, bigint, boolean, bigint, text, text
);

drop function if exists public.update_dispatch(
  uuid, date, uuid, text, text, text, integer, numeric, uuid, text, text, text, text, text,
  text, text, bigint, boolean, bigint, text, text
);
