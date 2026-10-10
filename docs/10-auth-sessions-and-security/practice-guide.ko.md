# Auth, Sessions, and Security

원문: [Auth, Sessions, and Security | Remix Docs](https://guides.remix.run/auth-sessions-security/) ·
전문 번역: [`original-translation.ko.md`](./original-translation.ko.md)

이 문서 하나로 챕터의 개념을 익히고, `vinyl-shelf` 프로젝트 코드로 실습한다. 각 절은 먼저
개념을 설명하고, **vinyl-shelf에서는** 단락에서 이 프로젝트의 실제 코드와 연결한다. 개념
설명에 붙은 코드 블록은 API의 모양만 보여주는 것이고, **vinyl-shelf에서는** 쪽 블록은 위에
적은 경로의 실제 파일 내용이다.

이 문서의 코드와 파일 경로는 `curriculum 10: Auth, Sessions, and Security` 커밋 시점 기준이다.

원문 페이지는 아직 개요뿐이다. 그래서 이 문서의 개념 설명은 원문 개요와, 원문이 가리키는 패키지
README, 그리고 `remix@3.0.0-beta.5`에 실제로 들어 있는 코드를 읽고 쓴 것이다. 원문과 설치된 버전이
다른 자리는 그 자리에서 적었다.

지난 챕터까지 vinyl-shelf는 누구나 앨범을 추가하고 고치고 지울 수 있었다. 이 챕터가 끝나면 이렇게
바뀐다.

- 앨범 목록과 상세는 여전히 누구나 본다.
- 추가하려면 로그인해야 한다. 추가한 사람이 그 앨범의 주인이 된다.
- 수정과 삭제는 주인만 할 수 있다. 다른 사람이 시도하면 `403`이다.
- 상태를 바꾸는 모든 form은 CSRF token을 싣고, 다른 사이트에서 온 POST는 action에 닿기 전에
  막힌다.

데모 계정은 둘이다. 비밀번호는 둘 다 `vinyl-shelf-demo`다.

| 계정 | 역할 |
| -- | -- |
| `shelf@vinyl.test` | seed 앨범 세 장의 주인 |
| `guest@vinyl.test` | 아무 앨범도 갖지 않은 계정 |

원문 개요의 첫 문장이 이 챕터의 순서를 정한다. **서명된 cookie → session → 인증된 identity →
authorization과 출처 방어.** 아래 절도 그 순서로 간다.

## 1. 그냥 cookie와 session

cookie는 브라우저가 들고 다니는 작은 값이다. 문제는 브라우저가 들고 있다는 것 자체다 — 사용자가
얼마든지 고칠 수 있다. 그래서 무엇을 cookie에 둘지는 **"이 값을 사용자가 고치면 버그인가?"**로
가른다.

- 고쳐도 괜찮은 값 — 화면 테마, 마지막으로 고른 정렬. `remix/cookie`로 충분하다.
- 고치면 안 되는 값 — 로그인한 사람이 누구인지, 장바구니. `remix/session`을 쓴다.

session을 쓰면 cookie에는 session ID만 들어가고, 실제 데이터는 서버 저장소에 있다. 서버가 데이터를
쥐고 있으므로 수명을 정하고, 한 번만 읽히는 flash 값을 두고, ID를 바꾸고, 통째로 지울 수 있다.

### vinyl-shelf에서는

이 프로젝트에는 session만 있고 독립된 cookie는 없다. 로그인 상태는 고치면 안 되는 값의 대표다.
session cookie 안에는 ID가 서명되어 들어 있고, `{ userId }`는 서버 쪽 저장소에 있다.

개발 서버에서 로그인하면 `vinyl-shelf/tmp/sessions/` 아래에 파일이 하나 생긴다. 열어 보면 이런
모양이다.

```json
[{"_csrf":"8736…","auth":{"userId":1}},{}]
```

배열의 첫 칸이 보통 값, 둘째 칸이 flash 값이다. 브라우저 cookie에는 이 내용이 하나도 없다.

## 2. cookie 설정과 secret 교체

cookie 속성은 기본값에 맡기지 말고 하나씩 골라서 적는다.

| 속성 | 하는 일 |
| -- | -- |
| `httpOnly` | 페이지 JavaScript가 `document.cookie`로 읽지 못한다 |
| `sameSite` | 다른 사이트에서 시작한 요청에 cookie를 실을지 정한다 |
| `secure` | HTTPS 연결에서만 보낸다 |
| `path` | 어느 경로의 요청에 실을지 정한다 |
| `maxAge` / `expires` | 언제까지 살지 정한다 |

`httpOnly`는 XSS가 생겨도 session ID가 새 나가지 않게 막는다. `sameSite: 'Lax'`는 다른 사이트에서
누른 링크로 들어올 때는 cookie를 싣고, 다른 사이트가 보내는 POST에는 싣지 않는다.

session cookie는 반드시 **서명**한다. 서명이 없으면 사용자가 남의 session ID를 지어내 넣을 수 있다.
`session()` middleware는 서명되지 않은 cookie를 받으면 시작부터 에러를 낸다.

서명 secret은 배열로 받는다. 새 secret을 **맨 앞**에 둔다 — 새 cookie는 첫 secret으로 서명하고,
들어온 cookie는 배열의 어느 secret으로든 확인한다. 그래서 secret을 바꿔도 이미 로그인한 사람이
쫓겨나지 않는다. 다 옮겨 갔다 싶으면 오래된 것을 뺀다.

원문이 짚는 함정이 하나 있다. **서명은 위조를 막을 뿐 내용을 숨기지 않는다.** 서명된 cookie의
값은 base64를 풀면 그대로 보인다.

### vinyl-shelf에서는

`app/middleware/session.ts`:

```ts
export const sessionCookie = createCookie('vinyl_session', {
  secrets: readSessionSecrets(),
  httpOnly: true,
  // Lax still sends the cookie on top-level navigations from other sites, so a
  // link into the app keeps the user signed in. Cross-site POSTs go without it.
  sameSite: 'Lax',
  secure: isProduction,
  path: '/',
  maxAge: 60 * 60 * 24 * 14,
})
```

`secure`는 production에서만 켰다. 개발 서버가 `http://localhost`라서, 켜 두면 브라우저가 cookie를
안 보내 로그인이 안 된다.

secret은 환경 변수에서 읽는다.

```ts
function readSessionSecrets() {
  let raw = process.env.SESSION_SECRETS ?? process.env.SESSION_SECRET
  let secrets = raw
    ?.split(',')
    .map((secret) => secret.trim())
    .filter(Boolean)

  if (secrets && secrets.length > 0) return secrets

  if (isProduction) {
    throw new Error('SESSION_SECRETS must be set in production')
  }

  // Local-only fallback so `npm run dev` and the tests start without setup.
  // Production refuses to boot without a real secret (above).
  return ['vinyl-shelf-local-dev-secret-not-for-production']
}
```

원문은 "테스트가 아닌 곳에서는 secret을 필수로" 하라고 한다. 이 프로젝트는 개발 환경에도 고정
secret을 허용했다 — 스터디하면서 `npm run dev` 전에 환경 변수부터 맞추게 하고 싶지 않아서다. 대신
production에서는 secret이 없으면 서버가 아예 뜨지 않는다. 실제 서비스라면 개발 환경도 원문대로
막는 쪽이 맞다.

교체할 때는 `SESSION_SECRETS="새것,옛것"`처럼 쉼표로 이어 준다.

로그인 응답의 `Set-Cookie`를 직접 보면 위 설정이 그대로 찍혀 있다.

```text
set-cookie: vinyl_session=YWI0OWMw….3cEHkop…; HttpOnly; Max-Age=1209600; Path=/; SameSite=Lax
```

점(`.`) 앞이 session ID를 base64로 쓴 것이고 뒤가 서명이다. 앞부분을 풀면 ID가 그대로 나온다 —
서명이 내용을 숨기지 않는다는 말이 이것이다.

## 3. session middleware와 저장 방식

`session(cookie, storage)`는 요청이 들어오면 cookie에서 ID를 꺼내 저장소에서 데이터를 읽고,
`context.session`에 넣는다. action이 끝나 응답이 돌아오면 바뀐 데이터를 저장하고 `Set-Cookie`를
붙인다.

저장소는 다섯 가지다.

| 저장소 | 맞는 곳 | 걸리는 점 |
| -- | -- | -- |
| cookie | 데이터가 작고 서버에 저장소가 없을 때 | 4KB 한도, 브라우저가 내용을 들고 다닌다 |
| 파일 시스템 | 프로세스 하나인 서버 | 서버 여러 대가 공유할 수 없다 |
| 메모리 | 테스트 | 서버를 재시작하면 사라진다 |
| Redis / Memcache | 서버 여러 대 | 따로 운영할 서비스가 생긴다 |

### vinyl-shelf에서는

개발과 production은 파일 시스템, 테스트는 메모리다.

```ts
const sessionStorage = isTest
  ? createMemorySessionStorage()
  : createFsSessionStorage(fileURLToPath(new URL('../../tmp/sessions', import.meta.url)))
```

`tmp/`는 이미 `.gitignore`에 있다. 테스트가 메모리를 쓰므로 테스트 파일마다 session이 깨끗하게
시작한다.

middleware 순서는 `app/router.ts`에 있다.

```ts
middleware: [
  staticFiles('./public', { index: false }),
  requestId(),
  // Rejects cross-site browser POSTs before any session is read or body parsed.
  cop(),
  loadSession(),
  formData(),
  methodOverride(),
  // After formData so the `_csrf` field is readable, and after the session
  // that stores the expected token.
  csrf(),
  loadDatabase(),
  loadAuth(),
  render(),
],
```

순서마다 이유가 있다. `cop()`은 header만 보면 되니 가장 앞이다. `csrf()`는 session에 저장된
token과 form의 `_csrf`를 비교하므로 둘 다 뒤에 와야 한다. `loadAuth()`는 session에서 사용자 ID를
읽고 DB에서 사용자를 찾으므로 session과 DB 뒤다. `render()`는 로그인한 사람을 화면에 보여주므로
`loadAuth()` 뒤다.

알아 둘 부작용이 하나 있다. `csrf()`는 모든 요청에서 token을 만들어 session에 넣는다. 그래서 처음
온 방문자도 첫 응답에서 session cookie를 받는다. 상세 페이지의 추천 frame은 서버 안에서 따로 요청을
만들어 그리는데, 처음 온 방문자라면 그 요청에도 cookie가 없어 버려질 session 파일이 하나 더 생긴다.
연습 앱에서는 그대로 두었다.

## 4. session 값, flash 데이터, 교체, 파기

session API는 여섯 개면 된다.

| 메서드 | 하는 일 |
| -- | -- |
| `get` / `set` / `unset` | 값을 읽고 쓰고 지운다 |
| `flash(key, value)` | 다음에 한 번 읽히면 사라지는 값을 넣는다 |
| `regenerateId(true)` | 데이터는 두고 ID만 바꾼다. `true`면 옛 ID의 저장소 기록을 지운다 |
| `destroy()` | session을 통째로 없앤다 |

ID를 바꿔야 하는 때가 정해져 있다. **로그인, 로그아웃, 권한이 바뀔 때.** 로그인 전에 누가 심어 둔
session ID가 있다면, 로그인 뒤에도 같은 ID를 쓰는 순간 그 사람도 로그인한 session을 쥐게 된다(session
fixation). ID를 바꾸면 심어 둔 ID는 쓸모가 없어진다.

로그아웃에서 `auth` 필드 하나만 지우는 것으로는 부족하다. cookie를 복사해 둔 사람이 있으면 그
session은 여전히 살아 있다. ID를 바꾸거나 session을 파기해야 한다.

flash는 POST → redirect → GET 흐름에서 "저장했습니다" 같은 메시지를 다음 페이지로 넘길 때 쓴다.
한 번 읽으면 사라지므로 새로고침하면 메시지가 없어진다.

### vinyl-shelf에서는

flash는 helper 둘로 감쌌다. `app/middleware/session.ts`:

```ts
/** A one-time message for the page the next redirect lands on. */
export function flashNotice(session: Session, message: string) {
  session.flash('notice', message)
}

/**
 * Reading a flash value removes it, so only page actions call this — never the
 * renderer, which also runs for frame requests that would swallow the message.
 */
export function takeNotice(session: Session) {
  let notice = session.get('notice')
  return typeof notice === 'string' ? notice : undefined
}
```

`takeNotice`의 주석이 이 프로젝트에서 실제로 걸리는 자리다. 공통 렌더러(`render()`)에서 flash를
읽으면 코드는 짧아진다. 하지만 상세 페이지의 추천 frame도 같은 렌더러로 그려지므로, frame 요청이
먼저 메시지를 읽어 버리면 페이지에는 안 보인다. 그래서 페이지 action이 직접 읽어 prop으로 넘긴다.

```tsx
async index(context) {
  return context.render(
    <AlbumsPage albums={await listAlbums(context.db)} notice={takeNotice(context.session)} />,
  )
},
```

로그아웃은 `app/actions/controller.tsx`에 있다.

```tsx
logout(context) {
  let { session } = context
  session.unset('auth')
  // The old id is deleted from storage, so a copied cookie stops working
  // even if someone kept it.
  session.regenerateId(true)
  flashNotice(session, 'Signed out.')
  return redirect(routes.home.href(), 303)
},
```

`destroy()` 대신 `regenerateId(true)`를 쓴 이유는 flash 메시지다. 파기하면 "Signed out." 메시지를
담을 session이 없다. 옛 ID의 기록은 `true`가 지우므로 복사해 둔 cookie는 어디에도 연결되지 않는다.
`app/actions/login/controller.test.ts`의 `signs out and makes the old cookie worthless` 테스트가 이것을
확인한다.

## 5. credentials 로그인과 로그아웃

원문은 로그인 처리를 세 단계로 나눈다.

1. **parse** — form schema로 이메일과 비밀번호를 꺼낸다.
2. **verify** — provider가 비밀번호를 확인한다. `createCredentialsAuthProvider({ parse, verify })`로
   만들고 `verifyCredentials(provider, context)`로 부른다.
3. **complete** — `completeAuth(context)`가 session ID를 바꾸고 session을 돌려준다. 거기에 앱이
   정한 모양으로 auth 기록(`{ userId }` 같은)을 쓴다.

역할도 나눈다. **provider는 검증만 하고, redirect와 사용자에게 보일 실패 화면은 route가 맡는다.**

### vinyl-shelf에서는

route는 `app/routes.ts`에 둘을 더했다.

```ts
login: form('/login'),
logout: post('/logout'),
```

`login`은 페이지와 제출이 있어서 `form()`이고, 중첩 map이라 `app/actions/login/controller.tsx`가
따로 있다. `logout`은 버튼 하나뿐이라 `post()`로 두고 최상위 controller에 넣었다.

provider는 module scope에서 한 번 만든다. `app/actions/login/controller.tsx`:

```tsx
const passwordProvider = createCredentialsAuthProvider({
  parse(context) {
    let result = s.parseSafe(loginFormSchema, context.get(FormData) ?? new FormData())
    return result.success ? result.value : { email: '', password: '' }
  },
  async verify({ email, password }, context) {
    let db = context.get(DatabaseContext)
    if (!db || email === '' || password === '') return null
    return verifyPassword(db, email, password)
  },
})
```

action은 결과에 따라 응답만 고른다.

```tsx
async action(context) {
  let returnTo = safeReturnTo(context.formData.get('returnTo'))
  let user = await verifyCredentials(passwordProvider, context)

  if (!user) {
    let email = context.formData.get('email')
    // One message for both a wrong password and an unknown email, so the
    // form does not reveal which addresses have accounts.
    return context.render(
      <LoginPage
        returnTo={returnTo}
        email={typeof email === 'string' ? email.trim() : ''}
        error="Email or password is incorrect."
      />,
      { status: 400 },
    )
  }

  // New session id before the auth record is written: an id someone
  // planted before login must not become a signed-in session.
  let session = completeAuth(context)
  session.set('auth', { userId: user.id } satisfies SessionAuth)
  flashNotice(session, `Signed in as ${user.name}.`)

  return redirect(returnTo, 303)
},
```

실패 화면은 9장에서 본 규칙 그대로다. 이메일은 다시 채우고, 비밀번호는 다시 채우지 않는다.
메시지는 "비밀번호가 틀림"과 "없는 이메일"을 구분하지 않는다. 구분하면 누가 가입했는지 알아내는
도구가 된다.

같은 이유로 응답 시간도 맞췄다. 없는 이메일이면 비밀번호 확인을 건너뛰어 응답이 빨라지고, 그
차이로 가입 여부가 드러난다. `app/data/users.ts`는 없는 이메일에도 미리 만든 가짜 hash로 한 번
확인한다.

```ts
// Hashed once at startup. An unknown email still pays for one scrypt run, so
// response time does not reveal which emails have accounts.
const decoyHash = await hashPassword('decoy-password')

export async function verifyPassword(db: Database, email: string, password: string) {
  let row = await db.findOne(users, { where: { email: email.trim().toLowerCase() } })
  if (!row) {
    await passwordMatches(password, decoyHash)
    return null
  }

  return (await passwordMatches(password, row.password_hash)) ? toUser(row) : null
}
```

비밀번호는 Node 내장 `scrypt`로 hash한다. 패키지를 따로 설치하지 않으려고 고른 것이다. 저장 형식은
`scrypt$<salt>$<hash>`이고, 비교는 `timingSafeEqual`로 한다.

`returnTo`는 로그인 뒤 돌아갈 곳이다. URL에서 오므로 누구나 값을 넣은 링크를 만들 수 있다.

```tsx
function safeReturnTo(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') return routes.home.href()
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return routes.home.href()
  }
  return value
}
```

`//evil.test`는 `/`로 시작하지만 브라우저는 다른 host로 읽는다. 이것을 걸러내지 않으면 "우리
사이트 로그인 링크"가 피싱 사이트로 보내는 open redirect가 된다.

사용자 테이블은 migration 둘로 만들었다. `db/migrations/20261010000000_create_users`가 `users`
테이블을, `20261010000100_add_albums_owner`가 `albums.owner_id`를 더한다. 이미 있던 개발 DB의
앨범은 주인이 없으므로, seed가 그 앨범들을 `shelf@vinyl.test`에게 넘긴다(`app/data/albums.ts`의
`seedShelf`). 데모 계정은 production에서는 만들지 않는다.

## 6. OAuth와 OIDC 로그인

GitHub나 Google 계정으로 로그인하는 흐름이다. 순서는 이렇다.

1. provider를 module scope에서 한 번 만든다.
2. `startExternalAuth()`가 provider 사이트로 redirect한다.
3. 사용자가 거기서 허락하면 provider가 우리 callback URL로 돌려보낸다.
4. callback에서 `finishExternalAuth()`가 code를 token과 profile로 바꾼다.
5. profile을 로컬 계정에 연결하고, `completeAuth()`로 session을 완성한다.

access token이 만료되면 `refreshExternalAuth()`로 새로 받는다.

### vinyl-shelf에서는

만들지 않았다. OAuth는 provider에 앱을 등록하고 client secret을 받아야 시작할 수 있어서, 이
저장소를 받은 사람이 바로 돌려 볼 수 없다. 5절의 credentials 로그인과 마지막 단계가 같다는 점만
짚어 둔다 — 어느 방식이든 `completeAuth()`로 ID를 바꾼 뒤 `{ userId }`를 쓴다. 그래서 7절부터의
코드는 로그인 방식이 바뀌어도 그대로 쓸 수 있다.

## 7. auth middleware로 요청의 identity를 정한다

로그인은 한 번이지만, "이 요청은 누가 보냈나"는 요청마다 다시 정해야 한다. 그 일을
`auth({ schemes })` middleware가 한다. scheme을 순서대로 시도해서 결과를 `context.auth`에 넣는다.

- 성공 — `{ ok: true, identity, method }`
- 실패 또는 익명 — `{ ok: false, error? }`

scheme은 session, bearer token, API key 셋이 내장되어 있고, 직접 만들 수도 있다.

원문이 나누는 경계가 있다. **로그인 프로토콜(비밀번호 확인, OAuth redirect)은 `remix/auth`, 요청마다
identity를 정하는 일은 `remix/middleware/auth`.**

### vinyl-shelf에서는

session scheme 하나만 쓴다. `app/middleware/auth.ts`:

```ts
export function loadAuth() {
  return auth({
    schemes: [
      createSessionAuthScheme<User, SessionAuth>({
        read(session) {
          let value = session.get('auth') as SessionAuth | undefined
          return typeof value?.userId === 'number' ? value : null
        },
        // A deleted account must stop working on its next request, so the
        // session only stores the id and the row is looked up every time.
        verify(value, context) {
          let db = context.get(DatabaseContext)
          return db ? getUser(db, value.userId) : null
        },
        invalidate(session) {
          session.unset('auth')
        },
      }),
    ],
  })
}
```

session에는 `userId`만 넣고, 이름 같은 사용자 정보는 넣지 않았다. 매 요청 DB에서 다시 읽는다.
계정을 지우거나 이름을 바꾸면 다음 요청부터 바로 반영된다. 사용자 정보를 session에 넣어 두면
로그아웃할 때까지 옛 정보가 남는다.

`getUser`가 `null`을 돌려주면(계정이 지워졌으면) `invalidate`가 session의 `auth`를 지운다.

로그인한 사람은 모든 페이지에 필요하다 — 내비게이션에 이름과 "Sign out"을 보여줘야 하기 때문이다.
그래서 렌더러가 `context.auth`를 읽어 페이지 전체를 감싸는 컴포넌트에 넣는다.
`app/middleware/render.tsx`:

```tsx
let csrfToken = getCsrfToken(context)
// The factory's context is untyped; loadAuth() runs before render() and stores this shape.
let auth = context.get(Auth) as AuthState<User> | undefined
let user = auth?.ok ? auth.identity : null

let stream = renderToStream(
  <RequestScope user={user} csrfToken={csrfToken}>
    {node}
  </RequestScope>,
```

`RequestScope`(`app/ui/request-scope.tsx`)는 4장에서 본 `AppShell`과 같은 context 패턴이다. 아래
컴포넌트가 `handle.context.get(RequestScope)`로 읽는다. 브라우저에서 hydrate되는 컴포넌트는 이
context를 못 읽으므로, 거기에는 prop으로 넘긴다(10절).

## 8. requireAuth로 route를 보호한다

`requireAuth()`는 `context.auth`가 실패면 action까지 가지 않고 응답을 돌려준다. 기본 응답은 `401`인데,
`onFailure`로 바꿀 수 있다. 화면을 보던 브라우저에는 로그인 페이지로 redirect, API에는 `401` JSON이
맞다.

원문이 따로 짚는 함정이 있다. **controller에 건 보호는 중첩 route map의 controller로 흘러가지
않는다.** `albums` controller에 걸어도 `albums.edit` controller는 보호받지 못한다.

### vinyl-shelf에서는

`app/middleware/auth.ts`:

```ts
export function requireUser() {
  return requireAuth<User>({
    onFailure(context) {
      if (wantsJson(context)) {
        return Response.json({ error: 'Sign in required' }, { status: 401 })
      }

      let returnTo = context.url.pathname + context.url.search
      return redirect(routes.login.index.href(undefined, { returnTo }), 303)
    },
  })
}
```

JSON 갈래는 수정 form 때문이다. 9장의 개선된 수정 form은 `Accept: application/json`으로 보내므로,
로그인이 풀린 상태에서 저장하면 redirect된 HTML 대신 `401`을 받아 "다시 로그인하세요"를 보여준다.

`albums` controller에서는 action 하나씩 건다. 목록과 상세는 누구나 봐야 하기 때문이다.
`app/actions/albums/controller.tsx`:

```tsx
create: {
  middleware: [requireUser()],
  async handler(context) {
    // requireUser() already answered anonymous requests; this narrows the type,
    // which beta.5 does not carry through action middleware inside a controller.
    if (!context.auth.ok) return new Response('Unauthorized', { status: 401 })
    let user = context.auth.identity
```

`if (!context.auth.ok)` 한 줄은 런타임에는 절대 참이 되지 않는다. `requireUser()`가 이미 걸렀다.
README는 action middleware가 타입을 좁혀 준다고 하지만, beta.5에서 controller 안의 action 객체에
넣으면 좁혀지지 않는다. `createAction()`으로 감싸 보면 controller 쪽 타입과 맞지 않아 컴파일 에러가
난다. 그래서 README 첫 예제처럼 handler 안에서 확인했다.

수정 controller는 모든 action이 보호 대상이라 controller에 건다.
`app/actions/albums/edit/controller.tsx`:

```tsx
export default createController(routes.albums.edit, {
  // The albums controller's middleware does not reach this nested route map,
  // so the boundary is declared again here.
  middleware: [requireUser()],
```

여기서는 controller 단위 middleware라 `context.auth.identity`가 바로 타입이 맞는다.

## 9. 자원 하나하나의 작업을 authorize한다

로그인했다고 아무 앨범이나 고칠 수 있으면 안 된다. **authentication은 "누구냐", authorization은 "이
사람이 이 기록에 이것을 해도 되냐"다.** `requireAuth()`는 앞의 것만 한다.

뒤의 것은 action이나 데이터 쓰기 안에서 확인한다. 소유권, 역할, tenant, 상태 전이(예: 이미 발송된
주문은 취소 불가)가 그런 확인이다.

### vinyl-shelf에서는

규칙은 하나다. **앨범을 추가한 사람만 그 앨범을 고치고 지운다.** `albums.owner_id`가 그 기록이다.

확인은 데이터 계층의 쓰기 함수 안에 있다. `app/data/albums.ts`:

```ts
return db.transaction(async (tx) => {
  let album = await getAlbum(tx, slug)
  if (!album) return { ok: false, reason: 'not-found' }
  // Checked here as well as in the controller: the write is the last place
  // every caller passes through.
  if (!canManageAlbum(album, actorId)) return { ok: false, reason: 'forbidden' }
  if (album.revision !== expectedRevision) return { ok: false, reason: 'conflict', album }
```

`updateAlbum`과 `deleteAlbum`은 이제 `actorId`(누가 하는지)를 받는다. 받지 않으면 호출할 수 없으므로,
나중에 쓰기 경로를 하나 더 만들어도 소유권 확인을 빠뜨릴 수 없다. 결과에 `'forbidden'`이 생겼고,
controller가 그것을 `403`으로 바꾼다.

controller에도 확인이 있다. 수정 페이지(GET)는 쓰기가 없으므로 controller가 직접 막는다.

```tsx
if (!canManageAlbum(album, context.auth.identity.id)) {
  return context.render(<ForbiddenPage slug={album.slug} />, { status: 403 })
}
```

수정 제출이 검증에 실패한 경우도 controller에서 소유권을 먼저 본다. 남의 앨범에 빈 제목을 보내면
"제목이 필요합니다"(400)가 아니라 403이 온다. 주인이 아닌 사람에게는 form에 대해 아무것도 알려주지
않는다.

`401`과 `403`의 차이도 여기서 드러난다. 로그인하지 않았으면 `requireUser()`가 로그인으로 보낸다.
로그인했지만 주인이 아니면 `403`이다. 다시 로그인해도 해결되지 않는다는 뜻이다.

상세 페이지는 주인이 아니면 수정·삭제 버튼을 숨긴다. `app/ui/vinyl-shelf.tsx`:

```tsx
{/* Hiding the buttons is only courtesy; the edit and delete actions check ownership themselves. */}
{canManage ? (
  <a href={routes.albums.edit.index.href({ slug: album.slug })} mix={primaryLinkStyle}>
    Edit album
  </a>
) : null}
```

주석대로 버튼을 숨기는 것은 보호가 아니다. form을 직접 만들어 보내면 그만이다.
`app/actions/albums/controller.test.ts`의 `refuses an edit from a non-owner even when the form is
posted directly` 테스트가 바로 그렇게 보내 본다.

## 10. CSRF synchronizer token

CSRF(cross-site request forgery)는 다른 사이트가 사용자의 브라우저를 빌려 우리 사이트에 요청을
보내는 공격이다. 공격 페이지에 우리 사이트로 POST하는 form을 숨겨 두면, 브라우저가 우리 사이트
cookie를 실어 보낸다. 서버는 로그인한 사용자가 보낸 정상 요청으로 받는다.

synchronizer token이 이것을 막는다. 서버가 session마다 무작위 token을 만들어 두고, 우리 페이지의
form에만 숨은 필드로 넣는다. 다른 사이트는 우리 페이지 내용을 읽을 수 없으므로 token을 모른다.
POST가 오면 form의 token과 session의 token을 비교한다.

`csrf()`의 동작:

- session에 token이 없으면 만든다. `getCsrfToken(context)`로 꺼낸다.
- GET·HEAD·OPTIONS는 검사하지 않는다.
- 그 밖의 method는 token을 header(`X-Csrf-Token` 등)나 form 필드 `_csrf`에서 찾아 비교한다.
- `Origin`이나 `Referer`가 있으면 같은 출처인지도 본다. 둘 다 없으면 기본은 통과다
  (`allowMissingOrigin: true`).

설치 순서가 정해져 있다. session이 앞에 있어야 token을 저장하고, `formData()`가 앞에 있어야 `_csrf`
필드를 읽는다.

### vinyl-shelf에서는

상태를 바꾸는 form은 다섯 개다 — 앨범 추가, 수정, 삭제, 로그인, 로그아웃. 다섯 군데 모두 token을
싣는다. 서버에서만 그려지는 form은 `CsrfField` 컴포넌트를 넣는다. `app/ui/request-scope.tsx`:

```tsx
export function CsrfField(handle: Handle) {
  let scope = handle.context.get(RequestScope)
  return () => <input type="hidden" name="_csrf" value={scope.csrfToken} />
}
```

로그인 form에도 들어간다. 로그인 전에 무슨 CSRF냐 싶지만, 공격자가 자기 계정으로 피해자를
로그인시키는 공격(login CSRF)이 있다. 피해자는 공격자 계정에 자기 정보를 입력하게 된다.

수정 form은 브라우저에서 hydrate되므로 `RequestScope` context를 못 읽는다. 페이지가 token을 prop으로
넘긴다. `app/actions/albums/edit/page.tsx`:

```tsx
<AlbumEditForm
  actionHref={routes.albums.edit.action.href({ slug: album.slug })}
  values={formValues}
  errors={errors}
  revision={album.revision}
  csrfToken={scope.csrfToken}
  notice={notice}
/>
```

form 안의 숨은 필드가 그 값을 쓴다. 개선된 제출은 `new FormData(form, event.submitter)`로 보내므로
숨은 필드가 그대로 body에 실린다. 따로 header를 붙일 필요가 없다.

token은 로그인해도 바뀌지 않는다. session ID는 바뀌지만 데이터는 그대로 옮겨 가기 때문이다. 로그인
전에 token을 알아낸 사람이 있어도, 그 token이 묶인 옛 session ID는 지워졌으므로 쓸 수 없다.

## 11. token 없는 cross-origin 보호

요즘 브라우저는 요청마다 `Sec-Fetch-Site` header를 붙인다. 같은 사이트에서 시작한 요청이면
`same-origin`, 다른 사이트면 `cross-site`다. 페이지 JavaScript는 이 값을 바꿀 수 없다.

`cop()`은 이 header만으로 막는다. token도 session도 필요 없다. `Sec-Fetch-Site`가 없으면 `Origin`을
request host와 비교하고, 둘 다 없으면 통과시킨다(오래된 클라이언트나 브라우저가 아닌 호출을 막지
않으려고).

원문은 두 가지 쓰임을 말한다. 배포 환경이 이 header들을 믿을 수 있으면 `cop()`만 쓴다. 아니면
`csrf()` 앞에 겹쳐서 일찍 거르고 token도 확인한다. `trustedOrigins`와 `insecureBypassPatterns`는
보호에 구멍을 내는 것이므로 좁게 쓴다.

### vinyl-shelf에서는

겹쳐 쓰는 쪽을 골랐다. `cop()`이 미들웨어 맨 앞쪽에서 다른 사이트의 POST를 거르고, 통과한 요청은
`csrf()`가 token으로 다시 본다. 겹쳐 둔 이유는 `cop()`이 header가 없는 요청을 통과시키기 때문이다.
그런 요청도 `csrf()`에서는 token이 없으면 막힌다.

`app/actions/login/controller.test.ts`의 `security: csrf and cross-origin requests` 묶음이 각 층을
따로 확인한다.

| 테스트 | 막는 층 | 응답 |
| -- | -- | -- |
| cookie는 있고 token이 없다 | `csrf()` | 403 |
| 다른 session의 token을 실었다 | `csrf()` | 403 |
| token은 맞는데 `Sec-Fetch-Site: cross-site` | `cop()` | 403 |
| token은 맞는데 `Origin: https://evil.test` | `cop()` | 403 |
| 같은 출처, 맞는 token | — | 303 |

세 번째와 네 번째는 token이 맞는데도 막힌다. `csrf()`까지 가기 전에 `cop()`이 끊었다는 뜻이다.

webhook처럼 외부에서 POST를 받아야 하는 route는 아직 없어서 bypass 패턴도 쓰지 않았다.

## 12. CORS는 인증도 CSRF 보호도 아니다

CORS(cross-origin resource sharing)는 다른 출처의 **브라우저 JavaScript가 응답을 읽어도 되는지**를
서버가 알려주는 header다. 두 가지를 하지 않는다.

- 호출한 사람을 authorize하지 않는다. `Access-Control-Allow-Origin`은 "이 출처의 페이지가 응답을
  읽어도 된다"는 뜻이지 "이 사람이 해도 된다"는 뜻이 아니다.
- 요청이 서버에 닿는 것을 막지 않는다. curl 같은 브라우저 밖 클라이언트는 CORS를 아예 보지 않는다.
  단순한 form POST는 브라우저에서도 preflight 없이 서버에 도착한다 — 읽지 못할 뿐이다.

그래서 CORS는 다른 출처에서 불러야 하는 endpoint에만, 정확한 origin과 credential 정책으로 건다.

### vinyl-shelf에서는

`cors()`를 쓰지 않았다. 모든 요청이 같은 출처에서 온다. `/api/albums`도 같은 사이트의 검색 상자만
부른다. CORS를 걸지 않았다고 CSRF가 막히는 것은 아니라는 점이 이 절의 요점이다 — 10절과 11절의
방어는 CORS와 상관없이 필요하다.

## 테스트를 위한 cookie jar

로그인과 CSRF가 생기면서 지난 챕터의 테스트가 전부 다시 써야 할 처지가 됐다. POST마다 session
cookie와 token이 있어야 하기 때문이다. 그래서 테스트용 브라우저를 하나 만들었다.
`test/browser.ts`:

```ts
export class Browser {
  #cookies = new Map<string, string>()

  static async signedIn(email = shelfOwnerEmail, password = demoPassword) {
```

`Browser` 하나가 브라우저 하나다. 받은 `Set-Cookie`를 기억했다가 다음 요청에 싣고, `submit()`은
페이지에서 token을 읽어 `_csrf`를 붙인다. 지난 챕터 테스트는 대부분 `router.fetch(request(...))`를
`owner.submit(...)`으로 바꾸는 것으로 끝났다.

이 파일이 테스트로 실행되지 않도록 `package.json`의 `test` script를
`node --test 'app/**/*.test.ts'`로 좁혔다. Node는 기본으로 `test/` 디렉터리 안의 모든 파일을 테스트로
실행한다.

## 정독 후 확인 질문

1. 로그인 상태를 서명된 cookie에 `{ userId: 1 }`로 직접 넣으면 무엇이 문제인가? 서명이 있는데도
   session이 더 나은 이유를 둘 들어 보자.
2. 로그인할 때 session ID를 바꾸지 않으면 어떤 공격이 가능한가? 공격자가 하는 일을 순서대로 적어
   보자.
3. flash 메시지를 렌더러에서 읽지 않고 action에서 읽는 이유는 무엇인가? 렌더러에서 읽으면 어느
   페이지에서 메시지가 사라지는가?
4. `requireUser()`가 있는데도 `updateAlbum`이 `actorId`를 받아 소유권을 다시 확인하는 이유는
   무엇인가?
5. `cop()`만 있고 `csrf()`가 없으면 막히지 않는 요청은 어떤 것인가? 반대로 `csrf()`만 있으면
   `cop()`이 더해 주는 것은 무엇인가?
6. 남의 앨범 수정 form에 빈 제목을 보내면 400이 아니라 403이 온다. 400을 돌려주면 무엇이 새
   나가는가?

## 스터디 과제

**앨범을 다른 계정에 넘기는 기능을 만든다.** 지금은 앨범의 주인이 바뀌지 않는다.

1. route를 하나 정한다. 상세 페이지에서 받는 계정의 이메일을 입력하고 넘긴다. URL과 method는 각자
   정한다.
2. 주인만 넘길 수 있어야 한다. 확인은 `updateAlbum`처럼 데이터 계층의 쓰기 함수 안에도 둔다.
3. 없는 이메일이면 form을 `400`으로 다시 보여준다. 넘긴 뒤에는 상세 페이지로 `303`하고, flash로
   "누구에게 넘겼다"는 메시지를 보여준다.
4. form은 CSRF token을 싣는다. JavaScript 없이 동작해야 한다.
5. 넘긴 직후 원래 주인의 상세 페이지에서 수정·삭제 버튼이 사라져야 한다.
6. 테스트를 셋 이상 추가한다 — 주인이 넘기면 303이고 `owner_id`가 바뀐다, 주인이 아니면 403이다,
   token 없이 보내면 403이다.

넘기기 전에 받는 사람에게 확인을 받을지(수락 단계), 넘긴 기록을 남길지는 정해 두지 않았다. 수락
단계를 넣는다면 그 사이 앨범의 상태(넘기는 중)를 어디에 둘지가 9절의 "상태 전이" 확인이 된다.
