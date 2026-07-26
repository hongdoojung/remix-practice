# Routing and Controllers 원문 한국어 번역

원문: [Routing and Controllers | Remix Docs](https://guides.remix.run/routing-and-controllers/)
라이선스: Remix Docs 페이지 하단의 “docs and examples licensed under MIT” 표기를 기준으로 번역 및 정리했다.

프로젝트 적용 실습은 [`practice-guide.ko.md`](./practice-guide.ko.md)에서 다룬다.

## Routing and Controllers

1장에서 우리는 end-to-end request flow를 하나 만들었다. Web `Request`가 들어오고, Remix가
route를 매칭하고, controller가 action을 실행하고, 앱은 Remix component에서 렌더링된 HTML을 담은
Web `Response`를 반환했다.

Full-stack Remix 앱은 이 route/controller 경계를 중심으로 만들어진다. `app/routes.ts`는 앱이
받아들이는 URL과 method에 이름을 붙이고, `app/actions/`의 controller는 그것들을 구현한다. 각
action은 browser가 받는 page, redirect, JSON payload, file, error가 될 response를 반환한다.

## Routes as the URL contract

Remix에서 route는 매칭된 request를 처리하는 action과 분리해서 정의한다. 이 분리 덕분에 server
code와 browser module은 controller를 browser로 끌어들이지 않고도 typed URL helper를 공유할 수
있다. 앱이 받아들이는 URL과 method는 `app/routes.ts`에서 정의한다.

작은 record store의 route map은 다음처럼 생길 수 있다.

```ts
import { route } from "remix/routes";

export const routes = route({
  home: "/",
  albums: {
    show: { method: "GET", pattern: "/albums/:albumId" },
    edit: {
      index: { method: "GET", pattern: "/albums/:albumId/edit" },
      action: { method: "POST", pattern: "/albums/:albumId/edit" },
    },
  },
});
```

`route(...)`는 입력한 객체와 같은 nested shape를 가진 typed route map을 반환한다.
`routes.albums.show` 같은 leaf는 method, pattern, `href(...)` helper를 가진 route다.
`routes.albums`나 `routes.albums.edit` 같은 branch는 또 다른 route map이다.

Router는 leaf를 사용해 request를 매칭하고, 앱의 나머지 코드는 같은 leaf로 typed URL을 만든다.

```ts
routes.albums.show.href({ albumId: "thriller" });
// /albums/thriller
```

`show` route의 `href(...)` helper는 `albumId` property를 요구한다. route pattern의
`:albumId`가 path variable이기 때문이다. path variable은 segment 안에서 매칭되고 controller
안에서는 `context.params`의 property가 된다. 나중에 pattern을 `"/albums/:id"`로 바꾸면 여전히
`{ albumId: ... }`를 넘기는 오래된 호출은 TypeScript 오류로 드러난다.

같은 `routes` 객체를 controller와 browser module에서 import해 link, form, redirect, test에
사용할 수 있다. URL 변경이 앱 곳곳의 string literal에 숨어 있지 않다.

Path variable은 Remix route pattern syntax의 일부다. Pattern은 wildcard, optional group, search
constraint, escaped literal, hostname variable, full origin, specificity rule도 표현할 수 있다.

```ts
"/docs(/v:version)/:category/*slug.:format?preview";
// /docs/v2/guides/routing/route-maps.html?preview=1 와 매칭될 수 있다.
```

이 가이드를 따라가기 위해 route pattern syntax를 모두 외울 필요는 없다. 전체 grammar와 더 낮은
수준의 `remix/route-pattern/href`, `remix/route-pattern/match` API는 route-pattern 문서에서 다룬다.

마지막으로 `edit` branch는 같은 URL에 두 leaf를 가진다. `index`는 `GET`을 처리하고 `action`은
`POST`를 처리한다.

```ts
routes.albums.edit.index.href({ albumId: "thriller" }); // GET /albums/thriller/edit
routes.albums.edit.action.href({ albumId: "thriller" }); // POST /albums/thriller/edit
```

Leaf와 nested map의 차이는 controller를 mapping하기 시작하면 중요해진다.

## Route builders: route, get, post, put, del, form, resources

Route helper는 `{ method, pattern }` 객체 대신 route의 HTTP method나 관례적인 형태를 이름 붙인
호출로 표현한다. 각 helper는 앞에서 본 것과 같은 route leaf와 route map을 만든다.

```ts
import { del, get, post, route } from "remix/routes";

export const routes = route({
  home: get("/"),
  albums: {
    show: get("/albums/:albumId"),
    create: post("/albums"),
    destroy: del("/albums/:albumId"),
  },
});
```

Helper가 담당하는 일은 다음과 같다.

| Helper | 목적 |
| --- | --- |
| `get`, `post`, `put`, `patch`, `del`, `head`, `options` | 하나의 HTTP method로 좁혀진 route leaf |
| `form(pattern)` | 같은 URL에 있는 `GET` page와 `POST` action |
| `route(prefix, defs)` | 공통 prefix 아래의 nested route map |
| `resources(pattern)` | collection에 대한 관례적 routes |
| `resource(pattern)` | singleton resource에 대한 관례적 routes |

Route는 string만으로도 정의할 수 있다. 예를 들어 `webhook: "/webhooks/github"`는 모든 request
method와 매칭되므로, method가 중요하다면 action 안에서 `context.method`를 확인해야 한다.

Route area를 따로 소유하는 편이 좋다면 `route(prefix, routes)`로 공통 prefix 아래에 route map을
합성할 수 있다. Route area는 자기 이름과 상대 pattern을 소유하고, 앱은 그 group이 어디에 놓일지
결정한다.

```ts
// app/actions/albums/routes.ts
import { get, route } from "remix/routes";

export const albumRoutes = route({
  index: get("/"),
  show: get("/:albumId"),
});
```

```ts
// app/routes.ts
import { route } from "remix/routes";

import { albumRoutes } from "./actions/albums/routes.ts";

export const routes = route({
  albums: route("/albums", albumRoutes),
});

// routes.albums.index -> GET /albums
// routes.albums.show  -> GET /albums/:albumId
```

`form(...)`은 같은 URL에 page와 submit action이 함께 있는 흔한 형태를 만든다.

```ts
import { form, route } from "remix/routes";

export const routes = route({
  albums: {
    edit: form("/albums/:albumId/edit"),
  },
});

// routes.albums.edit.index  -> GET  /albums/:albumId/edit
// routes.albums.edit.action -> POST /albums/:albumId/edit
```

Forms and Mutations 챕터는 이 route shape 위에 validation, redirect, progressive enhancement를
쌓아간다.

`resources(...)`는 collection을 위한 일곱 가지 관례적 route를 만든다. `index`, `new`, `show`,
`create`, `edit`, `update`, `destroy`가 그것이다. `resource(...)`는 singleton route를 만들고,
collection page가 없으므로 `index`는 생략한다.

`only`는 관례적 shape 중 일부만 남기고, `param`은 기본 path variable 이름인 `id`를 다른 이름으로
바꾼다.

```ts
import { resources, route } from "remix/routes";

export const routes = route({
  albums: resources("/albums", {
    only: ["index", "show", "create"],
    param: "albumId",
  }),
});

// routes.albums.index  -> GET  /albums
// routes.albums.show   -> GET  /albums/:albumId
// routes.albums.create -> POST /albums
```

이 helper들은 ordinary route map과 leaf를 만든다. 따라서 hand-written definition과 섞어 중첩할 수
있고, map을 `createController(...)`에 넘긴 뒤 `router.map(...)`으로 등록할 수 있다.

## Controllers and actions

Controller는 하나의 route map 안에 있는 direct leaf의 request handling을 소유한다. 해당 action들이
공유하는 middleware를 실행할 수 있고, `actions` 객체는 leaf마다 하나의 handler를 제공한다.
`createController(...)`는 route map을 사용해 action name과 params를 type으로 잡아주면서,
request-handling behavior를 route map 밖에 둔다.

`routes.albums`의 경우 controller는 `show` leaf를 소유한다.

```tsx
import { createController } from "remix/router";
import { routes } from "../../routes.ts";

export default createController(routes.albums, {
  actions: {
    show(context) {
      return new Response(`Album: ${context.params.albumId}`);
    },
  },
});
```

`show` action은 request context를 받고 Web `Response`를 반환한다. Route가
`get("/albums/:albumId")`로 정의되어 있으므로 route가 매칭되면 `context.params.albumId`는
`string`이다. Remix는 action 실행 전에 pattern을 매칭하므로 action은 URL을 직접 파싱하거나
`albumId`가 없는 경우를 방어할 필요가 없다.

모든 action은 다음 built-in request context property와 method를 받는다.

| Property or method | 제공하는 것 |
| --- | --- |
| `context.request` | 원본 Web `Request` |
| `context.url` | parsing된 `URL` |
| `context.method` | request method |
| `context.params` | 매칭된 route pattern에서 parsing된 typed value |
| `context.headers` | request headers의 mutable `Headers` copy |
| `context.router` | request를 처리 중인 router |
| `context.set(key, value)` | shared context에 request-scoped value 저장 |
| `context.get(key)` | context key 아래 저장된 request-scoped value 읽기 |
| `context.has(key)` | context key에 값이 저장되어 있는지 확인 |

Middleware는 `context.formData`나 `context.render`처럼 typed property로 base context를 확장할 수
있다. 이런 property는 앱의 middleware stack에 따라 달라지므로 고정 목록이 아니다.

Built-in `methodOverride()` middleware는 의도적으로 base value 하나를 바꾼다. `_method` field가 있는
`POST` form이 `PUT`, `PATCH`, `DELETE` route를 target할 수 있도록 route matching 전에
`context.method`를 업데이트한다. `context.request.method`는 원래 method로 남는다.

Controller는 자신이 소유한 모든 action에 적용되는 middleware를 가질 수 있다. Middleware가 특정
route에만 필요하다면 해당 action을 `middleware`와 `handler`를 가진 object로 정의한다. 아래 예제는
`POST` action만 `FormData`를 parsing하고, `index` page는 그 작업을 건너뛴다.

```tsx
import { formData } from "remix/middleware/form-data";
import { createController } from "remix/router";

import { routes } from "../../../routes.ts";

export default createController(routes.albums.edit, {
  actions: {
    index() {
      return new Response("Edit album");
    },
    action: {
      middleware: [formData()],
      handler(context) {
        let title = String(context.formData.get("title") ?? "");
        return new Response(`Updated ${title}`, { status: 200 });
      },
    },
  },
});
```

Middleware 실행 순서는 router middleware, controller middleware, action middleware, action handler다.
Middleware scope와 typed context는 Request Handling 챕터에서 더 깊게 다룬다.

## Responses, redirects, headers, and errors

Action은 Web `Response` 객체를 반환한다. Page를 렌더링하려면 보통 render middleware를 설정하고
router에 추가한다. 그 middleware는 `context.render(...)`를 제공하며, Remix component tree를 HTML
response로 바꾼다.

```tsx
// show action 안에서
return context.render(<AlbumPage album={album} />);
```

결과는 여전히 ordinary Web `Response`다. Action은 page를 렌더링할 수도 있고, text나 JSON을
반환할 수도 있으며, browser를 redirect하거나 file을 보내거나 error response를 반환할 수도 있다.

Invalid input, conflict, missing record처럼 예상 가능한 결과도 적절한 status를 가진 `Response`로
반환해야 한다. 예상하지 못한 실패에만 thrown error를 남겨둔다. Action이나 middleware가 throw하면
`router.fetch(...)`는 reject되고, server boundary가 error를 log한 뒤 `500` response를 반환할 수
있다.

Text response는 다음처럼 단순할 수 있다.

```ts
return new Response("Album not found", { status: 404 });
```

`redirect(...)`는 redirect response를 만든다. Edit action에서는 POST-redirect-GET 흐름을 위해
`303 See Other`를 사용할 수 있다.

```tsx
import { redirect } from "remix/response/redirect";

import { routes } from "../../../routes.ts";

return redirect(routes.albums.show.href({ albumId: context.params.albumId }), 303);
```

Remix UI render pipeline 밖에서 HTML을 만들 때는 `html` template tag로 보간 값을 escape하고,
`createHtmlResponse(...)`로 HTML content type과 doctype을 설정할 수 있다.

```ts
import { html } from "remix/html-template";
import { createHtmlResponse } from "remix/response/html";

return createHtmlResponse(html`<p>${album.title}</p>`);
```

Remix의 `redirect(...)`, `createHtmlResponse(...)`와 표준 `new Response(...)`,
`Response.json(...)`은 status나 headers를 설정해야 할 때 standard `ResponseInit`을 받는다.
`redirect(...)`는 숫자 `303` shorthand도 지원한다.

```ts
return Response.json(album, {
  headers: {
    "Cache-Control": "no-store",
  },
});
```

주의할 점은 `context.headers`가 response로 보낼 header가 아니라 request header를 나타낸다는 것이다.
Controller에는 별도의 response-header API가 없다. Action이 표준 Web response를 반환하기 때문이다.
Header를 다룰 때는 Web `Headers`를 직접 사용하거나, `Cache-Control`, `Set-Cookie` 같은 값을 typed
accessor로 다루고 싶을 때 `remix/headers`를 사용한다.

## Mapping controllers

`createController(...)`는 controller가 무엇을 처리하는지 정의하고, `router.map(...)`은 그것을
등록한다. Controller는 자기 route map의 direct leaf만 소유하므로, nested map이 자체 action을 가질
때는 별도로 등록해야 한다.

```ts
import { createRouter } from "remix/router";
import rootController from "./actions/controller.tsx";
import albumsController from "./actions/albums/controller.tsx";
import albumsEditController from "./actions/albums/edit/controller.tsx";
import { routes } from "./routes.ts";

export const router = createRouter();

router.map(routes, rootController);
router.map(routes.albums, albumsController);
router.map(routes.albums.edit, albumsEditController);
```

위 mapping에서 각 controller의 책임은 다음과 같다.

- `rootController`는 `home` 같은 root-level leaf를 처리한다.
- `albumsController`는 `routes.albums.show`를 처리한다.
- `albumsEditController`는 `routes.albums.edit.index`와 `routes.albums.edit.action`을 처리한다.

`router.map(...)`은 route map과 controller를 연결하는 app-level convention이다. Controller 없이
개별 handler를 등록하고 싶다면 `router.get(...)`, `router.post(...)` 같은 direct method를 사용할 수
있다.

```ts
router.get("/health", () => new Response("OK"));
```

Controller middleware도 같은 ownership rule을 따른다. `albumsController`의 middleware는
`routes.albums.show`에는 실행되지만, `routes.albums.edit.index`나 `routes.albums.edit.action`에는
실행되지 않는다.

Remix는 router setup 시점에 이 규칙을 확인한다. Controller가 자신이 소유한 leaf의 action을 빠뜨리면
앱이 request를 처리하기 전에 setup에서 throw한다.

## Organizing route-owned code

File tree는 보통 route map과 같은 shape를 따른다.

```text
app/actions/
├── controller.tsx              # routes
└── albums/
    ├── controller.tsx          # routes.albums
    ├── routes.ts               # albumRoutes
    └── edit/
        ├── controller.tsx      # routes.albums.edit
        └── page.tsx            # route-local UI
```

Route branch에 nested routes가 있다면 그에 맞는 directory와 controller를 두면 parent controller가
작아지고, 각 route owner가 file path에서 보인다.

Route-local UI는 그것을 렌더링하는 controller 옆에 둔다. 따라서 `albums.edit`의 page와 form은
`actions/albums/edit/`에 속한다. 여러 route area에서 공유하는 component는 `ui/`에 둔다.

Route map과 controller를 연결했으므로, 다음 Request Handling 챕터에서는 server entry로 돌아가
action 전후에 실행되는 middleware를 따라간다.
