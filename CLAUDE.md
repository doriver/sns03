# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

백엔드는 Express 4 + MongoDB(Mongoose) + Redis(ioredis), 프런트엔드는 바닐라 JS SPA 이며 동일한 Express 프로세스가 정적 파일로 서빙한다. 서버는 CommonJS, 브라우저는 ES 모듈을 사용한다.

실행 요구사항: Node 18+, localhost:27017 의 MongoDB, localhost:6379 의 Redis (Windows 에서는 WSL). 설정은 `server/.env` 에 둔다(루트의 `.env.example` 복사)

## Commands

모든 명령은 `server/` 디렉터리에서 실행한다.

```bash
npm install
npm run seed                 # admin + user1..userN 시드 계정 생성
npm run dev                  # nodemon src/server.js, 포트 3000
npm start                    # node src/server.js
npm test                     # jest, 직렬 실행 (--runInBand --forceExit)
npm run test:unit
npm run test:integration
# 단일 테스트 파일 / 이름으로 실행
npx jest tests/integration/auth.test.js
npx jest -t "login with valid credentials"
```

통합 테스트는 `mongodb-memory-server` 를 사용하므로 로컬 Mongo 는 필요 없지만, 테스트에서 별도로 스텁하지 않는 한 Redis 는 여전히 필요하다.

시드 계정: `admin@sns03.dev / Admin1234`, `user1@sns03.dev / User11234`, … SPA 는 <http://localhost:3000> 에서 접속한다.

## Architecture

### 서버: 도메인별 모듈 구조

`server/src/modules/<domain>/` 에 도메인 하나의 route + controller + service + validator 가 함께 들어있다. 도메인은 `auth`, `users`, `posts`, `comments`, `likes`, `follows`, `admin`, `chat`. 모든 라우터는 `src/app.js` 에서 `/api` 에 마운트되며, URL prefix 는 app 이 아니라 각 route 파일에 정의되어 있다. 도메인을 추가할 때는 네 개 파일을 만들고 `app.js` 에 라우터를 등록한다.

`timeline` 모듈은 controller + service 만 존재하며 별도 라우터로 마운트되어 있지 않다 — 다른 도메인(예: `posts`)에서 호출해 사용한다. 신규 타임라인 엔드포인트가 필요하면 라우터를 추가하고 `app.js` 에 등록해야 한다.

Mongoose 스키마는 모듈 내부가 아니라 `src/models/` 에 모아 두어 여러 서비스가 공유할 수 있게 한다: `User`, `Post`, `Comment`, `Like`, `Follow`, `AdminLog`, `ChatRoom`, `ChatParticipation`, `ChatMessage`.

### 실시간 레이어 (chat)

`modules/chat/chat.realtime.js` 가 두 가지 푸시 채널을 관리한다:

- **Socket.IO** (`socket.io` + `@socket.io/redis-adapter`): 채팅방별 메시지 브로드캐스트. `server.js` 에서 `attachWebSocket(httpServer)` 로 HTTP 서버에 직접 붙고, Redis pub/sub 어댑터로 다중 WAS 간 fan-out 한다 — Express app 에는 붙지 않으므로 `app.js` 가 아니라 `server.js` 를 거쳐야 활성화된다. 따라서 supertest 기반 통합 테스트로는 소켓 경로를 검증할 수 없다.
- **SSE**: 채팅방 목록 변경(입/퇴장 등)을 푸시한다. WAS 간에는 Redis pub/sub 으로 이벤트를 fan-out 한다. `Authorization` 헤더를 못 쓰는 EventSource 한계 때문에 SSE 경로의 인증은 일반 미들웨어와 다르게 처리되니, 인증 변경 시 같이 확인할 것.

소켓별 rate limit 은 `chat.realtime.js` 내부 인메모리 버킷으로 관리한다(REST 의 `globalLimiter` 와 별개). 인메모리이므로 WAS 별로 카운트가 분리된다는 점에 유의.

### 다중 WAS / nginx

