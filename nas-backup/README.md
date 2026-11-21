# 유그린 나스 자동 백업 (비상로지스)

매일 새벽 3시에 비상로지스 DB 전체(매출·지출·배차·거래처·차량·메모 등 모든 표와 함수)를
나스의 `backups` 폴더에 파일 하나(`bisang_2026-11-21_0300.dump`)로 저장합니다. 30일 지난 파일은 저절로 지워요.
지금 매주 월요일 구글 시트 백업은 그대로 둡니다(둘 다 있으면 더 안전).

## 1. Supabase 연결 주소 복사하기
1. https://supabase.com/dashboard/project/jjoiokzmyxgmozutlspk 에 들어가요.
2. 위쪽 **Connect** 버튼 → **Session pooler** 칸의 주소를 복사해요.
   `postgresql://postgres.jjoiokzmyxgmozutlspk:[YOUR-PASSWORD]@aws-...pooler.supabase.com:5432/postgres` 모양이에요.
   (Direct connection은 나스에서 연결이 안 될 수 있어서 **Session pooler**를 써요.)
3. `[YOUR-PASSWORD]` 자리에 DB 비밀번호를 넣어요(대괄호도 지우기).
   비밀번호를 모르면: Project Settings → Database → **Reset database password**로 새로 만들어요.
   (비밀번호를 바꿔도 앱에는 영향 없어요. 앱은 다른 열쇠를 씁니다.)

## 2. 나스에 컨테이너 만들기 (UGOS Pro)
1. 나스 앱에서 **Docker** → **프로젝트** → **만들기**.
2. 프로젝트 이름: `bisang-backup`, 저장 위치: 원하는 공유 폴더(예: `/docker/bisang-backup`).
3. 이 폴더의 `docker-compose.yml` 내용을 통째로 붙여 넣어요.
4. `DATABASE_URL: "여기에_Supabase_연결_주소를_붙여_넣기"` 의 따옴표 안을 1단계 주소로 바꿔요.
5. **배포(시작)** 를 눌러요.

## 3. 잘 되는지 확인
- 컨테이너를 켜자마자 한 번 백업해요. Docker → 컨테이너 → `bisang-backup` → **로그**에
  `백업 완료: /backups/bisang_....dump (1.2M)` 처럼 나오면 성공이에요.
- 저장 위치 폴더 안 `backups` 폴더에 `.dump` 파일이 생겨요.
- `백업 실패`가 나오면 주소·비밀번호를 다시 확인하세요.

## 주의
- 이 파일에는 회사 자료 전체가 들어 있어요. `backups` 폴더는 나스에서 나만 볼 수 있는 곳에 두세요.
- `DATABASE_URL`에 비밀번호가 들어가니, 비밀번호를 넣은 docker-compose 내용은 다른 사람에게 보내지 마세요.

## 되살리기 (필요할 때만)
새 Supabase 프로젝트(또는 같은 곳)에 되살릴 때, 컴퓨터에서:

    pg_restore --no-owner --no-privileges -d "되살릴_곳_연결_주소" bisang_2026-11-21_0300.dump

어려우면 Claude에게 "나스 백업으로 되살려 줘"라고 하면 같이 할 수 있어요.
