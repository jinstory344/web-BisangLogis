-- 감사 기록 함수(write_audit_log)가 'PURGE'(휴지통 완전 삭제)를 받게 한다.
-- 20261120000002에서 audit_logs 표의 검사만 넓히고, 이 함수 안의 허용 목록은 빠뜨려서
-- 휴지통 [삭제]가 "알 수 없는 action: PURGE"로 막혔다. 나머지 동작은 그대로.

create or replace function public.write_audit_log(
  p_table_name text,
  p_record_id uuid,
  p_action text,
  p_before_data jsonb default null,
  p_after_data jsonb default null
)
returns void
language plpgsql
set search_path to 'public'
as $function$
begin
  if p_action not in ('CREATE', 'UPDATE', 'DELETE', 'RESTORE', 'PURGE') then
    raise exception '알 수 없는 action: %', p_action;
  end if;

  insert into public.audit_logs
    (table_name, record_id, action, before_data, after_data, actor_id)
  values
    (p_table_name, p_record_id, p_action, p_before_data, p_after_data, auth.uid());
end;
$function$;