루트의 `docker-compose.yml` 은 `was1` + `was2` 두 인스턴스를 띄우고 `nginx` (포트 80) 가 앞단에서 로드밸런싱한다. nginx 설정은 `nginx/nginx.conf`. 업로드 디렉터리 (`server/uploads/`) 는 호스트 바인드마운트로 두 WAS 와 nginx (정적 `/uploads`) 가 공유한다. MongoDB/Redis 는 컨테이너에 포함되어 있지 않고 호스트의 `host.docker.internal:27017` / `:6379` 에 붙는다. 다중 인스턴스 환경에서는 실시간/세션류 상태가 Redis 를 거쳐야 하므로 chat 외 다른 도메인에 실시간 기능을 추가할 때도 같은 패턴(소켓 어댑터 또는 pub/sub)을 따른다.

### 미들웨어 스택 (순서 중요, `app.js` 에 정의)

`helmet → cors → morgan → json/urlencoded → cookieParser → noSqlGuard → xssSanitize → globalLimiter → 업로드 정적 → 클라이언트 정적 → /api 라우트 → SPA fallback → notFound → errorHandler`.

SPA fallback(`app.get('*', …)`)은 `/api` 로 시작하지 않는 모든 경로에 대해 `client/index.html` 을 반환하므로, 그 뒤에는 404/에러 핸들러 외의 라우트를 추가하면 안 된다. `express-async-errors` 를 `app.js` 최상단에서 require 하기 때문에 async 라우트 핸들러가 throw 하면 `errorHandler` 까지 버블업된다.

### 인증

Access/refresh 토큰 분리 구조. Access token 은 수명이 짧은 JWT (`ACCESS_TOKEN_TTL`, 기본 15m) 로 `Authorization: Bearer` 로 전달한다. Refresh token 은 장기 토큰 (`REFRESH_TOKEN_TTL`, 기본 14d) 이며 httpOnly 쿠키로 저장되고 `/api/auth/refresh` 에서 회전된다. 토큰 발급/회전/폐기는 `modules/auth/token.service.js` 에 있으며, refresh 허용/차단 목록을 Redis 로 관리한다. 클라이언트는 access token 을 `sessionStorage` 의 `at` 키에 저장하고, 401 응답을 받으면 silent refresh 를 시도한다 (`client/js/main.js` 의 `restoreSession` 참고).

### 클라이언트: 바닐라 SPA

`client/js/main.js` 가 엔트리 포인트. `router.js` 는 `route(path, handler, { auth, admin })` 형태의 가드를 지원하는 작은 path 라우터이며, `store.js` 가 인메모리 상태와 access token 을 보관한다. `components/` 는 재사용 컴포넌트(예: navbar), `pages/` 는 라우트별 렌더러, `api/` 는 fetch 래퍼다. 빌드 단계가 없으며 `index.html` 에서 `js/main.js` 를 ES 모듈로 직접 로드한다.

### 업로드

`multer` 가 `server/uploads/` 에 저장한다(`UPLOAD_DIR` 로 변경 가능). 저장된 파일은 `uploadConfig.publicUrl` 경로로 정적 서빙된다. MIME 검사는 multipart 헤더가 아닌 파일 실제 내용 기반으로 `file-type` 을 사용하므로, `middlewares/upload.js` 를 수정할 때 이 체크를 유지해야 한다.

### 응답 형태

핸들러는 성공 시 `{ ok: true, data: … }` 를 반환하고, 실패는 `errorHandler` 가 `{ ok: false, error: { code, message } }` 로 포맷한다. 클라이언트가 이 envelope 에 의존한다(예: `json.data.user`, `json.data.accessToken`).

## Conventions

- 서버는 CommonJS (`require` / `module.exports`), 브라우저 코드는 ESM.
- 검증은 각 모듈의 `*.validator.js` 에서 `express-validator` 로 작성하고 `middlewares/validate.js` 를 통해 적용한다.
- 레이트 리미팅: `globalLimiter` 는 앱 전역이고, 라우트별 리미터는 `middlewares/rateLimit.js` 에 있다. 즉석에서 새로 만들지 말고 기존 것을 재사용한다.
- 로깅은 `config/logger.js` 의 `winston` + daily rotate 를 사용하며, morgan 의 HTTP 로그도 `logger.stream` 으로 흘려보낸다. 서버 코드에서 `console.log` 를 쓰지 않는다.
- 제품 스펙과 요구사항은 `docs/` (`requirements.md`, `specification.md`) 에 있다. API 계약을 변경하기 전에 먼저 확인한다.
