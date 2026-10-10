# Auth, Sessions, and Security 원문 한국어 번역

원문: [Auth, Sessions, and Security | Remix Docs](https://guides.remix.run/auth-sessions-security/)
라이선스: Remix Docs 페이지 하단의 “docs and examples licensed under MIT” 표기를 기준으로 번역 및 정리했다.

프로젝트 적용 실습은 [`practice-guide.ko.md`](./practice-guide.ko.md)에서 다룬다.

이 챕터의 원문 페이지도 2026-10-10 기준 개요만 있다. 페이지 맨 위에 "아직 끝나지 않은 챕터"라는
안내와 함께, 동작하는 API 예제는 아래 README들을 보라고 적혀 있다. 아래 번역은 그 안내와 절
12개의 개요 전체다.

- [Sessions](https://github.com/remix-run/remix/blob/main/packages/session/README.md)
- [Auth](https://github.com/remix-run/remix/blob/main/packages/auth/README.md)
- [Auth middleware](https://github.com/remix-run/remix/blob/main/packages/auth-middleware/README.md)
- [CSRF middleware](https://github.com/remix-run/remix/blob/main/packages/csrf-middleware/README.md)

## 개요

서명된 cookie, session, 인증된 identity(요청을 보낸 사람)는 서로 다른 층이다. 이 순서대로 쌓고,
그다음 상태를 바꾸는 route 둘레에 authorization(권한 확인)과 브라우저 출처 방어를 더한다.

## 그냥 cookie와 session {#cookies-vs-sessions}

브라우저가 정하는 설정값이나 서명된 작은 값 하나에는 `remix/cookie`를 쓴다. 상태에 서버가 관리하는
수명, flash 값, ID 교체, 위조할 수 없는 저장이 필요하면 `remix/session`을 쓴다. 로그인 상태와
장바구니가 그런 예다.

## cookie 설정과 secret 교체 {#cookie-configuration-and-secret-rotation}

`httpOnly`, `sameSite`, `secure`, `path`, 만료를 일부러 골라서 설정한다. 테스트가 아닌 곳에서는
secret을 필수로 요구하고, 교체하는 동안에는 가장 새 서명 secret을 맨 앞에 둔다. 서명은 위조를
막지만 cookie 내용을 숨기지는 않는다는 점을 기억한다.

## session middleware와 저장 방식 {#session-storage-strategies}

`session(cookie, storage)`는 상태를 요청 context로 읽어 오고, 바뀐 것을 응답에 저장한다. cookie,
파일 시스템, 메모리, Redis, Memcache 저장소를 크기, 내구성, 실행 환경, 앱 프로세스 여럿이 상태를
공유해야 하는지로 비교한다.

## session 값, flash 데이터, 교체, 파기 {#flash-messages}

`get`, `set`, `unset`, 요청 한 번만 사는 `flash`, `regenerateId(true)`, `destroy()`를 다룬다.
로그인과 그 밖의 권한 변경 뒤에는 ID를 교체하고, 로그아웃할 때는 identity 필드 하나만 지우지 말고
session을 파기하거나 교체한다.

## credentials 로그인과 로그아웃 {#credentials-auth}

credentials(로그인 정보)는 form schema로 parse하고, `createCredentialsAuthProvider()`와
`verifyCredentials()`로 검증한 다음, 앱이 소유한 auth 기록을 쓰기 전에 `completeAuth()`를 부른다.
redirect와 사용자에게 보이는 실패는 route가 맡고, 검증은 provider가 맡는다.

## OAuth와 OIDC 로그인 {#oauth-and-oidc-providers}

provider는 module scope에서 한 번 만들고, `startExternalAuth()`로 redirect를 시작하고,
`finishExternalAuth()`로 callback을 마무리하고, provider가 준 profile을 로컬 계정에 연결한 뒤
session을 완성한다. 내장 provider, 직접 만든 OIDC provider, 저장된 token 묶음,
`refreshExternalAuth()`를 다룬다.

## auth middleware로 요청의 identity를 정한다 {#request-auth-schemes}

`auth({ schemes })`는 session, bearer token, API key, 직접 만든 scheme을 순서대로 시도하고, 성공이나
실패를 `context.auth`에 넣는다. 로그인 프로토콜 작업은 `remix/auth`에, 요청마다 identity를 정하는
일은 `remix/middleware/auth`에 둔다.

## requireAuth로 route를 보호한다 {#route-protection-with-requireauth}

`requireAuth()`를 controller나 action middleware로 쓰고, HTML redirect나 frame용 HTML, API의 `401`
응답에 맞게 `onFailure`를 고친다. controller 하나에 건 보호는 중첩 route map에 연결된 controller로
흘러가지 않는다.

## 자원 하나하나의 작업을 authorize한다 {#authorization-checks}

authentication(인증)은 누가 요청했는지를 말하고, authorization은 그 identity가 이 기록을 읽거나
바꿔도 되는지를 정한다. `requireAuth()`가 이미 돌았더라도 action이나 데이터 쓰기 안에서 소유권,
역할, tenant, 상태 전이를 확인한다.

## CSRF synchronizer token {#csrf-protection}

`csrf()`보다 앞에 session middleware를 두고, `_csrf`에서 token을 꺼내기 전에 form parse를 둔다.
header와 숨은 필드라는 두 전달 방식, same-origin 확인, origin이 없을 때의 정책을 설명하고, cookie로
인증하면서 상태를 바꾸는 요청에 왜 일부러 만든 방어가 필요한지 설명한다.

## token 없는 cross-origin 보호 {#cross-origin-protection}

배포 환경이 `Sec-Fetch-Site`와 `Origin`을 믿을 수 있으면 `cop()`를 쓴다. 또는 `csrf()` 앞에 겹쳐
두어, 출처를 일찍 확인하고 synchronizer token도 함께 쓴다. 신뢰하는 origin과 보호를 끄는 bypass
패턴은 좁은 보안 예외로 다룬다.

## CORS는 인증도 CSRF 보호도 아니다 {#cors}

`cors()`는 브라우저가 다른 출처에서 불러야 하는 endpoint에만 쓴다. 정확한 origin, credential,
header, preflight 정책을 설정한다. CORS 응답 header는 호출한 쪽을 authorize하지 않고, 브라우저가
아닌 클라이언트가 endpoint에 닿는 것도 막지 않는다.
