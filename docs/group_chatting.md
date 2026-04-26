# 단체 채팅기능

## 1. 채팅방 생성 / 종료
* **생성 권한**: `role === 'popular'` 또는 `'admin'`만 가능. `user`는 입장만 가능.
* **생성 입력값**
  * `name`: 1~30자, 공백 trim, 욕설 필터(선택), 같은 사용자가 만든 활성 방 중 동일 이름 금지
  * `capacity`: 2~50 사이 정수 (방장 본인 포함)
  * `description`: 0~200자 (선택)
* **방장 1인당 동시에 보유 가능한 활성 방 개수**: 1개 (이미 활성 방이 있으면 새로 못 만듦)
* **종료**
  * 방장 또는 admin만 종료 가능
  * 종료 시점에 참석자 전원 강제 퇴장 + SSE/WS로 `room:closed` 이벤트 브로드캐스트
  * 종료 후 Redis 버퍼에 남은 메시지를 MongoDB에 flush, 참석기록도 `leftAt`을 종료시각으로 채움
  * 종료된 방은 목록에서 제외되지만 기록(메시지·참석)은 영구 보존
* **무활동 자동 종료는 도입하지 않음** (방장이 명시적으로 종료하거나 방장 퇴장 시 종료)

## 2. 채팅방 목록
* 활성(`closedAt: null`) 방만 노출
* 표시 항목: 채팅방 이름, 방장(닉네임/프로필이미지), `현재 참석자수 / 제한인원`, 생성시각
* 정렬: 기본 최신순, 옵션으로 참석자수 내림차순
* 페이지네이션: 한 페이지당 20개
* **실시간 갱신(SSE)**
  * 엔드포인트 예: `GET /api/chat/rooms/stream`
  * 이벤트 종류: `room:created`, `room:closed`, `room:participant-changed` (`{roomId, count}`)
  * 클라이언트는 초기 목록을 REST로 받고, 이후 SSE 이벤트로 머지

## 3. 채팅방 (입장 후)
* **입장 권한**: 로그인 사용자(`user`/`popular`/`admin`). banned 사용자 차단.
* **입장 처리**
  * 현재 인원 < capacity 일 때만 가능 (Mongo 트랜잭션 또는 Redis `INCR` 기반 원자적 증가로 race 방지)
  * 동일 사용자가 같은 방에 중복 입장 불가 (이미 참여 중이면 재입장 처리)
  * 참석기록 `joinedAt` 새로 한 줄 추가 (입·퇴장 반복 시 줄 단위로 누적)
* **퇴장**
  * 명시적 나가기, 브라우저 close/SSE 끊김 감지, 방 종료의 3가지 케이스 모두 `leftAt` 기록
  * **방장이 퇴장하면 즉시 방 종료** (남은 참석자 전원 강퇴 + Redis 버퍼 flush + `room:closed` 브로드캐스트)
* **참석자 목록**: 현재 참여 중인 사용자(닉네임/프로필이미지/role) 실시간 표시 — 위 SSE의 `room:participant-changed`와 별도로 방 내부 채널에서 `presence:update` 이벤트
* **메시지 전송**
  * 텍스트만(이미지 업로드는 추후 확장)
  * 길이 1~500자, 빈 메시지 거부
  * Rate limit: 사용자당 초당 3건 (기존 `middlewares/rateLimit.js`에 룰 추가)

## 4. 메시지 저장 — Redis 쓰기지연 Buffering
* **버퍼 구조**: Redis List `chat:buf:{roomId}` 에 `RPUSH`
  * 값: `JSON.stringify({ authorId, nickname, content, createdAt })`
  * TTL은 걸지 않음 (방 종료 시 일괄 flush로 비움)
* **읽기**: 방에 막 입장한 사용자에게 최근 N개 메시지 노출
  * 진행 중인 방: `LRANGE chat:buf:{roomId} -50 -1`
  * 종료된 방: MongoDB `ChatMessage` 컬렉션에서 페이지네이션
* **flush 시점**
  * 1차: 방 종료 시 버퍼 전체를 `ChatMessage.insertMany` 후 `DEL chat:buf:{roomId}`
  * 2차(안전망): 5분마다 또는 버퍼 길이 1000 초과 시 부분 flush — Redis 장애·서버 크래시 시 손실 최소화
* **실시간 전파**: 메시지가 들어오면 같은 방 참여자에게 `message:new` 이벤트 push (아래 §5 참고)

## 5. 실시간 채널
* 목록 페이지: SSE (단방향, 가벼움)
* 채팅방 내부: **WebSocket 사용** — 라이브러리는 `ws` (의존성 최소화)
  * 메시지 송수신, presence 갱신 모두 WS 채널로 통일
* 인증: 연결 시 access token을 query 또는 첫 메시지로 전달 → 검증 실패 시 즉시 close
* 채널 키: `room:{roomId}` 단위로 구독, 서버 인메모리 Map으로 소켓 관리 (단일 프로세스 전제)
* WS 이벤트 종류
  * 클라→서버: `message:send`, `leave`
  * 서버→클라: `message:new`, `presence:update`, `room:closed`

## 6. 데이터 모델 (MongoDB)
* **ChatRoom**
  ```
  { _id, name, description, ownerId, capacity, participantCount,
    createdAt, closedAt, closedBy }
  ```
  인덱스: `{ closedAt: 1, createdAt: -1 }`, `{ ownerId: 1, closedAt: 1 }`
* **ChatMessage**
  ```
  { _id, roomId, authorId, content, createdAt }
  ```
  인덱스: `{ roomId: 1, createdAt: 1 }`
* **ChatParticipation**
  ```
  { _id, roomId, userId, joinedAt, leftAt }
  ```
  인덱스: `{ roomId: 1, userId: 1, joinedAt: -1 }`
  — 같은 사용자가 입·퇴장 반복하면 여러 row 생성

## 7. Redis 키 정리 (기존 컨벤션 준수)
| 키 | 타입 | 용도 | TTL |
|---|---|---|---|
| `chat:buf:{roomId}` | List | 메시지 버퍼 | 방 종료까지 |
| `chat:room:{roomId}:count` | String(int) | 참석자수 원자 카운터 | 방 종료까지 |
| `chat:room:{roomId}:members` | Set | 현재 참여 userId 집합(presence) | 방 종료까지 |

## 8. API 초안
* `POST   /api/chat/rooms` — 생성 (popular/admin)
* `GET    /api/chat/rooms` — 목록 (페이지네이션)
* `GET    /api/chat/rooms/stream` — 목록 SSE
* `POST   /api/chat/rooms/:id/close` — 종료 (방장/admin)
* `POST   /api/chat/rooms/:id/join` — 입장
* `POST   /api/chat/rooms/:id/leave` — 퇴장
* `GET    /api/chat/rooms/:id/messages` — 종료된 방의 메시지 조회
* `WS     /ws/chat/:roomId` — 방 내부 실시간 채널 (메시지 송수신, presence)

## 9. 확정된 정책 요약
1. 방장 퇴장 시 → **즉시 방 종료**
2. 채팅방 내부 실시간 채널 → **WebSocket(`ws`) 사용**
3. 무활동 자동 종료 TTL → **도입하지 않음**
4. 메시지 첨부(이미지/파일) → **미지원, 텍스트만**
5. 신고/차단 기능 → **이번 범위 제외**
