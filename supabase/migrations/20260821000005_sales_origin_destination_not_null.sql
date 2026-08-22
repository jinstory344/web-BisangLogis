-- QA 검증 후속 수정 — sales.origin / sales.destination에 NOT NULL 복원
--
-- 배경: 20260821000003에서 dispatches를 sales로 분리·이관할 때 origin/destination을
-- nullable(`origin text, destination text`)로 생성했는데, 원본인 dispatches는
-- 두 컬럼 모두 `text not null`이었다(20260730000001 스키마 77~78행).
-- 이관 과정에서 제약이 느슨해진 것으로, 원본과 동일하게 되돌린다.
--
-- 왜 지금 고치는가: database.types.ts의 SaleRow가 origin/destination을
-- `string`(non-null)으로 선언하고 zod도 .min(1) 필수라, 폼 경로로는 항상 값이 채워져
-- 현재 데이터에는 문제가 없다. 하지만 폼을 거치지 않는 다른 경로(예: 추후 엑셀 가져오기)로
-- null이 들어오면 타입을 신뢰하는 프론트 코드가 런타임에 깨진다. DB 제약이
-- 타입 선언과 어긋난 상태를 남겨두지 않는다.
--
-- 안전성: 적용 전 라이브에서 확인함 — sales 5행 전부 origin/destination에 값이 있고
-- (null 0건, 공백 문자열 0건), 따라서 SET NOT NULL이 기존 행을 거부하지 않는다.

alter table public.sales
  alter column origin set not null;

alter table public.sales
  alter column destination set not null;
