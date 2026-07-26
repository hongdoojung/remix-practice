# Routing and Controllers

원문: [Routing and Controllers | Remix Docs](https://guides.remix.run/routing-and-controllers/) ·
전문 번역: [`original-translation.ko.md`](./original-translation.ko.md)

이 문서 하나로 챕터의 개념을 익히고, `vinyl-shelf` 프로젝트 코드로 실습한다. 각 절은 먼저
개념을 설명하고, **vinyl-shelf에서는** 단락에서 이 프로젝트의 실제 코드와 연결한다.

이 문서의 코드와 파일 경로는 `curriculum 02: Routing and Controllers` 커밋 시점 기준이다.

1장에서 요청 하나가 끝까지 가는 경로를 만들었다. `Request`가 들어오고, route가 매칭되고,
controller의 action이 실행되고, `Response`가 나갔다. 이번 장은 그 경로의 가운데 —
route와 controller의 경계 — 를 제대로 세운다. `app/routes.ts`는 앱이 받아들이는 URL과
method에 이름을 붙이고, `app/actions/`의 controller가 그것을 구현한다.

## 1. Route는 URL 계약이다

`route(...)`에 객체를 넘기면, 같은 중첩 모양을 가진 typed route map이 나온다.

```ts
export const routes = route({
  home: "/",
  albums: {
    show: { method: "GET", pattern: "/albums/:albumId" },
    edit: {
      index: { method: "GET", pattern: "/albums/:albumId/edit" },
      action: { method: "POST", pattern: "/albums/:albumId/edit" },
    },
  },
})
```

이 map에는 두 종류의 노드가 있다.

- **leaf** — `routes.albums.show`처럼 method, pattern, `href(...)`를 가진 route 하나.
  router는 leaf로 요청을 매칭하고, 앱의 나머지 코드는 같은 leaf로 URL을 만든다.
- **branch** — `routes.albums`, `routes.albums.edit`처럼 leaf들을 담은 또 다른 route map.

`edit` branch는 같은 URL에 leaf가 두 개다. `index`가 GET을, `action`이 POST를 받는다.
leaf와 branch의 구분은 3절에서 controller를 연결할 때 중요해진다.

pattern의 `:albumId`는 path variable이다. 매칭되면 action의 `context.params.albumId`가
되고, `href(...)`는 그 값을 요구한다.

```ts
routes.albums.show.href({ albumId: "thriller" })  // /albums/thriller
```

이게 "계약"인 이유: 나중에 pattern을 `/albums/:id`로 바꾸면, `{ albumId: ... }`를 넘기던
오래된 호출이 전부 타입 에러로 드러난다. URL 변경이 코드 곳곳의 문자열에 숨지 않는다.
그리고 route 정의가 요청 처리 코드와 분리되어 있으므로, 브라우저 모듈도 controller를
끌어들이지 않고 같은 `routes`를 import해 URL을 만들 수 있다.

pattern은 path variable 말고도 wildcard, optional 구간, query 조건, hostname까지 표현한다.

```ts
"/docs(/v:version)/:category/*slug.:format?preview"
// /docs/v2/guides/routing/route-maps.html?preview=1 과 매칭될 수 있다.
```

전체 문법을 외울 필요는 없다. 필요할 때 route-pattern 문서를 찾으면 된다.

### vinyl-shelf에서는

1장의 평평한 route 목록을 중첩 map으로 재구성했다. `app/routes.ts`:

```ts
export const routes = route({
  assets: get('/assets/*path'),
  home: '/',
  albums: {
    index: get('/albums'),
    create: post('/albums'),
    show: get('/albums/:slug'),
    edit: form('/albums/:slug/edit'),
  },
  apiAlbums: get('/api/albums'),
})
```

1장의 `albums`/`albumsAction`/`album`이라는 병렬 이름이 `albums.index`/`albums.create`/
`albums.show`가 됐다. 이름이 소속을 드러내고, `albums` branch를 통째로 controller 하나에
맡길 수 있게 된다.

## 2. Route builder

매번 `{ method, pattern }` 객체를 쓰는 대신, 자주 나오는 모양에 이름을 붙인 helper가 있다.
전부 위에서 본 것과 같은 평범한 leaf와 map을 만들 뿐이라서, 손으로 쓴 정의와 자유롭게
섞어 중첩할 수 있다.

| Helper | 만드는 것 |
| --- | --- |
| `get`, `post`, `put`, `patch`, `del`, `head`, `options` | 하나의 HTTP method로 좁혀진 leaf |
| `form(pattern)` | 같은 URL의 GET page + POST action 쌍 |
| `route(prefix, defs)` | 공통 prefix 아래로 합성된 중첩 map |
| `resources(pattern)` | collection의 관례적 route 일곱 개 |
| `resource(pattern)` | 단일 resource의 관례적 route (collection 페이지가 없어 `index` 제외) |

세 가지는 따로 알아둘 가치가 있다.

**문자열 route** — `webhook: "/webhooks/github"`처럼 문자열만 쓰면 모든 method와 매칭된다.
method가 중요하면 action 안에서 `context.method`를 확인해야 한다.

**`route(prefix, defs)` 합성** — route 영역을 별도 파일이 소유하게 할 수 있다. 영역 파일은
자기 이름과 상대 pattern만 알고, 그 영역이 어느 URL 아래에 놓일지는 앱이 정한다.

```ts
// app/actions/albums/routes.ts — 영역은 상대 pattern만 안다
export const albumRoutes = route({
  index: get("/"),
  show: get("/:albumId"),
})

// app/routes.ts — 앱이 위치를 정한다
export const routes = route({
  albums: route("/albums", albumRoutes),
})
// routes.albums.index -> GET /albums
// routes.albums.show  -> GET /albums/:albumId
```

**`resources(...)` 옵션** — 일곱 관례(`index`, `new`, `show`, `create`, `edit`, `update`,
`destroy`) 중 일부만 쓰려면 `only`, 기본 path variable 이름 `id`를 바꾸려면 `param`을 준다.

```ts
albums: resources("/albums", { only: ["index", "show", "create"], param: "albumId" })
```

### vinyl-shelf에서는

이 챕터에서 실제로 쓴 builder는 `get`, `post`, `form` 세 개다. `form('/albums/:slug/edit')`
하나가 `edit.index`(GET)와 `edit.action`(POST) 두 leaf를 만들었고, edit form의 `action`
속성도 문자열이 아니라 이 leaf로 만든다.

```tsx
<form method="post" action={routes.albums.edit.action.href({ slug: album.slug })}>
```

`resources(...)`를 쓰면 albums map 대부분을 한 줄로 줄일 수 있지만, 이 단계에서는 관례가
무엇을 숨기는지 먼저 보려고 leaf를 손으로 썼다. `route(prefix, defs)` 합성은 아래 스터디
과제에서 직접 해 본다.

## 3. Controller와 action

controller는 **route map 하나의 direct leaf**(그 map 바로 아래에 있는 leaf, 중첩 map 안의
leaf는 제외)에 대한 요청 처리를 소유한다. `createController(routes.albums, { actions })`처럼
map을 넘기면, action 이름과 params가 그 map에서 타입으로 잡힌다.

```tsx
export default createController(routes.albums, {
  actions: {
    show(context) {
      return new Response(`Album: ${context.params.albumId}`)
    },
  },
})
```

`show`가 `get("/albums/:albumId")`로 정의되어 있으니, 이 action이 실행되는 시점의
`context.params.albumId`는 반드시 존재하는 `string`이다. 매칭은 router가 action 실행 전에
끝냈으므로, action은 URL을 직접 파싱하거나 param이 없는 경우를 방어할 필요가 없다.

모든 action이 받는 context의 기본 구성은 다음과 같다.

| Property / method | 내용 |
| --- | --- |
| `context.request` | 원본 Web `Request` |
| `context.url` | 파싱된 `URL` |
| `context.method` | request method |
| `context.params` | 매칭된 pattern에서 나온 typed 값 |
| `context.headers` | request header의 복사본 (응답 header가 아니다 — 4절 참고) |
| `context.router` | 이 요청을 처리 중인 router |
| `context.set / get / has` | 요청 범위의 값 저장·조회 |

여기에 middleware가 typed property를 더한다. `context.render`는 render middleware가,
`context.formData`는 formData middleware가 주는 것이라서, 목록이 앱의 middleware 구성에
따라 달라진다. 이 확장 구조는 Request Handling 챕터에서 자세히 다룬다.

middleware는 세 곳에 둘 수 있고, 실행 순서는 router → controller → action → handler다.
controller middleware는 그 controller가 소유한 모든 action에 적용되고, 특정 action에만
필요하면 action을 `{ middleware, handler }` 객체로 정의한다. 예를 들어 POST action만
`FormData` 파싱이 필요하고 GET page는 건너뛰게 할 수 있다.

```tsx
actions: {
  index() { ... },                       // formData 파싱 없음
  action: {
    middleware: [formData()],
    handler(context) { ... },            // context.formData 사용 가능
  },
}
```

### vinyl-shelf에서는

1장의 단일 controller를 셋으로 나눴다.

| Controller | 소유하는 leaf |
| --- | --- |
| `app/actions/controller.tsx` | `home`, `assets`, `apiAlbums` |
| `app/actions/albums/controller.tsx` | `albums.index`, `albums.create`, `albums.show` |
| `app/actions/albums/edit/controller.tsx` | `albums.edit.index`, `albums.edit.action` |

direct leaf 규칙이 이 분리를 강제한다. `routes.albums`를 받은 controller에게
`albums.edit.index`는 direct leaf가 아니라 중첩 map 안의 leaf라서, `edit`은 자기 controller가
따로 필요하다.

`show` action은 param을 신뢰하는 모양 그대로다.

```tsx
show(context) {
  let album = getAlbum(context.params.slug)
  if (!album) {
    return context.render(<NotFoundPage slug={context.params.slug} />, { status: 404 })
  }
  return context.render(<AlbumDetailPage album={album} />)
}
```

"요청이 매칭됐는가"는 router의 책임, "그 slug의 데이터가 있는가"는 controller의 책임이다.

## 4. 응답 만들기: render, redirect, JSON, error

action의 반환값은 언제나 Web `Response`다. `context.render(...)`도 component tree로 본문을
만들 뿐 결과는 평범한 `Response`이고, 그 밖에도 필요한 응답을 골라 만들면 된다.

```ts
return new Response("Album not found", { status: 404 })          // text
return redirect(routes.albums.show.href({ albumId }), 303)       // redirect
return Response.json(album, { headers: { "Cache-Control": "no-store" } })  // JSON
return createHtmlResponse(html`<p>${album.title}</p>`)           // component 없이 HTML
```

마지막 줄의 `html` template tag는 보간 값을 escape해 주고, `createHtmlResponse(...)`가
content type과 doctype을 붙인다. component runtime 없이 HTML 조각을 만들 때 쓴다.

에러 처리의 원칙이 이 장에서 가장 중요한 문장이다. **예상 가능한 결과 — 잘못된 입력,
없는 데이터, 충돌 — 는 적절한 status를 가진 `Response`로 반환하고, throw는 예상하지 못한
실패에만 남겨 둔다.** action이 throw하면 `router.fetch(...)` 자체가 reject되고, server
entry가 그것을 잡아 500으로 바꾼다. 즉 throw는 "우리 코드가 고장났다"는 신호로 아껴 둔다.

주의할 점 하나: `context.headers`는 응답이 아니라 **요청**의 header다. 응답 header를 위한
별도 API는 없다 — action이 표준 `Response`를 반환하므로, header도 `Response`를 만들 때
표준 방식으로 넣으면 된다.

### vinyl-shelf에서는

edit action 하나에 이 원칙이 다 들어 있다. `app/actions/albums/edit/controller.tsx`:

```tsx
async action(context) {
  let formData = await context.request.formData()
  let result = validateCreateAlbum(formData)

  if (!result.ok) {
    let album = getAlbum(context.params.slug)
    if (!album) {
      return context.render(<NotFoundPage slug={context.params.slug} />, { status: 404 })
    }
    return context.render(
      <AlbumEditPage album={album} errors={result.errors} values={result.values} />,
      { status: 400 },
    )
  }

  let album = updateAlbum(context.params.slug, result.value)
  if (!album) {
    return context.render(<NotFoundPage slug={context.params.slug} />, { status: 404 })
  }

  return redirect(routes.albums.show.href({ slug: album.slug }), 303)
}
```

검증 실패는 400, 없는 앨범은 404, 성공은 303 — 전부 명시적인 `Response`이고 throw는 없다.

## 5. Controller 연결하기

`createController(...)`는 정의일 뿐이고, `router.map(...)`이 등록이다. 중첩 map이 자기
action을 가지면 별도로 등록해야 한다.

```ts
router.map(routes, controller)
router.map(routes.albums, albumsController)
router.map(routes.albums.edit, albumsEditController)
```

이 연결에는 안전장치가 있다. controller가 자기가 소유한 leaf의 action을 하나라도 빠뜨리면,
요청을 받기 전에 router 설정 시점에서 throw한다. route를 추가하고 action을 잊는 실수가
서비스 중이 아니라 서버 시작에서 잡힌다.

controller 없이 handler 하나만 붙이고 싶으면 direct method도 있다.

```ts
router.get("/health", () => new Response("OK"))
```

controller middleware의 적용 범위도 소유 규칙을 따른다. `albumsController`의 middleware는
`albums.show`에는 실행되지만 `albums.edit.index`에는 실행되지 않는다.

### vinyl-shelf에서는

`app/router.ts`의 세 줄이 위 코드 그대로다. 실험 하나: `albumsController`에서 `show` action을
지우고 `corepack pnpm test`를 돌려 보자 — 요청 처리가 아니라 설정 단계에서 실패한다.
확인했으면 되돌린다.

## 6. Route가 소유하는 코드 정리

파일 트리는 보통 route map과 같은 모양을 따라간다.

```text
app/actions/
├── controller.tsx              # routes
└── albums/
    ├── controller.tsx          # routes.albums
    ├── routes.ts               # albumRoutes (route 합성을 쓰는 경우)
    └── edit/
        ├── controller.tsx      # routes.albums.edit
        └── page.tsx            # route 전용 UI
```

branch에 중첩 route가 생기면 그에 맞는 디렉터리와 controller를 둔다. 부모 controller가
작게 유지되고, 어떤 route를 누가 소유하는지 파일 경로만 봐도 보인다. route 하나에서만
쓰는 UI는 그 controller 옆에 두고, 여러 영역이 공유하는 component만 `ui/`에 둔다.

### vinyl-shelf에서는

`albums.edit`의 form 페이지를 `app/actions/albums/edit/page.tsx`에 뒀다. 이 UI는 edit route
전용이라 `ui/`가 아니라 controller 옆이 제자리다. 반면 `Document`, `NotFoundPage`처럼 여러
route가 쓰는 것은 `app/ui/`에 남아 있다.

## 정독 후 확인 질문

1. `routes.albums`와 `routes.albums.show`는 각각 branch인가 leaf인가? 그 구분이 controller
   연결에 왜 중요한가?
2. `form('/albums/:slug/edit')`이 만드는 두 leaf의 이름과 method는 무엇인가?
3. `routes.albums`를 받은 controller가 `albums.edit.action`을 처리하지 않는 이유는 무엇인가?
4. action에서 URL을 직접 파싱하지 않아도 되는 근거는 무엇인가?
5. 검증 실패를 throw 대신 400 `Response`로 반환하면 무엇이 좋아지는가? throw는 언제 쓰는가?
6. `context.headers`에 값을 넣으면 응답 header가 되는가? 아니라면 응답 header는 어떻게
   설정하는가?

## 스터디 과제

**genre 페이지 영역을 `route(prefix, defs)` 합성으로 추가한다.**

1. `app/actions/genres/routes.ts`에 상대 pattern만 가진 `genreRoutes`를 만든다 —
   `index: get('/')`(전체 genre 목록)와 `show: get('/:genre')`(그 genre의 앨범 목록).
2. `app/routes.ts`에서 `genres: route('/genres', genreRoutes)`로 합성한다.
3. `app/actions/genres/`에 controller와 route 전용 page를 만들고 `router.map(...)`으로
   등록한다. 앨범 데이터에는 이미 `genre` field가 있다.
4. 없는 genre면 404를 반환한다. 목록의 각 genre 링크는 `href()`로 만든다.
5. genre 목록(200)과 없는 genre(404) 테스트를 하나씩 추가한다.

다 만들었으면 파일 트리가 route map과 같은 모양인지 스스로 점검해 보자.
