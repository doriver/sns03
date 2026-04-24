# 프로젝트 상세 명세

> 본 문서는 `requirements.md` 를 기반으로 구현 계획 수립에 필요한 세부사항을 보강한 명세서입니다.

---

## 1. 개요

### 1.1 목적
확장 방향(채팅, 다중 WAS)을 고려한 소규모 SNS 서비스 구현.

### 1.2 기술 스택
| 영역 | 기술 |
| --- | --- |
| 프론트엔드 | 바닐라 JS (ES Module), HTML5, CSS3 |
| 백엔드 | Node.js (LTS), Express.js |
| DB | MongoDB (로컬) |
| 캐시/세션 | Redis (WSL) |
| 인증 | JWT (access + refresh) |
| 파일 업로드 | Multer (로컬 디스크) |
| 로깅 | morgan(요청) + winston(앱/에러) |
| 검증 | express-validator 또는 zod |
| 보안 | helmet, express-rate-limit, cors, xss-clean |

### 1.3 용어
- **Access Token(AT)**: API 요청 인증용 단기 토큰
- **Refresh Token(RT)**: AT 재발급용 장기 토큰, Redis 저장 및 회전
- **popular**: 관리자가 수동 승격한 인기 유저 (뱃지 표시)

---

## 2. 사용자 유형 및 권한

| role | 값 | 권한 |
| --- | --- | --- |
| guest | (비로그인) | 글/댓글 읽기, 타임라인 보기 |
| user | `user` | guest + 작성/수정/삭제(본인), 좋아요, 팔로우 |
| popular | `popular` | user + 뱃지 노출 (내부 권한은 user와 동일) |
| admin | `admin` | 전체 리소스 관리 |

### 2.1 popular 승격 조건
- 팔로워 수 ≥ 10
- 관리자 승인
- 팔로워가 10 미만으로 떨어지더라도 자동 강등은 하지 않음(관리자 수동 판단)

---

## 3. 회원

### 3.1 가입
- 필드: `email`, `password`, `nickname`
- 제약:
  - email: RFC5322 간이 검증, 소문자화 저장, unique
  - password: 8자 이상 64자 이하, 영문+숫자 조합, bcrypt 해시(cost=10) 저장
  - nickname: 2~20자, 공백 불가, unique
- 중복 검사: email, nickname 각각 unique 인덱스

### 3.2 로그인 / 토큰
- `POST /api/auth/login` → AT + RT 발급
- AT 유효기간: **15분**, RT 유효기간: **14일**
- RT 저장: Redis `refresh:{userId}:{jti}` → `{ token, ua, ip, expAt }`, TTL 14일
- 토큰 회전: `/api/auth/refresh` 호출 시 기존 RT 삭제 후 새 AT/RT 발급
- 로그아웃: RT 무효화(해당 키 삭제), 전체 기기 로그아웃은 `refresh:{userId}:*` 전체 삭제
- AT 전달: `Authorization: Bearer <AT>`
- RT 전달: HttpOnly + Secure + SameSite=Strict 쿠키 권장

### 3.3 프로필
- 편집 가능: nickname, profileImage
- 조회: 본인 상세 / 타인 공개 프로필 (email 은 비공개)

### 3.4 팔로우
- `POST /api/users/:userId/follow` / `DELETE /api/users/:userId/follow`
- 자기 자신 팔로우 금지
- follower/following count 는 비정규화 필드로 User 도큐먼트에 저장

### 3.5 탈퇴
- 본인 탈퇴: soft delete (`deletedAt` 설정), 닉네임은 `deleted_{id}` 로 치환하여 unique 유지
- 관리자 강제 탈퇴: soft delete + `bannedAt`, `banReason` 기록
- 탈퇴 유저의 글/댓글: 기본 유지, 작성자명 "탈퇴한 사용자" 로 표시

---

## 4. 게시판

### 4.1 게시글
- 필드: `title`(1~100자), `content`(1~5000자), `images`(최대 3), `authorId`, `viewCount`, `likeCount`, `commentCount`, `createdAt`, `updatedAt`, `deletedAt`
- 상태: 정상 / 숨김(admin) / 삭제(soft)
- 정렬: 기본 최신순, 타임라인은 `viewCount` 가중치 + 최근 N일 내

### 4.2 댓글
- 필드: `postId`, `authorId`, `content`(1~500자), `createdAt`, `updatedAt`, `deletedAt`
- 대댓글은 **비지원** (향후 확장)

