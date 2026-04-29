# SNS03

Express + MongoDB + Redis + 바닐라 JS 기반 소규모 SNS

## 사전 요구사항
- Node.js 18+
- MongoDB (로컬 27017)
- Redis (WSL 6379)

## 빠른 시작

```bash
# 1. 환경변수 설정
cp .env.example server/.env
# server/.env 에서 JWT 시크릿 변경 필수

# 2. 의존성 설치
cd server && npm install

# 3. 시드 데이터 삽입
npm run seed

# 4. 서버 기동
npm run dev
```

브라우저에서 http://localhost:3000 접속

## 환경변수 설명

| 키 | 설명 |
| --- | --- |
| `MONGO_URI` | MongoDB 연결 문자열 |
| `REDIS_URL` | Redis 연결 URL |
| `JWT_ACCESS_SECRET` | Access Token 서명 시크릿 (32자 이상 권장) |
| `JWT_REFRESH_SECRET` | Refresh Token 서명 시크릿 (32자 이상 권장) |
| `ACCESS_TOKEN_TTL` | Access Token 유효기간 (기본: 15m) |
| `REFRESH_TOKEN_TTL` | Refresh Token 유효기간 (기본: 14d) |
| `UPLOAD_DIR` | 파일 업로드 경로 (기본: ./uploads) |
| `CORS_ORIGIN` | 허용 CORS Origin |
| `BCRYPT_COST` | bcrypt 해시 비용 (기본: 10) |

## 시드 계정

```
관리자: admin@sns03.dev / Admin1234
유저1:  user1@sns03.dev / User11234
유저2:  user2@sns03.dev / User21234
...
```

## API

전체 prefix: `/api`

- `POST /api/auth/signup` — 회원가입
- `POST /api/auth/login` — 로그인
- `POST /api/auth/refresh` — 토큰 회전
- `POST /api/auth/logout` — 로그아웃
- `GET /api/posts/timeline` — 타임라인
- `GET /api/posts` — 게시글 목록 (cursor 페이지네이션)
- `GET /api/posts/:id` — 게시글 상세
- `POST /api/posts` — 게시글 작성 (multipart)
- `PATCH /api/posts/:id` — 게시글 수정
- `DELETE /api/posts/:id` — 게시글 삭제
- `POST /api/posts/:id/like` — 좋아요 토글
- `GET /api/posts/:postId/comments` — 댓글 목록
- `POST /api/posts/:postId/comments` — 댓글 작성
- `GET /api/users/me` — 내 프로필
- `GET /api/users/:id` — 공개 프로필
- `POST /api/users/:id/follow` — 팔로우
- `GET /api/admin/stats` — 대시보드 통계 (admin)

## 디렉토리 구조

```
sns03/
├─ server/             Express 서버
│  ├─ src/
│  │  ├─ config/       env, db, redis, logger
│  │  ├─ middlewares/  auth, errorHandler, upload, ...
│  │  ├─ modules/      auth, users, posts, comments, likes, follows, timeline, admin
│  │  ├─ models/       mongoose 스키마
│  │  └─ utils/
│  ├─ uploads/         이미지 업로드 저장소
│  ├─ scripts/         seed.js
│  └─ tests/           unit / integration
└─ client/             바닐라 JS SPA
   ├─ css/
   ├─ js/
   │  ├─ api/          서버 API 래퍼
   │  ├─ components/   재사용 컴포넌트
   │  └─ pages/        페이지 컴포넌트
   └─ index.html
```

## 테스트

```bash
cd server
npm test          # 전체
npm run test:unit # 단위만
npm run test:integration # 통합만
```
