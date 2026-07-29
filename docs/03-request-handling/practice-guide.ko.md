# Request Handling

원문: [Request Handling | Remix Docs](https://guides.remix.run/request-handling/) ·
전문 번역: [`original-translation.ko.md`](./original-translation.ko.md)

이 문서 하나로 챕터의 개념을 익히고, `vinyl-shelf` 프로젝트 코드로 실습한다. 각 절은 먼저
개념을 설명하고, **vinyl-shelf에서는** 단락에서 이 프로젝트의 실제 코드와 연결한다.

이 문서의 코드와 파일 경로는 `curriculum 03: Request Handling` 커밋 시점 기준이다.

2장이 route 매칭 이후를 다뤘다면, 이번 장은 그보다 앞으로 돌아간다. runtime이 앱에
`Request`를 건네는 방식, middleware가 action 전후에 하는 일, 그리고 `Response`가 client로
돌아가는 길을 따라간다.

## 1. Web Request/Response 계약

Remix router는 fetch handler다 — URL이나 `Request`를 받아 `Response`로 resolve하는
`fetch()` method를 가진 객체라는 뜻이다.

```ts
let response = await router.fetch(new Request("https://albums.example/albums/thriller"))
```

이 호출은 어디서 오든 같다. Node 서버에서 오든, Cloudflare Worker에서 오든, 테스트에서
직접 부르든 router는 구분하지 않는다. `router.fetch(...)`가 불리면 안에서 이 순서로
진행된다.

1. 들어온 `Request`에서 request context를 만든다.
2. router middleware를 실행한다.
3. `context.method`와 `context.url`을 등록된 route들과 매칭한다.
4. 매칭된 route의 controller middleware와 action middleware를 실행한다.
5. action을 호출해 `Response`를 받는다.
6. middleware chain을 되감으며 최종 `Response`로 resolve한다.

매칭되는 route가 없으면 404를 반환한다. middleware나 action이 throw하면
`router.fetch(...)` 자체가 reject된다 — 이걸 받아서 500으로 바꾸는 것은 다음 절의 server
entry 몫이다.

request와 response의 body는 Web stream으로 유지된다. action은 `request.body`를 stream으로
읽을 수 있고, stream을 body로 가진 `Response`를 반환할 수 있고, 사용자가 요청을 끊으면
`request.signal`로 알 수 있다. runtime 고유의 객체로 내려갈 일이 없다.

### vinyl-shelf에서는

이 계약 덕분에 테스트가 HTTP 서버 없이 돈다. `app/actions/controller.test.ts`는 서버를
띄우지 않고 router를 직접 부른다.

```ts
let response = await router.fetch(request(routes.albums.index.href()))
```

`corepack pnpm test`가 빠른 이유가 이것이다 — 포트도, 프로세스도, 네트워크도 없다.

## 2. Node server entry

`server.ts`는 Node runtime과 router 사이의 다리다. 핵심만 보면 이렇다.

```ts
const server = http.createServer(
  createRequestListener(async (request) => {
    try {
      return await router.fetch(request)
    } catch (error) {
      if (!(request.signal.aborted && error === request.signal.reason)) {
        console.error(error)
      }
      return new Response('Internal Server Error', { status: 500 })
    }
  }),
)
```

`createRequestListener(...)`가 Node의 요청 객체를 Web `Request`로 바꾸고, handler가 돌려준
Web `Response`를 Node 응답으로 다시 써 준다. 앱 코드는 Node의 `IncomingMessage` 같은 것을
만지지 않는다. Node의 `http` 말고 `https`, `http2` 서버에도 같은 helper를 쓸 수 있다.

여기의 `try/catch`가 2장에서 말한 에러 원칙의 나머지 반쪽이다. 예상 가능한 결과는 action이
`Response`로 반환하니 여기까지 오지 않고, 여기 도달한 throw는 전부 "예상 밖 실패"라서
로그를 남기고 500으로 바꾼다. server entry가 마지막 방어선이다. (조건문은 사용자가 요청을
끊어서 생긴 중단까지 에러로 기록하지 않으려는 것이다.)

### vinyl-shelf에서는

`server.ts`가 위 코드 그대로다. 1장에서 "거의 건드릴 일 없는 파일"이라고만 했는데, 이제
각 줄의 이유를 설명할 수 있다. 파일 아래쪽의 `SIGINT`/`SIGTERM` 처리는 종료 신호를 받으면
받던 요청을 마치고 내려가는 graceful shutdown이다.

## 3. Runtime을 바꿔도 router는 그대로

router가 요구하는 것은 Fetch API 계약뿐이라서, runtime이 fetch handler를 직접 받는
환경이라면 adapter조차 필요 없다.

```ts
// Cloudflare Workers — adapter 없이 그대로
export default {
  fetch(request: Request) {
    return router.fetch(request)
  },
}
```

- **Node** — `createRequestListener(...)`로 bridge (위 2절)
- **Bun** — 서버의 `fetch(request)` handler에서 `router.fetch(request)` 반환
- **Deno** — `Deno.serve((request) => router.fetch(request))`
- **Workers** — export한 `fetch(request)`에서 router 호출

원칙은 하나다. **runtime 고유 코드는 server entry에만 있어야 한다.** `app/` 아래의 router,
middleware, controller는 전부 Web API 기준으로 쓰고, runtime을 바꾸는 일은 `server.ts` 한
파일을 바꾸는 일이 된다.

## 4. Middleware 순서

middleware는 action 전후에 실행되는 함수 사슬이고, 배열에 적은 순서가 실행 순서다. 원칙은
두 가지다 — **빨리 끝낼 수 있는 것을 앞에, context를 채우는 것을 그 뒤에.**

```ts
middleware: [logger(), compression(), staticFiles(...), formData(), methodOverride(), render()]
```

각 middleware는 `next()`를 호출해 다음 단계(다음 middleware 또는 action)로 진행시키고,
`next()`가 돌려준 response에 후처리를 할 수도 있다. `next()`를 부르지 않고 response를 직접
반환하면 뒤 단계는 아예 실행되지 않는다 — `staticFiles()`가 정적 파일을 찾았을 때 그렇게
빠져나간다.

자주 쓰는 built-in은 다음과 같다.

| Middleware | 역할 |
| --- | --- |
| `staticFiles()` | `public/` 같은 디렉터리의 파일을 그대로 서빙, 찾으면 조기 반환 |
| `formData()` | form body를 한 번 파싱해 `context.formData` 제공 |
| `methodOverride()` | form의 `_method` field로 PUT/PATCH/DELETE를 흉내 |
| `render()` | `context.render(...)` 제공 (앱이 정의하는 render middleware) |
| `compression()` | 텍스트 계열 response 압축 |
| `logger()` | 요청/응답 로그 |

순서 의존이 하나 있다. `methodOverride()`는 `_method` 값을 읽어야 하므로 **반드시
`formData()` 뒤**에 와야 한다. 그리고 `staticFiles()`는 이미 있는 파일을 서빙할 뿐이고,
소스에서 브라우저 모듈을 만들어 주는 것은 별개의 `remix/assets`라는 점도 구분해 두자.

middleware를 router에 두는 것이 항상 정답은 아니다. 대부분의 route가 쓰면 router에, 특정
action 하나만 쓰면 그 action의 `{ middleware, handler }`에 두어 다른 요청의 불필요한
작업을 피한다(2장 3절).

### vinyl-shelf에서는

`app/router.ts`의 스택은 다섯 개다.

```ts
middleware: [
  staticFiles('./public', { index: false }),
  requestId(),
  formData(),
  methodOverride(),
  render(),
],
```

순서를 읽어 보면 — 정적 파일이면 즉시 반환(1), 이후 모든 응답에 request id를 붙임(2),
form body를 한 번 파싱(3), `_method`를 읽어 method 교체(4), action에게 `context.render`
제공(5). `formData()`가 생기면서 1·2장에서 action마다 하던
`await context.request.formData()`가 사라지고 `context.formData`를 바로 쓴다.

```tsx
create(context) {
  let result = validateCreateAlbum(context.formData)
  ...
}
```

파싱 위치가 pipeline에 한 번만 명시되고, upload 제한 같은 설정도 나중에 이 한 곳에 두면
된다.

## 5. Typed request context

request context는 한 요청을 처리하는 동안 middleware와 action이 공유하는 객체다. 기본
구성(`request`, `url`, `method`, `params`, `headers`, `set/get/has`, `router`)은 2장에서
봤고, 이번 장의 내용은 **middleware가 여기에 타입이 잡힌 값을 추가하는 방법**이다.

재료는 두 가지다. `createContextKey<T>()`로 값의 열쇠를 만들고, middleware의 타입 선언에
그 key·value·property 이름을 적으면, downstream에서 `context.get(Key)`뿐 아니라
`context.requestId` 같은 property로도 읽을 수 있다.

```ts
export const RequestId = createContextKey<string>()

export function requestId(): Middleware<{
  key: typeof RequestId
  value: string
  property: 'requestId'
}> {
  return async (context, next) => {
    context.set(RequestId, crypto.randomUUID(), { property: 'requestId' })
    return next()
  }
}
```

이 타입이 앱 전체에 퍼지게 하는 장치가 `RouterContext`다. router의 middleware 배열에서
전체 context 타입을 추론해 뽑고, 그것을 module augmentation(내 앱의 타입을 라이브러리의
타입 선언에 끼워 넣는 TypeScript 기법)으로 `remix/router`에 등록한다.

```ts
type AppContext = RouterContext<typeof router>

declare module 'remix/router' {
  interface RouterTypes {
    context: AppContext
  }
}
```

이 등록 덕분에 별도 파일로 분리된 controller들도 `context.render`, `context.formData`,
`context.requestId`를 타입 안전하게 읽는다.

### vinyl-shelf에서는

`app/middleware/request-id.ts`가 위 패턴의 완성형이다. `next()` 앞뒤로 일하는 것까지
보여 준다.

```ts
return async (context, next) => {
  let id = context.headers.get('X-Request-Id')?.trim() || crypto.randomUUID()
  context.set(RequestId, id, { property: 'requestId' })   // action 실행 전

  let response = await next()                              // 여기서 action까지 실행됨
  let headers = new Headers(response.headers)
  headers.set('X-Request-Id', id)                          // 돌아오는 길에 header 추가

  return new Response(response.body, { headers, status: response.status, statusText: response.statusText })
}
```

들어올 때 id를 만들어 context에 넣고, 나갈 때 같은 id를 응답 header에 붙인다. 요청에
이미 `X-Request-Id`가 있으면 그 값을 이어받으므로, 프록시 같은 앞 단이 준 id로 로그를
꿰어 추적할 수 있다. `apiAlbums` action은 `context.requestId`를 JSON에 담아 반환하고,
테스트는 보낸 id가 context와 응답 header에 같은 값으로 나오는지 확인한다.

middleware를 추가했는데 controller에서 property가 안 보이면 두 가지를 확인한다 —
middleware가 router 배열 안에 직접 들어 있는가, 그리고 `RouterTypes.context` 등록이
`RouterContext<typeof router>`로 최신인가.

## 6. Custom middleware의 두 패턴

custom middleware는 `(context, next)`를 받는 함수일 뿐이고, 쓰임은 크게 두 갈래다.

**통과시키며 일하기** — `next()`를 부르고, 그 전에 context를 채우거나 그 후에 response를
다듬는다. 위의 `requestId()`가 이 패턴이다.

**거부하기** — 조건이 안 맞으면 `next()`를 부르지 않고 response를 직접 반환한다.

```ts
function requireJson(): Middleware {
  return (context, next) => {
    let mediaType = context.headers.get("Content-Type")?.split(";", 1)[0]?.trim().toLowerCase()
    if (mediaType !== "application/json") {
      return new Response("Expected JSON", { status: 415 })
    }
    return next()
  }
}
```

어디까지 middleware에 두는가의 기준: 여러 route에 걸치는 관심사 — request id, 세션, 인증,
보안 header, database 연결 — 는 middleware로, 특정 route의 데이터 로딩과 검증은 action에
둔다. 그리고 middleware 하나는 관심사 하나만 다루는 게 좋다.

### vinyl-shelf에서는

`methodOverride()`가 실제로 일하는 모습을 이 챕터에서 만들었다. HTML form은 GET과 POST만
보낼 수 있는데, route 계약은 삭제의 의미를 그대로 표현하고 싶다.

```ts
albums: {
  destroy: del('/albums/:slug'),
}
```

form은 POST로 보내되 hidden field로 의도를 적는다.

```tsx
<form method="post" action={routes.albums.destroy.href({ slug: album.slug })}>
  <input type="hidden" name="_method" value="DELETE" />
  <button type="submit">Delete album</button>
</form>
```

흐름: `formData()`가 body를 파싱하고 → `methodOverride()`가 `_method`를 읽어
`context.method`를 `DELETE`로 바꾸고 → router가 그 method로 `albums.destroy`에 매칭한다.
이때 `context.request.method`는 POST 그대로 남는다 — 바뀌는 것은 매칭에 쓰는
`context.method`뿐이다. destroy action은 지우고 목록으로 303, 없으면 404를 반환한다.

## 정독 후 확인 질문

1. `server.ts`와 `app/router.ts`의 책임은 어떻게 다른가? runtime을 Bun으로 바꾸면 어느
   파일이 바뀌는가?
2. `methodOverride()`가 `formData()` 뒤에 있어야 하는 이유는 무엇인가?
3. `requestId()`에서 `next()` 호출 전과 후에 각각 무슨 일을 하는가?
4. method override 이후 `context.method`와 `context.request.method`는 어떻게 달라지는가?
5. 없는 앨범(404)은 왜 server entry의 catch가 아니라 controller에서 처리하는가?
6. middleware가 `next()`를 부르지 않고 response를 반환하면 무슨 일이 일어나는가? 이걸
   이용하는 built-in middleware는 무엇인가?

## 스터디 과제

**응답 시간을 재는 `serverTiming()` middleware를 만든다.**

1. `app/middleware/server-timing.ts`에 custom middleware를 만든다. `next()` 전에 시각을
   기록하고, 돌아온 response에 `X-Response-Time: {ms}ms` header를 붙인다.
2. router의 middleware 배열에서 위치를 직접 정한다. 정적 파일 응답도 측정할지, 앱 응답만
   측정할지에 따라 답이 달라진다 — 자기가 고른 위치의 이유를 설명할 수 있어야 한다.
3. HTML 페이지와 JSON API 응답 모두에 header가 붙는지 테스트를 추가한다.
4. (심화) 측정한 값을 typed context property `context.startedAt`으로도 노출해 보고, 그러려면
   무엇이 더 필요한지 5절의 패턴과 비교한다.

다 만들었으면 브라우저 Network 탭에서 아무 페이지나 열어 header를 확인하자.