### 4.3 좋아요
- 1 user × 1 post = 1 like (복합 unique 인덱스)
- `POST /api/posts/:id/like` 토글 방식
- 좋아요 시 `Post.likeCount` 증감 (원자적 `$inc`)

### 4.4 이미지 업로드
- 경로: `./uploads/posts/{yyyy}/{mm}/{uuid}.{ext}`
- 프로필 이미지: `./uploads/profiles/{userId}.{ext}`
- 정적 서빙: `GET /uploads/*`
- 제약: jpg/png/webp, 5MB/장, 최대 3장
- 실제 MIME 검증(magic number) + 확장자 검증 동시 수행
- 업로드 경로는 `.env` 로 분리 → 추후 S3/CDN 교체 가능하도록 `StorageAdapter` 인터페이스 추상화

### 4.5 조회수
- 같은 사용자/IP의 중복 조회 방지: Redis `view:{postId}:{userId|ip}` TTL 10분
- 비동기 `$inc` (게시글 응답은 기존 count 그대로)

### 4.6 페이지네이션
- 글 목록: cursor 기반 (`?cursor=<ObjectId>&limit=20`), 최신순
- 댓글 목록: offset 기반 (`?page=1&size=20`)
- 응답 포맷:
  ```json
  { "items": [...], "nextCursor": "..." , "hasMore": true }
  ```

### 4.7 타임라인
- 메인 상위 10개: `(viewCount * 0.7 + likeCount * 0.3)` 점수 + 최근 7일 이내
- Redis 캐시: `timeline:main` TTL 60초
- 캐시 미스 시 DB aggregate 후 세팅

---

## 5. 관리자 페이지

### 5.1 회원 관리
- 목록: 가입일/닉네임/이메일/권한 기준 검색·정렬·페이지네이션
- 작업: role 변경, popular 승격/해제, 정지, 강제 탈퇴
- 감사 로그: `adminLogs` 컬렉션에 `{adminId, targetUserId, action, reason, at}` 기록

### 5.2 콘텐츠 관리
- 게시글/댓글 숨김(`hidden: true`) 또는 삭제
- 숨김 상태는 일반 유저 목록/상세에 노출되지 않음(작성자/관리자에게만 보임)

### 5.3 대시보드 통계
- 전체 가입자 수, 전체 게시글/댓글 수
- DAU: `distinct userId` from access log (Redis set `dau:{yyyy-mm-dd}` TTL 2일)
- 최근 7일 가입/게시글/좋아요 추이 (라인 차트)

---

## 6. API 스펙 (요약)

> 전체 prefix: `/api`

### 6.1 Auth
| Method | Path | 설명 |
| --- | --- | --- |
| POST | `/auth/signup` | 회원가입 |
| POST | `/auth/login` | 로그인 (AT+RT 발급) |
| POST | `/auth/refresh` | 토큰 회전 |
| POST | `/auth/logout` | 현재 RT 폐기 |
| POST | `/auth/logout-all` | 모든 RT 폐기 |

### 6.2 Users
| Method | Path | 설명 |
| --- | --- | --- |
| GET | `/users/me` | 내 프로필 |
| PATCH | `/users/me` | 프로필 편집 |
| DELETE | `/users/me` | 본인 탈퇴 |
| GET | `/users/:id` | 공개 프로필 |
| POST | `/users/:id/follow` | 팔로우 |
| DELETE | `/users/:id/follow` | 언팔로우 |
| GET | `/users/:id/followers` | 팔로워 목록 |
| GET | `/users/:id/following` | 팔로잉 목록 |

### 6.3 Posts
| Method | Path | 설명 |
| --- | --- | --- |
| GET | `/posts` | 목록 (cursor) |
| GET | `/posts/timeline` | 타임라인 상위 10 |
| GET | `/posts/:id` | 상세 (조회수 증가 트리거) |
| POST | `/posts` | 생성(multipart) |
| PATCH | `/posts/:id` | 수정 |
| DELETE | `/posts/:id` | 삭제 |
| POST | `/posts/:id/like` | 좋아요 토글 |

### 6.4 Comments
| Method | Path | 설명 |
| --- | --- | --- |
| GET | `/posts/:postId/comments` | 목록 |
| POST | `/posts/:postId/comments` | 생성 |
| PATCH | `/comments/:id` | 수정 |
| DELETE | `/comments/:id` | 삭제 |

