# SNS03 구현 계획

## Context
`docs/specification.md` 는 요구사항을 기반으로 작성된 상세 명세서이다. 현재 `D:\devNodeJs\sns03` 는 `docs/` 만 존재하는 그린필드 상태이며, 이 계획은 명세를 기술 스택(Express + MongoDB + Redis + 바닐라 JS) 위에서 단계적으로 구현하기 위한 로드맵이다. 각 마일스톤은 독립적으로 검증 가능하도록 구성했으며, 후행 단계는 선행 단계의 공통 기반(에러 포맷, 인증, 업로드)을 재사용한다.

---

## 전반 원칙
- **모듈형 폴더 구조**: `server/src/modules/<domain>` 단위로 `route → controller → service → model` 수직 분리. 도메인 간 직접 import 금지, service 경유.
- **공통 응답 포맷 강제**: `{ ok, data }` / `{ ok, error:{code,message,details} }` 포맷을 래퍼 유틸로 통일, 컨트롤러는 순수 데이터만 반환.
- **에러 전략**: 도메인 에러 클래스(`AppError(code, status, message)`) → 글로벌 에러 미들웨어에서 포맷 변환. try/catch 남발 금지, `express-async-errors` 또는 라우터 레벨 래퍼 사용.
- **보안 기본값 먼저**: helmet/cors/rate-limit/validator 를 M1 에서 세팅해 이후 모듈이 자연스럽게 혜택을 받도록 한다.
- **테스트 가능성**: service 는 외부 I/O(mongoose/redis) 를 얇게 감싼 레이어만 호출하도록 주입 가능한 형태로 작성(DI 수준은 단순 factory). 통합 테스트는 mongodb-memory-server + ioredis-mock.
- **코드 외 문서 최소화**: 새 md 문서는 요구 시에만 추가. 주석은 "왜" 에만.

---

## M1. 프로젝트 기반 (Foundation)

### 목적
이후 모든 모듈이 공통으로 사용할 기반(설정, DB/Redis 커넥션, 로거, 에러/응답 포맷, 보안 미들웨어)을 확정한다.

### 작업 항목
1. **스캐폴딩**
   - `server/` 하위에 `package.json` 초기화, Express + mongoose + ioredis + dotenv + morgan + winston + helmet + cors + express-rate-limit + express-validator 설치.
   - 디렉토리: `src/{config,middlewares,modules,models,utils}`, `uploads/`.
   - `client/` 정적 자산 루트(`index.html`, `css/`, `js/`).
2. **환경 설정 (`src/config`)**
   - `env.js`: dotenv 로드 + 필수 키 존재 검증, 타입 캐스팅(숫자/TTL).
   - `db.js`: mongoose 커넥션, 끊김/재연결 핸들링, shutdown 훅.
   - `redis.js`: ioredis 클라이언트, lazy 연결, 헬스체크 함수.
   - `logger.js`: winston(앱/에러) + daily-rotate, morgan stream 연동.
3. **공통 미들웨어/유틸**
   - `utils/AppError.js`, `utils/catchAsync.js`, `utils/response.js` (`ok`, `fail`).
   - `middlewares/errorHandler.js`: AppError / Mongoose ValidationError / JWT 에러 분기.
   - `middlewares/notFound.js`.
   - `middlewares/validate.js`: express-validator 결과를 AppError 로 변환.
   - `middlewares/rateLimit.js`: 전역 + 로그인 전용 Limiter 팩토리(Redis store).
   - `middlewares/security.js`: helmet, cors(origin env), xss sanitize(본문 재귀 escape) 묶음.
4. **`app.js` / `server.js`**
   - 미들웨어 파이프라인 구성, `/api` prefix 마운트, `/uploads` 정적 서빙, health 엔드포인트(`GET /health`).
5. **환경파일 템플릿**: `.env.example` 작성(specification.md §12.3 그대로).

### 산출물 / 검증
- `pnpm dev` 또는 `npm run dev` 기동 → `/health` 200, Mongo/Redis ping 포함.
- 의도적 throw 라우트로 에러 포맷 확인.
- rate-limit 반복 호출 시 429 응답 확인.

---

## M2. 인증 (Auth)

### 목적
JWT(AT+RT) + Redis 기반 인증 체계를 완성해 이후 모든 보호 라우트가 재사용한다.

### 작업 항목
1. **User 모델 (`models/User.js`)**
   - 필드: spec §7.1. pre-save 훅으로 bcrypt 해시.
   - 인덱스: email/nickname unique, role.
   - 정적/인스턴스 메서드: `comparePassword`, `toPublicJSON`(email 제외).
