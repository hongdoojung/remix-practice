# Start Here

원문: [Start Here | Remix Docs](https://guides.remix.run/start-here/) ·
전문 번역: [`original-translation.ko.md`](./original-translation.ko.md)

이 문서 하나로 챕터의 개념을 익히고, `vinyl-shelf` 프로젝트 코드로 실습한다. 각 절은 먼저
개념을 설명하고, **vinyl-shelf에서는** 단락에서 이 프로젝트의 실제 코드와 연결한다.

이 문서의 코드와 파일 경로는 `curriculum 01: Start Here` 커밋 시점 기준이다. 뒤 챕터를
진행하면 파일이 나뉘거나 옮겨진다.

## 1. Remix란 무엇인가

Remix는 웹 표준인 `Request`와 `Response`를 중심에 둔 TypeScript 프레임워크다. 모든 동작이
한 가지 흐름으로 설명된다.

1. 서버가 Web `Request`를 받는다.
2. router가 요청을 typed route(param과 URL 생성까지 타입으로 잡히는 route)에 매칭한다.
3. controller(매칭된 route의 요청을 처리하는 코드 묶음)가 요청을 처리한다.
4. 앱이 Web `Response`를 반환한다.

그래서 관점이 "페이지를 렌더링한다"가 아니라 **"요청을 받아 응답을 만든다"**가 된다. 응답은
HTML일 수도 있고, redirect일 수도 있고, JSON·파일·404 같은 다른 어떤 HTTP 응답일 수도 있다.

`remix` 패키지 하나에 서버 어댑터, router, middleware(요청이 action에 닿기 전에 공통 처리를
끼워 넣는 계층), UI, 데이터 검증, 인증, asset 서빙, 테스트 도구가 전부 들어 있다. 각 계층은 독립적으로도 쓸 수 있어서, 전체 요청 경로를 다 쓸
수도 있고 필요한 계층만 골라 쓸 수도 있다.

이 설계 뒤에는 여섯 가지 원칙이 있다. 이후 챕터에서 반복해서 등장하므로 이름은 알아두자.

1. **Agent-First Development** — 소스, 문서, 추상화를 LLM이 다루기 좋게 만들고, 제품 안에서
   모델을 쓸 수 있는 기본 도구를 제공한다.
2. **Build on Web APIs** — `Request`, `Response`, `URL`, `FormData` 같은 플랫폼 API 위에
   만든다. 서버와 브라우저에서 같은 API를 쓰니 오가는 비용이 줄고 앱의 이식성이 유지된다.
3. **Religiously Runtime** — bundler, 코드 생성, 정적 분석에 의존하지 않는다. route,
   middleware, controller, 테스트가 전부 일반 코드로 그냥 실행된다.
4. **Avoid Dependencies** — 의존성을 최소화하고, 쓰더라도 프레임워크 경계 뒤로 감춘다.
5. **Demand Composition** — 패키지 하나가 목적 하나를 가지며, 교체 가능하고 독립적으로도
   유용하다.
6. **Distribute Cohesively** — 조각들을 `remix` 패키지 하나와 문서 경로 하나로 배포한다.

### vinyl-shelf에서는

위의 요청 흐름이 파일로는 이렇게 이어진다.

```text
server.ts                     # Request가 들어오는 곳
  -> app/router.ts            # middleware를 거쳐 route 매칭
  -> app/routes.ts            # URL 정의
  -> app/actions/controller.tsx  # 요청 처리, Response 결정
  -> app/ui/vinyl-shelf.tsx   # HTML을 만드는 경우의 UI
```

이 챕터의 실습은 이 경로를 한 번씩 직접 밟아 보는 것이다.

## 2. 앱 만들고 실행하기

새 Remix 앱은 CLI 한 줄로 만든다. Node 서버, typed routes, render middleware,
server-rendered 홈 페이지, hydrated component 하나가 포함된 작은 full-stack 앱이 생긴다.

```sh
npx remix@next new my-remix-app
```

만들어진 `package.json`을 열어 보면 runtime 의존성이 `remix` 하나뿐이다. 서버 어댑터부터
브라우저 코드 로딩까지 전부 이 단일 패키지의 subpath import(`remix/router`, `remix/ui`처럼
패키지 안 경로를 지정하는 import)로 가져온다.

### vinyl-shelf에서는

이 저장소는 이미 앱을 초기화해 두었다. 실행과 검증 명령은 다음과 같다.

```sh
corepack pnpm run dev        # http://localhost:44100
corepack pnpm test
corepack pnpm run typecheck
```

## 3. 프로젝트 개괄

Remix 앱은 요청이 지나가는 경로가 파일 구조에 그대로 보이도록 유지한다. 표준 구조는
이렇다.

```text
my-remix-app/
├── server.ts              # 이 runtime의 request 진입점
└── app/
    ├── routes.ts          # route 정의, URL helper
    ├── router.ts          # middleware / routes / controller 연결
    ├── middleware/        # request middleware
    ├── actions/           # controller와 route별 동작, route 전용 UI
    ├── ui/                # 공유 view, layout
    ├── assets.ts          # 브라우저 모듈 서버 설정
    └── entry.browser.ts   # 브라우저 runtime 시작
```

각 파일의 역할을 요청 흐름 순서로 읽으면 된다. 요청은 `server.ts`로 들어와 `router.ts`로
전달되고, middleware를 통과한 뒤 `routes.ts`의 정의와 매칭되고, `actions/`의 action에서
처리되어 `Response`로 나간다. 공유 UI는 `ui/`에 두고, 브라우저에서 로드해야 하는 모듈은
`.browser.ts`/`.browser.tsx` 접미사로 표시한다.

`server.ts`는 runtime 진입점이다. Node 기반이라면 HTTP 서버를 만들고, Node의 요청 객체를
Web `Request`로 바꾼 뒤 `router.fetch(request)`에 넘긴다. 이 파일은 앞으로도 거의 건드릴
일이 없다.

```ts
const server = http.createServer(
  createRequestListener(async (request) => {
    return await router.fetch(request)
  }),
)
server.listen(44100)
```

### vinyl-shelf에서는

구조는 표준과 거의 같고, 한 가지 선택이 다르다. 브라우저에서 로드되는 코드를 접미사 대신
`app/assets/` 디렉터리 하나에 모았다.

```text
vinyl-shelf/
├── server.ts
└── app/
    ├── routes.ts
    ├── router.ts
    ├── actions/
    │   ├── controller.tsx
    │   └── controller.test.ts
    ├── data/                   # in-memory album 저장소와 검증
    ├── middleware/render.tsx   # context.render를 제공하는 middleware
    ├── ui/                     # Document shell, 페이지 컴포넌트
    ├── assets.ts               # 어떤 파일을 브라우저에 serve할지 결정
    └── assets/
        ├── entry.ts            # 브라우저 runtime 시작
        └── album-preview.tsx   # hydrate되는 컴포넌트
```

`app/assets.ts`의 `allow: ['app/assets/**', 'node_modules/**']`가 이 규칙을 강제한다.
이 목록 밖의 서버 코드는 브라우저로 나가지 않는다.

## 4. 첫 route 정의하기

Remix는 route 정의와 요청 처리를 분리한다. `app/routes.ts`는 앱이 받아들이는 URL과 HTTP
method의 목록이고, `app/actions/`는 그 route가 매칭됐을 때 무엇을 반환할지 정하는 곳이다.

왜 분리할까. URL을 한 곳에서만 정의하면 link, form, redirect, 테스트가 전부 같은 정의를
공유한다. URL 문자열을 코드 곳곳에 흩뿌리지 않아도 되고, URL이 바뀌면 타입 에러로 바뀐
자리를 전부 찾을 수 있다.

route를 정의하는 방법은 이 챕터에서 세 가지가 나온다.

- **문자열** — `home: '/'`처럼 pattern만 쓰면 모든 HTTP method와 매칭된다.
- **`get(pattern)` / `post(pattern)`** — 하나의 method로 좁힌다.
- **중첩 map** — `albums: { show: get('/albums/:albumId') }`처럼 그룹으로 묶으면
  `routes.albums.show`로 참조한다. 그룹 단위로 controller를 나눌 수 있게 된다.

pattern 안의 `:albumId` 같은 부분은 path variable이다. `/albums/thriller`가 매칭되면
action에서 `context.params.albumId`로 읽을 수 있고, 이 param의 존재가 타입으로 보장된다.
pattern은 이 밖에도 wildcard(`*path`), optional 구간, hostname까지 표현할 수 있다.

정의된 route는 URL 생성기(href constructor)를 함께 제공한다.

```ts
routes.albums.show.href({ albumId: 'thriller' })  // '/albums/thriller'
```

### vinyl-shelf에서는

`app/routes.ts`는 아직 그룹 없이 평평하게 시작한다.

```ts
import { get, post, route } from 'remix/routes'

export const routes = route({
  assets: get('/assets/*path'),
  home: '/',
  albums: get('/albums'),
  albumsAction: post('/albums'),
  album: get('/albums/:slug'),
  apiAlbums: get('/api/albums'),
})
```

같은 URL `/albums`에 GET(`albums`)과 POST(`albumsAction`)를 따로 정의했다. 다음 챕터에서
이 목록을 중첩 map으로 재구성하고 controller도 나눈다. controller 연결은 `app/router.ts`의
`router.map(routes, controller)` 한 줄이다.

프로젝트 전체에서 URL이 필요한 자리 — link, redirect, 테스트 — 는 전부
`routes.album.href({ slug })`를 쓴다. `app/actions/controller.test.ts`에서 확인할 수 있다.

이 계약의 효과는 직접 실험해 보는 게 빠르다. `album`의 pattern을 다른 URL로 바꿔도
테스트는 그대로 통과한다 — 테스트도 URL을 `href()`로 만들기 때문이다. 반면 param 이름
`:slug`를 바꾸면 `href({ slug })`를 쓰는 모든 자리에서 타입 에러가 난다. 확인했으면
되돌리자.

## 5. 첫 페이지 만들기

Remix UI는 JSX를 쓰지만 React와 구조가 다르다. 컴포넌트는 **두 단계 함수**다.

```tsx
function MyComponent(handle: Handle<Props>) {
  // setup 단계: 컴포넌트가 만들어질 때 한 번 실행된다.
  // 여기 선언한 변수가 local state가 된다.
  return () => {
    // render 단계: 첫 렌더와 이후 모든 업데이트에서 실행된다.
    return <div>Hello</div>
  }
}
```

바깥 함수(setup)는 한 번만 실행되므로, 그 안의 일반 변수가 state 역할을 한다. hook이 없다.
`handle`은 `handle.props`로 props를 읽고 `handle.update()`로 다시 그리게 하는 통로다.

action에서 이 컴포넌트로 HTML 응답을 만들 때는 `context.render(...)`를 쓴다. 반환값은
여전히 Web `Response`이고, 본문을 문자열 대신 컴포넌트 트리로 만든다는 점만 다르다.
`context.render`는 프레임워크 내장이 아니라 `app/middleware/render.tsx`가 context에 넣어 주는
앱 코드다. Rendering UI 챕터에서 이 middleware의 내부를 다룬다.

스타일은 `css()` helper로 만들어 `mix` prop에 넘긴다. `mix`는 스타일과 이벤트 리스너처럼
"이 요소에 섞어 넣을 것"을 받는 자리다.

### vinyl-shelf에서는

`home` action이 첫 페이지를 반환한다.

```tsx
home(context) {
  return context.render(<HomePage albums={listAlbums()} />)
}
```

`HomePage`는 `app/ui/vinyl-shelf.tsx`에 있고, 공통 `<html>` 골격은 `app/ui/document.tsx`의
`Document` 컴포넌트가 감싼다. `Document`의 `<body>` 끝에 있는 `<script>` 한 줄이 뒤에서 다룰
브라우저 runtime을 로드한다.

## 6. 첫 form action 만들기

form 제출은 브라우저 이벤트이기 전에 **HTTP POST 요청**이다. `<form method="post">`는
JavaScript가 한 줄도 없어도 서버로 요청을 보낸다. 그래서 Remix에서는 서버 쪽 처리 경로를
먼저 완성하고, 브라우저 상호작용은 나중에 얹는다.

POST를 처리하는 action의 뼈대는 항상 같다.

1. `FormData`를 읽는다.
2. **boundary에서 검증한다.** boundary는 바깥 세상의 값(form 입력, URL, cookie)이 앱 내부로
   들어오는 경계를 말한다. 사용자가 보낸 값은 전부 문자열이고 무엇이든 들어 있을 수 있으니,
   이 경계에서 한 번 검증해 타입이 확정된 값으로 바꾼다. 경계 안쪽 코드는 검증을 다시 하지
   않고 타입을 신뢰한다.
3. 실패하면 입력값과 에러를 담아 form 페이지를 status 400으로 다시 렌더링한다. 사용자가
   쓰던 값이 사라지지 않는다.
4. 성공하면 저장 후 결과 페이지로 `303 See Other` redirect를 반환한다. POST 응답으로 페이지를
   직접 그리지 않고 GET으로 이동시키면, 사용자가 새로고침해도 form이 다시 제출되지 않는다
   (PRG, Post/Redirect/Get 패턴).

### vinyl-shelf에서는

`/albums` 페이지의 앨범 추가 form이 이 뼈대 그대로다. `app/actions/controller.tsx`:

```tsx
async albumsAction(context) {
  let formData = await context.request.formData()
  let result = validateCreateAlbum(formData)

  if (!result.ok) {
    return context.render(
      <AlbumsPage albums={listAlbums()} errors={result.errors} values={result.values} />,
      { status: 400 },
    )
  }

  let album = createAlbum(result.value)
  return redirect(routes.album.href({ slug: album.slug }), 303)
}
```

검증은 `app/data/validation.ts`의 `validateCreateAlbum`이 맡는다. 지금은 손으로 쓴 검증
함수이고, Remix 내장 검증 라이브러리(`remix/data-schema`)로 바꾸는 것은 Data and Validation
챕터에서 한다. `/albums`에서 필수 입력을 비우고 제출해 보자 — 400 응답인데도 쓰던 값이
그대로 남아 있는 것이 3번(입력값과 에러를 담아 다시 렌더링)의 결과다.

## 7. 첫 hydrated component 추가하기

여기까지의 코드는 전부 서버에서 실행됐다. 컴포넌트도 서버에서 HTML로 렌더링되어 브라우저로
전송될 뿐이다. 버튼 클릭에 반응하는 것처럼 브라우저 안에서 벌어지는 상호작용이 필요해지면,
그때 hydration이 등장한다.

**hydration**은 서버가 만들어 보낸 HTML에 브라우저에서 JavaScript를 붙여, 이미 화면에 있는
요소가 상호작용에 반응하게 만드는 일이다. Remix에서는 컴포넌트를 `clientEntry(...)`로 감싸는
것이 시작점이고, 그 뒤로 이런 일이 순서대로 일어난다.

1. **서버 렌더링** — `clientEntry` 컴포넌트도 다른 컴포넌트처럼 HTML로 렌더링된다. 다만
   Remix가 그 출력 앞뒤에 주석 marker를 남기고, props를 `<script type="application/json">`
   태그로 직렬화해 함께 심는다.
2. **모듈 URL 결정** — `clientEntry`의 첫 인자 `import.meta.url`은 그 소스 파일 자신의
   경로다. 서버 렌더링 중에 `app/middleware/render.tsx`의 `resolveClientEntry`가 이 파일
   경로를 브라우저가 내려받을 수 있는 `/assets/...` URL로 바꾼다. bundler 없이 소스 파일을
   그대로 serve하는 방식이고, 무엇을 serve할지는 `app/assets.ts`가 정한다.
3. **브라우저 runtime 시작** — HTML이 도착하면 `<body>` 끝의 script가 `app/assets/entry.ts`를
   로드한다. 이 파일의 `run()`이 문서를 스캔해 1번의 marker들을 찾는다.
4. **hydrate** — marker마다 해당 모듈을 `import`하고, 심어져 있던 props로 컴포넌트 함수를
   다시 실행해 이미 있는 DOM에 연결한다. 이 시점부터 그 컴포넌트는 이벤트에 반응한다.
5. **업데이트** — 이벤트 핸들러가 setup 변수의 값을 바꾸고 `handle.update()`를 호출하면,
   서버에 다녀오지 않고 그 컴포넌트만 다시 렌더링된다.

이 구조에서 나오는 제약이 하나 있다. props가 1번 단계에서 JSON으로 HTML에 심겨 브라우저로
전달되므로, **직렬화 가능한 값만 넘길 수 있다.** 문자열·숫자·boolean·plain object·배열은 되고, 함수나
클래스 인스턴스는 안 된다.

페이지 전체가 아니라 필요한 컴포넌트만 hydrate한다는 점도 중요하다. 나머지 화면은 계속
서버가 만든 HTML 그대로다.

### vinyl-shelf에서는

홈 화면의 앨범 preview 버튼(`app/assets/album-preview.tsx`)이 hydrated component다.

```tsx
export const AlbumPreview = clientEntry(
  import.meta.url,
  function AlbumPreview(handle: Handle<AlbumPreviewProps>) {
    let spins = 0                       // setup 변수 = local state

    return () => (
      <button
        type="button"
        mix={on('click', () => {
          spins++
          handle.update()               // 이 컴포넌트만 다시 렌더링
        })}
      >
        ...
      </button>
    )
  },
)
```

클릭할 때마다 `spins`가 늘고 디스크가 회전한다. props로는 `title`, `artist`, `year` 같은
직렬화 가능한 값만 받는다. 서버 요청 없이 화면이 바뀌는 것을 dev tools의 Network 탭으로
확인해 보면 hydration의 의미가 분명해진다.

form 제출 중 버튼을 "Saving…"으로 바꾸는 pending 상태도 같은 원리로 만들 수 있는데, 이는
Interactivity 챕터의 실습으로 남겨 두었다.

## 정독 후 확인 질문

1. `<form method="post">`가 JavaScript 없이 동작하는 이유를 요청 흐름으로 설명할 수 있는가?
2. 검증 실패에 400 렌더링, 성공에 303 redirect를 쓰는 이유를 각각 말할 수 있는가?
3. `clientEntry` 컴포넌트의 props에 함수를 넘길 수 없는 이유를 hydration 과정으로 설명할 수
   있는가?
4. 브라우저가 HTML을 받은 뒤 `AlbumPreview`가 클릭에 반응하기까지 무슨 일이 순서대로
   일어나는가?
5. URL이 필요한 모든 자리에서 `routes.*.href()`를 쓰면 무엇이 좋아지는가?

## 스터디 과제

**앨범 삭제 기능을 추가한다.**

1. `app/routes.ts`에 `POST /albums/:slug/delete` route를 정의한다.
2. 앨범 상세 페이지에 삭제 form(`<form method="post">`)을 추가한다. URL은 반드시
   `routes.*.href()`로 만든다.
3. action에서 앨범을 삭제하고 `/albums`로 303 redirect한다. 없는 slug면 404를 반환한다.
4. `app/actions/controller.test.ts`에 삭제 성공(303)과 실패(404) 테스트를 하나씩 추가한다.

브라우저 JavaScript 없이 동작해야 한다. 다 만들었으면 dev tools Network 탭에서 POST → 303 →
GET 흐름을 확인하자.