### 6.5 Admin (`/admin/*`, admin 권한 필수)
| Method | Path | 설명 |
| --- | --- | --- |
| GET | `/admin/users` | 회원 목록/검색 |
| PATCH | `/admin/users/:id/role` | role 변경 |
| POST | `/admin/users/:id/ban` | 정지/강제탈퇴 |
| PATCH | `/admin/posts/:id/hidden` | 숨김 처리 |
| DELETE | `/admin/posts/:id` | 삭제 |
| DELETE | `/admin/comments/:id` | 댓글 삭제 |
| GET | `/admin/stats` | 대시보드 통계 |

---

## 7. 데이터 모델 (MongoDB)

### 7.1 users
```js
{
  _id, email, passwordHash, nickname,
  role: 'user'|'popular'|'admin',
  profileImage: String|null,
  followerCount: 0, followingCount: 0,
  bannedAt: Date|null, banReason: String|null,
  deletedAt: Date|null,
  createdAt, updatedAt
}
// index: email unique, nickname unique, role
```

### 7.2 posts
```js
{
  _id, authorId, title, content,
  images: [String],
  viewCount: 0, likeCount: 0, commentCount: 0,
  hidden: false, deletedAt: null,
  createdAt, updatedAt
}
// index: { createdAt: -1 }, { authorId: 1, createdAt: -1 },
//        { deletedAt: 1, hidden: 1, createdAt: -1 }
```

### 7.3 comments
```js
{ _id, postId, authorId, content, deletedAt, createdAt, updatedAt }
// index: { postId: 1, createdAt: 1 }, { authorId: 1 }
```

### 7.4 likes
```js
{ _id, postId, userId, createdAt }
// index: { postId: 1, userId: 1 } unique
```

### 7.5 follows
```js
{ _id, followerId, followingId, createdAt }
// index: { followerId: 1, followingId: 1 } unique,
//        { followingId: 1 }
```

### 7.6 adminLogs
```js
{ _id, adminId, action, targetType, targetId, reason, at }
```

---

## 8. Redis 키 설계

| 용도 | 키 | TTL |
| --- | --- | --- |
| RT 저장 | `refresh:{userId}:{jti}` | 14d |
| 조회수 중복 방지 | `view:{postId}:{userId\|ip}` | 10m |
| 타임라인 캐시 | `timeline:main` | 60s |
| DAU 집계 | `dau:{yyyy-mm-dd}` (Set) | 2d |
| Rate limit | `rl:{ip}:{route}` | 1m |
| 좋아요 버퍼(옵션) | `like:buffer:{postId}` | - |

---

## 9. 디렉토리 구조 (제안)

```
sns03/
├─ docs/
│  ├─ requirements.md
│  └─ specification.md
├─ server/
│  ├─ src/
│  │  ├─ config/           # env, db, redis, logger
│  │  ├─ middlewares/      # auth, error, validate, upload, rateLimit
│  │  ├─ modules/
│  │  │  ├─ auth/
│  │  │  ├─ users/
│  │  │  ├─ posts/
│  │  │  ├─ comments/
│  │  │  ├─ likes/
│  │  │  ├─ follows/
│  │  │  └─ admin/
│  │  ├─ models/           # mongoose 스키마
│  │  ├─ utils/
│  │  └─ app.js
│  ├─ uploads/
│  └─ package.json
├─ client/
│  ├─ index.html
│  ├─ css/
│  ├─ js/
│  │  ├─ api/
│  │  ├─ pages/
│  │  ├─ components/
│  │  └─ router.js
│  └─ assets/
└─ .env.example
```

각 모듈 내부: `*.route.js`, `*.controller.js`, `*.service.js`, `*.validator.js`.

---

## 10. 프론트엔드 구성

### 10.1 페이지
- `/` 메인 타임라인 (비로그인 접근 가능)
- `/login`, `/signup`
- `/posts` 목록, `/posts/:id` 상세, `/posts/new`, `/posts/:id/edit`
- `/users/:id` 프로필
- `/me` 내 정보 / 편집
- `/admin/*` 관리자

### 10.2 라우팅
- History API 기반 클라이언트 라우터(`router.js`)
- 보호 라우트: AT 없거나 만료 시 `/login` 리다이렉트
- AT 만료 시 자동 refresh → 실패하면 로그아웃 처리

### 10.3 UX 가이드
- 단일 컬럼 레이아웃, max-width 720px
- 컬러 팔레트 2~3색, 시스템 폰트
- 로딩/에러 토스트 공통 컴포넌트
- 이미지 미리보기 + 드래그 앤 드롭 업로드

---