2. **토큰 유틸 (`modules/auth/token.service.js`)**
   - AT 서명/검증(HS256, 15m).
   - RT 발급: `jti=uuid`, Redis 저장 `refresh:{uid}:{jti}` TTL 14d, payload `{ua, ip, iat}`.
   - 회전: 검증 → 기존 키 삭제 → 신규 쌍 발급(경쟁 조건 방지 위해 `GETDEL` 기반).
   - 로그아웃 올: `SCAN refresh:{uid}:*` 후 일괄 삭제.
3. **컨트롤러/라우트**
   - `POST /auth/signup` (validator: email/password/nickname), 중복 시 409.
   - `POST /auth/login` → AT(body) + RT(HttpOnly 쿠키).
   - `POST /auth/refresh` → 쿠키 RT 검증 + 회전.
   - `POST /auth/logout`, `POST /auth/logout-all`.
4. **인증 미들웨어 (`middlewares/auth.js`)**
   - `requireAuth`: Bearer AT 검증, `req.user` 주입.
   - `optionalAuth`: 토큰 있으면 주입, 없으면 통과(게시글 목록 등).
   - `requireRole(...roles)`: role 포함 여부 검사.
5. **보안 세부**
   - 로그인 Rate limit(10/min/ip).
   - 비밀번호 로그 마스킹 확인(winston formatter).
   - 탈퇴 유저(`deletedAt`/`bannedAt`) 로그인 차단.

### 검증
- 통합 테스트: 가입→로그인→/me→refresh→logout 순방향.
- RT 만료·위조·재사용(회전 후 구 RT) 401 확인.
- role 미스매치 403 확인.

---

## M3. 게시판 (Posts / Comments / Upload)

### 목적
게시글·댓글 CRUD와 이미지 업로드까지 완성하여 기본 게시판이 동작한다.

### 작업 항목
1. **모델**
   - `Post` (spec §7.2), `Comment` (§7.3). soft delete 필드 필터링은 query helper (`findActive`).
2. **업로드 인프라**
   - `middlewares/upload.js`: multer diskStorage, 경로 `uploads/posts/{yyyy}/{mm}/{uuid}.ext`, limits(5MB, 3장).
   - `utils/fileType.js`: magic number 검증(file-type 모듈), 실패 시 파일 삭제 후 AppError.
   - `services/storage.js`: `save`, `remove`, `publicUrl` 제공 → 후일 S3 어댑터 교체.
3. **Posts 모듈**
   - Service: create/update(본인 or admin)/softDelete/listByCursor/getById.
   - 커서 페이지네이션: `createdAt + _id` 복합 커서 (tie-break). 기본 limit 20, max 50.
   - `GET /posts/:id`: 조회수 증가는 별도 service 호출 — Redis `view:{postId}:{uid|ip}` TTL 10m 가드, 비차단 `$inc` (실패 로깅만).
4. **Comments 모듈**
   - offset 기반(`page`,`size`), 댓글 생성/삭제 시 `Post.commentCount` 원자 `$inc`.
5. **유효성 검증 규칙**: spec §13 표 그대로 validator 에 반영.
6. **권한 분기**: 수정/삭제는 작성자 또는 admin. admin 은 숨김(`hidden:true`) 별도 라우트(M5).

### 검증
- 업로드: 확장자 통과 / MIME mismatch 차단 / 5MB 초과 413 / 4장 400.
- 권한: 타 유저 수정 403, admin 수정 200.
- 목록 커서: 페이지 경계에서 중복·누락 없는지 확인.

---

## M4. 상호작용 (Likes / Follows / Timeline)

### 목적
좋아요·팔로우·타임라인을 통해 SNS 핵심 플로우를 완성한다.

### 작업 항목
1. **Likes**
   - `Like` 모델 + `{postId, userId}` unique.
   - Toggle 로직: 트랜잭션 불필요하지만 동시성 고려해 `findOneAndDelete` + `Post.$inc(-1)` / `insertOne` + `$inc(+1)` 조합, duplicate key 예외 무시.
2. **Follows**
   - `Follow` 모델 + unique 복합 인덱스.
   - 자기 팔로우 차단, 토글 시 `followerCount` / `followingCount` 비정규화 필드 `$inc`.
   - popular 승격 자격 체크 유틸(관리자 페이지에서 호출).
