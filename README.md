# 오늘의 해 ☀

매일 아침, 같은 해변에 모여 실시간 해돋이를 함께 보는 3D 웹 서비스.

- 해의 위치·일출 시각: 각 기기에서 천문 계산 (`client/src/sun.ts`)
- 다른 사람들: Socket.io 실시간 서버 (`server/src/index.ts`)
- 직접 쓴 소원은 서버로 보내지 않음 → 본인 화면에만 보임 (욕설 관리 부담 0)

## 구조

```
oneul-hae/
├─ server/                 # 실시간 서버 (Node + Socket.io)
│  └─ src/
│     ├─ index.ts          # 채널 분배, 위치 중계, 방석, 통계
│     └─ protocol.ts       # 서버·클라이언트가 함께 쓰는 이벤트 타입
└─ client/                 # 프론트 (Vite + TypeScript + three.js)
   ├─ index.html
   └─ src/
      ├─ main.ts           # 게임 루프, 입력, 카메라, UI, 서버 연결
      ├─ world.ts          # 하늘·바다·모래·조명·방석·랜드마크
      ├─ character.ts      # 캐릭터 모델과 동작
      ├─ lanterns.ts       # 풍등
      ├─ sun.ts            # 태양 계산, 시간 표시
      ├─ store.ts          # 연속 기록·알람·내 캐릭터 (localStorage)
      ├─ places.ts         # 장소, 소원, 색 팔레트
      ├─ i18n.ts           # 한국어/영어 문구 (브라우저 언어로 자동 선택, 한/EN 버튼으로 전환)
      └─ net.ts            # Socket.io 연결
```

## 로컬에서 실행

```bash
# 터미널 1: 서버
cd server && npm install && npm run dev      # http://localhost:3001

# 터미널 2: 프론트
cd client && npm install && npm run dev      # http://localhost:5173
```

브라우저 창을 두 개 열면 서로의 캐릭터가 보여요. 같은 와이파이에 있는 폰에서는
`vite`가 보여주는 Network 주소로 접속하면 돼요 (`.env`의 `VITE_SERVER_URL`도 PC의 IP로).

## 배포

### 1. GitHub에 올리기
```bash
git init && git add . && git commit -m "오늘의 해 첫 버전"
gh repo create oneul-hae --public --source . --push
```

### 2. 서버 → Railway (Fly.io, Render도 가능)
1. railway.com → New Project → Deploy from GitHub repo → 이 저장소
2. Settings → **Root Directory: `server`**
3. Start Command는 `npm start` (package.json에 있음)
4. Variables:
   - `CORS_ORIGIN` = 프론트 주소 (예: `https://hae.abracadelulu.com`). 여러 개면 쉼표로
   - `CHANNEL_CAP` = `100` (채널 하나의 정원)
5. Settings → Networking → Generate Domain → `https://xxx.up.railway.app`
6. `https://xxx.up.railway.app/health` 가 `ok` 면 성공

> 주의: Vercel 같은 서버리스에는 서버를 올릴 수 없어요. 연결을 계속 유지해야 하기 때문.

### 3. 프론트 → Vercel
1. vercel.com → Add New Project → 같은 저장소
2. **Root Directory: `client`** (Framework: Vite 자동 인식)
3. Environment Variables: `VITE_SERVER_URL` = 2번의 Railway 주소
4. Deploy

### 4. 도메인
Vercel → Settings → Domains → `hae.abracadelulu.com` 추가 →
도메인 관리 페이지에서 안내된 CNAME 레코드 추가.
그다음 Railway의 `CORS_ORIGIN`을 이 주소로 바꾸기.

## 런칭 전 체크리스트
- [ ] 실제 폰(아이폰·안드로이드)에서 프레임 확인 — 느리면 `renderer.setPixelRatio` 값을 1.25로
- [ ] 친구 2~3명과 아침에 같이 접속해 보기
- [ ] `/health`를 UptimeRobot 등에 등록해서 서버가 죽으면 알림 받기
- [x] 부하 테스트 (개발 PC 1대): 봇 2,000명 동시 접속 → 채널 20개로 자동 분배, 서버 CPU 코어 1개의 약 48%, 메모리 190MB, 위치 틱 평균 103ms(p95 124ms)
- 서버 한 대가 대략 3~4천 명까지 감당 → 그 이상은 Railway replica + Socket.io Redis 어댑터로 확장

## 알람에 대해 (현재 한계)
지금 알람은 **페이지가 열려 있고 화면이 켜져 있을 때만** 울려요.
잠든 폰을 깨우려면 웹 푸시(PWA) → 네이티브 앱(iOS 26 AlarmKit, 안드로이드 알람 권한) 순서로 발전시켜야 해요.

## 다음에 할 일
- 웹 푸시 알림 (PWA, 홈 화면에 추가)
- 1월 1일 특별 이벤트 (첫 해 카운트다운, 특별 풍등)
- 친구끼리만 모이는 비공개 방 (초대 코드)
