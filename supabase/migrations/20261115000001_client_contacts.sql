-- 거래처 담당자 여러 명: 거래처마다 담당자(이름·전화)를 여러 줄로 둔다.
-- clients.contact_name/contact_phone은 첫 번째 담당자로 계속 맞춰 둔다(예전 화면·기능이 그대로 쓰도록).
create table public.client_contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 30),
  phone text check (phone is null or length(btrim(phone)) between 1 and 30),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  deleted_at timestamptz
);

create index client_contacts_client_idx on public.client_contacts (client_id) where deleted_at is null;

create trigger client_contacts_set_updated_at
  before update on public.client_contacts
  for each row execute function public.set_updated_at();

alter table public.client_contacts enable row level security;

create policy "authenticated_full_access" on public.client_contacts
  for all to authenticated
  using (true)
  with check (true);

-- 1) 지금 거래처에 적힌 담당자를 첫 번째 담당자로 옮긴다
insert into public.client_contacts (client_id, name, phone, sort_order)
select id, btrim(contact_name), nullif(btrim(contact_phone), ''), 0
from public.clients
where deleted_at is null and nullif(btrim(contact_name), '') is not null;

-- 2) 배차에 적힌 다른 담당자도 채운다 (예: 아토무역의 이재근). 전화는 배차에 적힌 것이 있으면.
insert into public.client_contacts (client_id, name, phone, sort_order)
select d.client_id, btrim(d.contact_name), max(nullif(btrim(d.contact_phone), '')), 10
from public.dispatches d
join public.clients c on c.id = d.client_id and c.deleted_at is null
where d.deleted_at is null
  and nullif(btrim(d.contact_name), '') is not null
  and not exists (
    select 1 from public.client_contacts cc
    where cc.client_id = d.client_id and cc.name = btrim(d.contact_name)
  )
group by d.client_id, btrim(d.contact_name);