3. **Timeline**
   - `GET /posts/timeline`: Redis 캐시 `timeline:main` TTL 60s. 캐시 미스 시 aggregate:
     - match: `deletedAt: null, hidden: false, createdAt ≥ now-7d`
     - addFields: `score = viewCount*0.7 + likeCount*0.3`
     - sort score desc, limit 10
     - lookup author (nickname/profileImage/role) — $lookup 최소 필드 project.
   - 점수 변경 시 무효화 불필요(TTL 60s 로 자연 수렴).
4. **조회수 반영**: M3 에서 Redis 가드 구현했으므로 여기서 타임라인/상세 연계 확인.

### 검증
- 좋아요 토글 연타에도 count 정합성(1000회 동시 요청 시 0/1 수렴) 테스트.
- 팔로우/언팔 count 정합성.
- 타임라인 캐시 hit/miss 로깅 확인.

---

## M5. 관리자 (Admin)

### 목적
운영에 필요한 회원·콘텐츠 관리와 대시보드 지표를 제공한다.

### 작업 항목
1. **`requireRole('admin')` 가드 적용 (`/admin/*`)**
2. **회원 관리**
   - 목록: email/nickname 부분일치, role 필터, 가입일 정렬, 페이지네이션.
   - role 변경: admin 자기 자신 강등 방지.
   - popular 승격 시 팔로워 ≥ 10 검증 후 승격.
   - 정지/강제탈퇴: soft delete + `bannedAt/banReason` + RT 전체 폐기(`logout-all` 재사용).
3. **콘텐츠 관리**
   - 게시글 숨김 토글(`hidden`), 삭제(soft).
   - 댓글 삭제(soft).
4. **감사 로그 (`adminLogs`)**: 모든 admin mutate 라우트에서 after-hook 으로 기록.
5. **대시보드 통계 (`GET /admin/stats`)**
   - 누적: users/posts/comments count.
   - DAU: Redis `dau:{yyyy-mm-dd}` Set — `requireAuth` 미들웨어에서 `SADD` (TTL 2d).
   - 최근 7일 추이: 일자별 aggregate (`$dateToString`), 배열 반환.

### 검증
- 비관리자 접근 403.
- 감사 로그 레코드 기록 확인.
- DAU 집계 값과 access log 샘플 비교.

---

## M6. 프론트엔드 (Vanilla JS SPA)

### 목적
명세의 페이지/UX 를 충족하는 단일 컬럼 SPA 를 완성한다. 라이브러리 없이 모듈형 구성.

### 작업 항목
1. **라우팅 (`client/js/router.js`)**
   - History API, 해시 없는 경로. route map: `/`, `/login`, `/signup`, `/posts`, `/posts/:id`, `/posts/new`, `/posts/:id/edit`, `/users/:id`, `/me`, `/admin/*`.
   - 가드: auth 필요 라우트에서 토큰 없음/만료 시 `/login` 리다이렉트(원래 경로 query 저장).
2. **API 레이어 (`client/js/api/http.js`)**
   - fetch 래퍼, AT 자동 헤더 첨부, 401 시 1회 `/api/auth/refresh` 자동 재시도 후 실패 시 로그아웃.
   - 응답 포맷 언랩(`{ok,data}` → `data`), 에러 표준화.
3. **상태 관리**
   - 초소형 pub/sub (`store.js`): `currentUser`, `toast` 만 관리. 페이지 로컬 state 는 클로저.
4. **페이지 컴포넌트 (`pages/`)**
   - Home(Timeline), PostList(cursor infinite scroll), PostDetail(댓글 포함), PostEditor(이미지 미리보기/DnD), Profile, Me, Login/Signup, Admin(Users/Contents/Stats 탭).
5. **공통 컴포넌트 (`components/`)**: Toast, Modal(확인), Pagination, Loader, Avatar, PostCard, CommentItem.
6. **스타일 (`css/`)**: CSS 변수로 컬러 팔레트 2-3색, 시스템 폰트, max-width 720px 레이아웃. 컴포넌트별 클래스 네이밍 BEM 또는 단순 스코핑.
7. **정적 서빙**: 개발 시 Express 가 `client/` 도 정적 서빙하도록 설정(`express.static`). 프로덕션은 Nginx 로 이관 가능한 구조.

### 검증
- 비로그인: 타임라인/목록/상세 열람 OK, 작성 시 로그인 유도.
- AT 만료 상황 재현 → 자동 refresh 후 원요청 성공.
- 이미지 업로드 5MB 초과/확장자 불가 에러 UI.
- 관리자 라우트 비관리자 접근 시 차단.

