# Request Handling 원문 한국어 번역

원문: [Request Handling | Remix Docs](https://guides.remix.run/request-handling/)
라이선스: Remix Docs 페이지 하단의 “docs and examples licensed under MIT” 표기를 기준으로 번역 및 정리했다.

프로젝트 적용 실습은 [`practice-guide.ko.md`](./practice-guide.ko.md)에서 다룬다.

## Request Handling

앞 장인 Routing and Controllers는 Remix가 route를 찾은 뒤 어떤 일이 일어나는지 다뤘다. 이번 장은
그보다 앞선 server boundary로 돌아간다. Runtime이 앱에 Web `Request`를 넘기는 방식, middleware가
request context를 준비하는 방식, 그리고 최종 Web `Response`가 client로 돌아가는 방식을 살펴본다.

Runtime-specific code는 server entry에 머문다. 그 밖의 router, middleware, actions는 어디서나 같은
Fetch API contract 위에서 동작한다.

## The Web Request/Response contract

Remix router는 fetch handler다. `fetch()` method는 URL 또는 Web `Request`를 받고 Web `Response`로
resolve한다.

```ts
let request = new Request("https://albums.example/albums/thriller", {
  method: "GET",
  headers: { Accept: "text/html" },
});

let response = await router.fetch(request);

console.log(response.status);
console.log(response.headers.get("Content-Type"));
```

이 호출은 Node server, Bun server, Cloudflare Worker, test 어디에서 와도 같다. Runtime adapter는
route를 정의하거나 page rendering을 알지 않는다. 필요할 때 native server API를 `Request`와
`Response`로 연결하는 bridge 역할만 한다.

`router.fetch(...)`가 호출될 때 Remix는 다음 흐름을 실행한다.

1. 들어온 `Request`에서 request context를 만든다.
2. router middleware를 실행한다.
3. `context.method`와 `context.url`을 등록된 routes와 매칭한다.
4. 매칭된 route의 controller middleware와 action middleware를 실행한다.
5. action을 호출하고 `Response`를 받는다.
6. middleware chain을 되감으며 최종 response로 `router.fetch(...)`를 resolve한다.

매칭되는 route가 없으면 router는 `404` response를 반환한다. Middleware나 action이 throw하면
`router.fetch(...)`는 reject된다. Server entry는 그 error를 catch해서 `500` response로 바꿀 수
있는 마지막 경계다.

Request와 response body는 Web stream으로 유지된다. Action은 `request.body`를 읽고,
`ReadableStream`으로 backed된 `Response`를 반환하고, `request.signal`을 통해 cancellation에 반응할 수
있다. 이때 runtime-specific request object로 내려갈 필요가 없다.

## The Node server entry

기본 Remix 앱은 `node:http` 위에서 실행된다. `server.ts`는 Node server를 만들고 앱 router에
연결한다. 생성된 파일은 graceful shutdown도 처리하지만, request path를 보기 위해 핵심 부분만 보면
다음과 같다.

```ts
import * as http from "node:http";
import { createRequestListener } from "remix/node-fetch-server";

import { router } from "./app/router.ts";

const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 44100;

const server = http.createServer(
  createRequestListener(async (request) => {
    try {
      return await router.fetch(request);
    } catch (error) {
      if (!(request.signal.aborted && error === request.signal.reason)) {
        console.error(error);
      }
      return new Response("Internal Server Error", { status: 500 });
    }
  }),
);

server.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
```

`createRequestListener(...)`가 Node request를 Web `Request`로 바꾸고, handler가 돌려준 Web
`Response`를 Node response로 다시 쓴다. App code는 `IncomingMessage`나 `ServerResponse`를 직접 만지지
않는다.

Server entry는 uncaught error boundary이기도 하다. 예상 가능한 route 결과는 action에서 명시적인
`Response`로 반환하고, 예상하지 못한 throw만 여기에서 `500`으로 바꾼다.

## createRequestListener

`createRequestListener`는 Node의 `http`, `https`, `http2` server와 함께 사용할 수 있다. 이 helper는
Node stream, headers, method, URL, abort signal을 Web Fetch API shape로 맞춘다.

Node server에서는 이 adapter가 필요하지만, Cloudflare Worker 같은 Fetch-native runtime에서는
별도 adapter 없이 바로 `router.fetch(request)`를 호출할 수 있다.

```ts
export default {
  fetch(request: Request) {
    return router.fetch(request);
  },
};
```

핵심은 runtime bridge가 server entry에만 있어야 한다는 점이다. Actions와 middleware는 Web API
contract를 기준으로 작성한다.

## Alternate runtimes: Bun, Deno, Workers

Remix router는 Fetch API contract만 요구하므로 runtime이 Fetch handler를 직접 제공한다면 같은 router를
그대로 사용할 수 있다.

- Node: `createRequestListener(...)`로 Node request/response를 Fetch API로 bridge한다.
- Bun: server의 `fetch(request)` handler에서 `router.fetch(request)`를 반환한다.
- Deno: `Deno.serve((request) => router.fetch(request))`처럼 연결할 수 있다.
- Workers: exported `fetch(request)`에서 router를 호출한다.

Runtime마다 server bootstrap code는 다르지만, `app/router.ts`, middleware, controllers는 같은
`Request`/`Response` 계약을 유지한다.

## Middleware ordering

Middleware는 request lifecycle에서 action 전후에 실행된다. 순서가 중요하다. 빠르게 종료할 수 있는
middleware는 앞에 두고, request context를 풍부하게 만드는 middleware는 그 뒤에 둔다.

일반적인 순서는 다음과 같다.

```ts
export const router = createRouter({
  middleware: [
    logger(),
    compression(),
    staticFiles("./public", { index: false }),
    formData(),
    methodOverride(),
    render(),
  ],
});
```

`staticFiles()`는 `public/` 아래 파일을 그대로 서빙하고, 매칭되면 action까지 가지 않고 response를
반환할 수 있다. `formData()`는 browser form body를 한 번 parsing해 `context.formData`나
`context.get(FormData)`로 제공한다. `methodOverride()`는 `_method` field를 읽어
`context.method`를 `PUT`, `PATCH`, `DELETE` 등으로 바꾼다. 따라서 `methodOverride()`는 반드시
`formData()` 뒤에 와야 한다.

Middleware가 `next()`를 호출하면 다음 middleware 또는 action으로 진행한다. `next()` 이후에는
downstream response를 받아 headers를 추가하거나 body를 감싸는 후처리를 할 수 있다.

## Typed request context

Request context는 action과 middleware가 공유하는 request-scoped object다. 기본으로는 `request`,
`url`, `method`, `params`, `headers`, `set`, `get`, `has`, `router` 같은 값이 있다.

Middleware는 context에 typed value를 추가할 수 있다.

```ts
import { createContextKey, type Middleware } from "remix/router";

export const RequestId = createContextKey<string>();

export function requestId(): Middleware<{
  key: typeof RequestId;
  value: string;
  property: "requestId";
}> {
  return async (context, next) => {
    let id = crypto.randomUUID();
    context.set(RequestId, id, { property: "requestId" });
    return next();
  };
}
```

Router가 middleware tuple에서 context type을 추론하면 downstream controller는
`context.get(RequestId)` 또는 `context.requestId`를 typed value로 읽을 수 있다.

```ts
export const router = createRouter({
  middleware: [requestId(), render()],
});

type AppContext = RouterContext<typeof router>;
```

앱 전체 context type은 `RouterContext<typeof router>`로 뽑아 `RouterTypes.context`에 module
augmentation하면 stored controllers도 같은 context contract를 사용한다.

## Common middleware: form-data, render, static files, compression, logging, method override

Remix는 자주 쓰는 request lifecycle concern을 middleware로 제공한다.

| Middleware | 역할 |
| --- | --- |
| `staticFiles()` | `public/` 같은 directory의 파일을 그대로 서빙 |
| `formData()` | form body를 parsing해 `context.formData` 제공 |
| `methodOverride()` | form field로 `PUT`, `PATCH`, `DELETE` 같은 method를 흉내냄 |
| `render()` | app에서 정의한 render middleware로 JSX를 HTML `Response`로 변환 |
| `compression()` | text-like response 압축 |
| `logger()` | request/response 로그 |

Global middleware는 대부분의 route가 그 기능을 사용할 때 편하다. 특정 action 하나만 form이나 upload를
받는다면 action middleware에 `formData()`를 두어 다른 request의 body parsing을 피할 수 있다.

`staticFiles()`와 `remix/assets`는 다르다. `staticFiles()`는 이미 존재하는 파일을 그대로 서빙한다.
`.browser.ts`와 `.browser.tsx` source에서 browser module을 만들고 import rewriting, preload,
fingerprinted URL을 제공하는 pipeline은 `remix/assets`가 담당한다.

## Custom middleware

Custom middleware는 `(context, next)`를 받는 함수다. Request-scoped value를 제공한다면 context key를
사용한다.

아래 middleware는 action이 실행되기 전에 request id를 만들고, response가 돌아오는 길에 같은 값을
header에 추가한다.

```ts
import { createContextKey, type Middleware } from "remix/router";

export const RequestId = createContextKey<string>();

export function requestId(): Middleware<{
  key: typeof RequestId;
  value: string;
  property: "requestId";
}> {
  return async (context, next) => {
    let id = crypto.randomUUID();
    context.set(RequestId, id, { property: "requestId" });

    let response = await next();
    let headers = new Headers(response.headers);
    headers.set("X-Request-Id", id);

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
}
```

Request를 거부하는 middleware는 `next()`를 호출하지 않고 response를 직접 반환한다.

```ts
function requireJson(): Middleware {
  return (context, next) => {
    let mediaType = context.headers.get("Content-Type")?.split(";", 1)[0]?.trim().toLowerCase();
    if (mediaType !== "application/json") {
      return new Response("Expected JSON", { status: 415 });
    }
    return next();
  };
}
```

Custom middleware는 하나의 request lifecycle concern에 집중하는 편이 좋다. Route-specific data loading
또는 validation은 보통 action에 두고, request IDs, sessions, authentication, security headers,
database access처럼 여러 route에 걸친 concern은 middleware pipeline에 둔다.
