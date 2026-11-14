-- 차량 정보: "차종/톤수" 칸(vehicle_type)에 섞여 있던 파렛수를 따로 둔다.
-- vehicle_type은 이제 차종(냉동탑·냉장윙·윙바디·탑·카고·호루)만 담는다. 사업자명(carrier_name)은 화면에서 뺐지만 값은 남겨 둔다.
alter table public.vehicles
  add column pallet_count smallint
  check (pallet_count between 1 and 99);

-- 기존 "3p" 같은 값은 파렛수로 옮기고 차종 칸은 비운다
update public.vehicles
set pallet_count = substring(vehicle_type from '^(\d+)p$')::smallint,
    vehicle_type = null
where vehicle_type ~ '^\d+p$';