## 11. 에러 처리

### 11.1 공통 응답 포맷
성공:
```json
{ "ok": true, "data": {...} }
```
실패:
```json
{ "ok": false, "error": { "code": "POST_NOT_FOUND", "message": "...", "details": [...] } }
```

### 11.2 HTTP 상태 매핑
- 400 검증 실패, 401 인증 실패, 403 권한 없음, 404 리소스 없음, 409 중복, 413 용량 초과, 415 확장자 불가, 429 Rate limit, 500 서버 오류

### 11.3 에러 코드 네임스페이스
`AUTH_*`, `USER_*`, `POST_*`, `COMMENT_*`, `FILE_*`, `RATE_*`, `INTERNAL_*`

---

## 12. 비기능 요구사항

### 12.1 보안
- helmet 기본 적용, CSP 최소 수준 구성
- CORS: 허용 origin 을 `.env` 로 제어
- bcrypt cost 10, JWT HS256 (secret env)
- 요청 본문 sanitize (xss-clean 또는 수동 escape)
- NoSQL injection 방지: 쿼리 파라미터 타입 검증
- Rate limit:
  - `/api/auth/login` 10req/min/ip
  - 전체 100req/min/ip
- 업로드 파일: 랜덤 UUID 파일명, 확장자+MIME 이중 검증

### 12.2 로깅
- 요청 로그: morgan `combined` 포맷 → 파일 + stdout
- 앱 로그: winston, 레벨 `info`/`warn`/`error`
- 에러 로그: 스택 포함, 민감 정보 마스킹(password, token)
- 로그 로테이션: winston-daily-rotate-file

### 12.3 환경변수 (`.env.example`)
```
PORT=3000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/sns03
REDIS_URL=redis://127.0.0.1:6379
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL=14d
UPLOAD_DIR=./uploads
PUBLIC_UPLOAD_URL=/uploads
CORS_ORIGIN=http://localhost:5173
BCRYPT_COST=10
```

### 12.4 확장성 고려
- Storage 어댑터 (`LocalStorage` → `S3Storage` 교체 가능)
- 세션리스 인증(JWT+Redis) → 다중 WAS 환경에서도 동작
- 타임라인/좋아요 집계는 Redis 레이어 → 이후 큐(Bull, Kafka)로 치환 가능
- 모듈 단위 폴더 구조로 마이크로서비스 분리 용이

---

## 13. 유효성 검증 규칙 (요약)

| 필드 | 규칙 |
| --- | --- |
| email | RFC5322 간이, 소문자 변환 |
| password | 8~64, 영문+숫자 |
| nickname | 2~20, 공백 불가, 금칙어 필터(선택) |
| post.title | 1~100 |
| post.content | 1~5000, HTML escape |
| comment.content | 1~500 |
| image | mime: image/jpeg, image/png, image/webp, size ≤ 5MB, count ≤ 3 |

---

## 14. 테스트 전략

- 단위 테스트: service 레이어 (Jest)
- 통합 테스트: supertest + mongodb-memory-server + ioredis-mock
- 핵심 시나리오:
  1. 회원가입 → 로그인 → 토큰 refresh → 로그아웃
  2. 게시글 CRUD 권한 분기
  3. 좋아요 토글 동시성
  4. 이미지 업로드 실패 케이스(용량/확장자/MIME mismatch)
  5. 관리자 숨김/삭제 흐름

---

## 15. 구현 단계(마일스톤 제안)

1. **M1 기반**: 프로젝트 스캐폴딩, env/db/redis/logger, 공통 에러·응답 포맷
2. **M2 인증**: 회원가입, 로그인, RT 회전, 미들웨어
3. **M3 게시판**: 게시글/댓글 CRUD, 업로드, 페이지네이션
4. **M4 상호작용**: 좋아요, 팔로우, 타임라인, 조회수
5. **M5 관리자**: 회원/콘텐츠 관리, 대시보드 통계
6. **M6 프론트**: 라우터, 페이지, 토큰 자동 갱신, UI 마감
7. **M7 마감**: 보안 강화(helmet/rate limit), 로그, 테스트, README

---

## 16. 향후 확장 (참고)
- 단체 채팅: Socket.IO + Redis Pub/Sub
- 이미지 스토리지: S3 + CloudFront, pre-signed URL
- 인프라: Nginx 리버스 프록시, Docker Compose → 다중 WAS → PM2/k8s
- 모니터링: pino + Loki/Grafana, 헬스체크 엔드포인트