---

## M7. 마감 (Hardening)

### 목적
보안 강화, 테스트, 배포 준비.

### 작업 항목
1. **보안 점검**
   - helmet CSP 실사용 도메인 한정.
   - 업로드 파일명 랜덤 UUID 확인, 경로 traversal 테스트.
   - NoSQL injection: 쿼리 입력 타입 가드(`typeof === 'string'`).
   - JWT secret 강도, env 누락 시 부팅 실패.
2. **로그**
   - 요청/에러 로그 로테이션 동작 확인.
   - 민감 필드 마스킹(password, token, authorization 헤더).
3. **테스트**
   - 단위: token.service, storage, score 계산.
   - 통합(supertest): auth 전체 플로우, posts CRUD + 권한, likes 동시성, admin 흐름.
   - 이미지 업로드: 실제 jpg/png/webp 샘플 + 가짜 MIME 파일.
4. **문서**
   - `README.md`: 실행법, env 설명, 시드 스크립트.
   - 시드: 관리자 1, 유저 5, 게시글 20, 댓글 50 랜덤 생성 스크립트(`scripts/seed.js`).
5. **운영 준비**
   - `pm2`/`nodemon` 스크립트 분리.
   - Dockerfile 초안(선택, 확장 로드맵).

### 검증
- 전체 테스트 그린.
- 시드 후 프론트에서 주요 시나리오 수동 QA.
- lighthouse/axe 로 접근성·성능 간이 체크.

---

## 주요 파일 트리 (생성 대상)

```
server/
  package.json
  src/
    app.js, server.js
    config/{env,db,redis,logger}.js
    middlewares/{auth,errorHandler,notFound,validate,rateLimit,security,upload}.js
    utils/{AppError,catchAsync,response,fileType,cursor}.js
    models/{User,Post,Comment,Like,Follow,AdminLog}.js
    modules/
      auth/{auth.route,auth.controller,auth.service,token.service,auth.validator}.js
      users/{users.route,users.controller,users.service,users.validator}.js
      posts/{posts.route,posts.controller,posts.service,posts.validator}.js
      comments/{comments.route,comments.controller,comments.service,comments.validator}.js
      likes/{likes.route,likes.controller,likes.service}.js
      follows/{follows.route,follows.controller,follows.service}.js
      timeline/{timeline.service}.js
      admin/{admin.route,admin.controller,admin.service,admin.validator,auditLog.js}.js
  uploads/
  tests/
    integration/*.test.js
    unit/*.test.js
  scripts/seed.js
client/
  index.html
  css/{base,layout,components}.css
  js/
    main.js, router.js, store.js
    api/{http,auth,posts,comments,users,admin}.js
    pages/{home,login,signup,postList,postDetail,postEditor,profile,me,admin/*}.js
    components/{toast,modal,loader,avatar,postCard,commentItem,pagination}.js
.env.example
```

---

## 의존성 / 참조
- 기준 문서: `docs/specification.md` (API §6, 모델 §7, Redis §8, 디렉토리 §9, 프론트 §10, 에러 §11, 비기능 §12, 검증 §13, 테스트 §14).
- 재사용 가능한 기존 코드: 없음 (그린필드).
- 외부 참조 구현: Express 표준 패턴, mongoose 공식 문서의 soft delete/plugin 패턴.

---

## 엔드투엔드 검증 절차
1. `.env` 작성 → `npm run dev` 기동 → `/health` 200.
2. `npm run seed` 로 초기 데이터 삽입.
3. 프론트 접속 → 비로그인 타임라인 확인.
4. 가입 → 로그인 → 게시글 작성(이미지 3장) → 댓글 → 좋아요.
5. 다른 계정으로 팔로우 → popular 승격 조건 트리거 → 관리자 계정으로 승격.
6. 관리자: 숨김/삭제/정지/통계 대시보드 확인.
7. AT 강제 만료(시크릿 임시 변경 또는 짧은 TTL) → 자동 refresh 플로우 확인.
8. `npm test` 로 단위·통합 테스트 실행.

---

## 오픈 이슈 (구현 시 확정)
- RT 전달 방식: HttpOnly 쿠키 vs 응답 본문 → 본 계획은 쿠키 기본값(spec 권장). CORS credentials 설정 필요.
- 프론트 번들러 사용 여부: 없음(바닐라) 기준. 타입스크립트 도입은 범위 외.
- 테스트 러너: Jest 기준. 변경 시 mongodb-memory-server 호환만 유의.
