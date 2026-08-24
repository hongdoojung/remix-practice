# Streaming UI with Frames 원문 한국어 번역

원문: [Streaming UI with Frames | Remix Docs](https://guides.remix.run/streaming-ui-with-frames/)
라이선스: Remix Docs 페이지 하단의 “docs and examples licensed under MIT” 표기를 기준으로 번역 및 정리했다.

프로젝트 적용 실습은 [`practice-guide.ko.md`](./practice-guide.ko.md)에서 다룬다.

## Streaming UI with Frames

Rendering UI 장의 album page는 하나의 component tree를 반환하고, Interactivity 장의 향상된 form은
저장한 뒤 navigate한다. 한 page의 어떤 영역이 자기만의 request를 가질 이점이 생기기 전까지는 그
단순한 경로를 유지하라.

이번 장은 album recommendation을 `GET` route 뒤로 옮기고, `<Frame>`으로 page에 stream해 넣고,
문서 전체를 navigate하지 않고 그 영역만 reload한다.

## Route가 소유하는 UI에 frame을 쓴다

Component가 느리다거나 상호작용이 있다는 이유만으로 frame이 필요해지는 것은 아니다. 평범한
component 조합에서 시작하라. 어떤 영역이 자기 route를 가져야 하고, 다음 중 하나 이상이 해당할 때
frame을 꺼내라.

- 주변 page보다 늦게 도착해도 된다;
- mutation 후에 독립적으로 reload되어야 한다;
- 여러 page가 같은 route 소유 영역을 render한다; 또는
- 그 데이터와 error response가 별도 request에 속한다.

Album route 옆에 recommendations route를 추가한다.

`app/routes.ts`

```ts
import { form, get, route } from "remix/routes";

export const routes = route({
  albums: route("/albums", {
    show: get("/:albumId"),
    recommendations: get("/:albumId/recommendations"),
    edit: form("/:albumId/edit"),
  }),
});
```

Action은 frame이 필요로 하는 영역만 render한다. 앱의 `Document` shell은 포함하지 않는다.

`app/actions/albums/controller.tsx`

```tsx
import { createController } from "remix/router";

import { routes } from "../../routes.ts";
import { getAlbum, getRecommendations } from "./data.ts";
import { AlbumRecommendations } from "./recommendations.tsx";
import { AlbumPage } from "./show-page.tsx";

export default createController(routes.albums, {
  actions: {
    async show(context) {
      let album = await getAlbum(context.params.albumId);
      if (!album) return new Response("Album not found", { status: 404 });

      return context.render(<AlbumPage album={album} />);
    },

    async recommendations(context) {
      let album = await getAlbum(context.params.albumId);
      if (!album) return new Response("Album not found", { status: 404 });

      let recommendations = await getRecommendations(album);
      return context.render(<AlbumRecommendations albums={recommendations} />);
    },
  },
});
```

이제 page는 그 route를 `Frame`으로 render할 수 있다.

`app/actions/albums/show-page.tsx`

```tsx
import { Frame } from "remix/ui";
import type { Handle } from "remix/ui";

import { routes } from "../../routes.ts";
import { Document } from "../document.tsx";
import type { Album } from "./data.ts";

export function AlbumPage(handle: Handle<{ album: Album }>) {
  return () => {
    let { album } = handle.props;

    return (
      <Document title={`${album.title} — Albums`}>
        <main>
          <h1>{album.title}</h1>
          <Frame src={routes.albums.recommendations.href({ albumId: album.id })} />
        </main>
      </Document>
    );
  };
}
```

`fallback`이 없으면 frame은 blocking이다. Remix는 첫 HTML chunk를 보내기 전에 recommendations
response를 기다린다. Browser는 여전히 완결된 page 하나를 받는다.

## Fallback을 먼저 stream한다 {#streaming-and-deferred-rendering}

Recommendation이 도착하기 전에도 album page가 쓸모 있다면 `fallback`을 추가한다.

```tsx
<Frame
  src={routes.albums.recommendations.href({ albumId: album.id })}
  fallback={<p>Loading recommendations…</p>}
/>
```

Fallback은 초기 HTML의 일부다. Recommendations action이 끝나면 Remix가 render된 HTML을 stream해서
fallback을 교체한다.

주변 page를 혼란스럽게 만들지 않으면서 늦게 도착해도 되는 영역에 fallback을 써라. 초기 page가 그
영역 없이는 말이 되지 않는다면 frame을 blocking으로 유지하라. Fallback은 loading UI이지 범용 error
boundary가 아니다. Request가 실패했을 때 무슨 일이 일어날지는 여전히 frame resolver와 앱의 error
처리가 결정한다.

## Response를 stream으로 render한다 {#server-rendering-with-rendertostream-and-rendertostring}

생성된 render middleware는 일반 HTML response에 `renderToStream()`을 쓴다. 대부분의 action은
`context.render(...)`를 통해 간접적으로 사용한다.

그 middleware의 frame 관련 부분은 현재 request URL, 그 취소 signal, 그리고 frame URL을 앱 router로
되돌려 보내는 resolver를 제공한다.

`app/middleware/render.tsx`

```tsx
import { createHtmlResponse } from "remix/response/html";
import { renderToStream } from "remix/ui/server";

// Request 범위 render 함수 내부:
let stream = renderToStream(node, {
  frameSrc: request.url,
  signal: request.signal,
  resolveFrame(src, target) {
    return resolveFrame(router, request, src, target);
  },
  // 앱의 기존 resolveClientEntry와 onError option은 여기 유지한다.
});

return createHtmlResponse(stream, init);
```

Resolver는 첫 번째 절의 route로 평범한 request를 보낸다. Frame이 문서의 session을 공유한다면
cookie를 전달한다.

`app/middleware/render.tsx`

```ts
import type { Router } from "remix/router";

async function resolveFrame(router: Router, request: Request, src: string, target?: string) {
  let headers = new Headers({ Accept: "text/html" });
  let cookie = request.headers.get("Cookie");
  if (cookie) headers.set("Cookie", cookie);
  if (target) headers.set("X-Remix-Target", target);

  let response = await router.fetch(
    new Request(new URL(src, request.url), {
      headers,
      signal: request.signal,
    }),
  );

  if (!response.ok) {
    throw new Error(`Frame request failed with status ${response.status}`);
  }

  return response.body ?? response.text();
}
```

`renderToString()`은 코드가 진행하기 전에 완성된 HTML 값이 필요할 때 쓰는 더 작은 대안이다. Email
미리보기나 작은 embedded fragment 같은 경우다.

```tsx
import { renderToString } from "remix/ui/server";

// Recommendation을 로드한 뒤:
let html = await renderToString(<AlbumRecommendations albums={recommendations} />);
```

일반 page response에는 앱의 streaming renderer를 써라. Client entry를 지원하고, fallback을 가진
frame이 초기 HTML 뒤에 도착할 수 있게 해준다.

## Browser에서 frame을 resolve한다

Blocking frame은 browser가 page를 받기 전에 resolve된다. Fallback이 있는 frame은 아직 pending일 수
있고, 어떤 frame이든 나중에 reload될 수 있다. 그런 request를 위해 browser의 `run()` option에
`resolveFrame`을 추가한다.

`app/actions/public/entry.ts`

```ts
import type { ResolveFrameOptions } from "remix/ui";
import { run } from "remix/ui";

let app = run({
  async loadModule(moduleUrl, exportName) {
    let module = await import(moduleUrl);
    return module[exportName];
  },
  async resolveFrame(src, options) {
    let headers = new Headers({ Accept: "text/html", "X-Remix-Frame": "true" });
    if (options?.target) headers.set("X-Remix-Target", options.target);

    let response = await fetch(src, {
      body: getRequestBody(options),
      credentials: "same-origin",
      headers,
      method: options?.method,
      signal: options?.signal,
    });

    if (!response.ok) {
      throw new Error(`Frame request failed with status ${response.status}`);
    }

    return response.body ?? response.text();
  },
});

function getRequestBody(options?: ResolveFrameOptions): BodyInit | undefined {
  let formData = options?.formData;
  if (!formData) return;
  if (options.encType !== "application/x-www-form-urlencoded") return formData;

  let body = new URLSearchParams();
  for (let [name, value] of formData) {
    body.append(name, typeof value === "string" ? value : value.name);
  }
  return body;
}

app.addEventListener("error", (event) => {
  console.error(event.error);
});
```

`resolveFrame`에서는 신뢰할 수 있는 HTML만 반환하라. Same-origin route URL이 일반적인 선택이다.
제거되었거나 대체된 frame의 request가 계속 진행되게 두지 말고 `options.signal`을 `fetch()`에
넘겨라. GET form은 이미 값이 `src`에 포함되어 있다. GET이 아닌 form에서는 resolver가 browser의
`FormData`, method, encoding을 받는다. 이 예제는 URL-encoded와 multipart form body를 보존한다.
다른 encoding이나 `_method` 관례를 적용할 곳도 이 resolver다.

## Frame에 이름을 붙이고 reload한다 {#frames-and-partial-server-rendered-ui}

다른 client entry가 찾아야 하는 frame에는 `name`을 준다.

```tsx
<Frame
  name="album-recommendations"
  src={routes.albums.recommendations.href({ albumId: album.id })}
  fallback={<p>Loading recommendations…</p>}
/>
```

Component는 자신을 담고 있는 frame이나 page 어딘가의 named frame을 reload할 수 있다.

```tsx
// 자신을 담고 있는 frame을 reload한다.
await handle.frame.reload();

// Mount된 named frame을 이름으로 reload한다.
await handle.frames.get("album-recommendations")?.reload();
```

`handle.frames.get(name)`은 그 frame이 mount되어 있지 않으면 `undefined`를 반환한다. Reload 후
Remix는 해당 영역을 route의 현재 HTML로 update한다. 일치하는 콘텐츠 안의 client entry는 setup
state를 유지한 채 현재 server prop을 받는다.

## Form으로 frame을 navigate한다

`run({ resolveFrame })`이 시작되면, 조건을 충족하는 same-origin form은 link와 같은 frame
navigation 경로를 따른다. 이 GET form은 client entry나 submit handler 없이 recommendations
frame을 reload한다.

```tsx
<form
  action={routes.albums.recommendations.href({ albumId: album.id })}
  method="get"
  data-rmx-target="album-recommendations"
>
  <button type="submit">Refresh recommendations</button>
</form>
```

Runtime이 시작되기 전에는 이 form은 평범한 document navigation이다. Native constraint validation과
form의 `submit` event는 Remix가 가로채기 전에 실행된다. `data-rmx-target`은 named frame을 고르고,
`data-rmx-src`는 다른 frame request URL을 제공할 수 있고, `data-rmx-reset-scroll="false"`는 현재
scroll 위치를 보존하고, `data-rmx-document`는 가로채기를 거부한다. `data-rmx-history="push|replace"`는
이 navigation이 history를 update하는 방식을 제어한다.

GET control은 이미 목적지 URL에 encode되어 있다. GET이 아닌 form에서는 `resolveFrame`이
`formData`, `method`, `encType`을 받는다. Frame request를 받은 action은 target frame을 위한 HTML을
반환해야 하고, 향상되지 않은 제출에 대해서는 평소의 document response나 redirect를 유지해야 한다.
현재 URL로의 GET이 아닌 제출은 그 history entry를 교체하고, GET 제출과 다른 URL로의 제출은 하나를
push한다. `data-rmx-history` attribute가 그 기본값을 override한다.

## Mutation과 별도 frame reload를 조율한다 {#coordinating-forms-fetches-frame-reloads-and-navigation}

Browser JavaScript 없이 동작하는 action을 가진 form에서 시작하라. Client entry는 그 같은 제출을
가로채서 `FormData`를 보내고, action이 성공한 뒤 다른 route를 reload할 수 있다.

```tsx
import { on } from "remix/ui";

// Client entry component의 render 함수 내부:
<form
  action={routes.albums.edit.action.href({ albumId: album.id })}
  method="post"
  mix={on("submit", async (event, signal) => {
    let form = event.currentTarget;
    event.preventDefault();

    let response = await fetch(form.action, {
      body: new FormData(form),
      method: form.method,
      signal,
    });

    if (signal.aborted) return;
    if (!response.ok) {
      // 앱의 validation 또는 request error를 여기서 render한다.
      return;
    }

    await handle.frames.get("album-recommendations")?.reload();
  })}
>
  {/* album fields */}
</form>;
```

이 custom handler가 유용한 것은 mutation response와 recommendations frame이 서로 다른 두
request이기 때문이다. Form action 자체가 target frame에 들어갈 HTML을 반환한다면
`data-rmx-target`을 쓰고 runtime이 `resolveFrame`을 통해 제출하게 하라.

위 handler는 mutation을 기존 action에, recommendations HTML을 기존 `GET` action에 그대로 둔다.
Browser component는 어느 server 경로도 중복하지 않고 두 request를 조율한다.

Response가 page 전체를 교체해야 한다면 일반 navigation을 써라. Browser component가 반환된 데이터를
직접 render한다면 JSON을 fetch하라. 기존 `GET` action이 한 영역의 HTML을 render하고 그 영역만
update가 필요하다면 frame을 reload하라.

## Link에서 frame을 target한다

Link는 공개 목적지를 `href`에 유지하면서 더 작은 route를 named frame으로 로드할 수 있다.

```tsx
// Album link를 render하는 component 내부:
<a
  href={routes.albums.show.href({ albumId: album.id })}
  data-rmx-src={routes.albums.recommendations.href({ albumId: album.id })}
  data-rmx-target="album-recommendations"
  data-rmx-reset-scroll="false"
>
  Show recommendations
</a>
```

`data-rmx-target`은 frame을 고르고, `data-rmx-src`는 그 frame을 채울 request를 고른다. 주소창은
여전히 `href`로 이동한다. 현재 history entry를 교체해야 한다면 `data-rmx-history="replace"`를
추가한다. Same-origin link가 반드시 평범한 document navigation을 해야 한다면 `data-rmx-document`를
써라.

## 실패와 취소를 다룬다

Server renderer의 `onError`와 browser app의 `error` event는 보고용 hook이다. 성공이 아닌 response를
그 영역을 위한 제한된 HTML로 만들지, 아니면 그 hook으로 보고되는 error로 만들지는 앱의 frame
resolver가 결정한다.

Fallback이 이미 전송된 뒤에 deferred frame이 실패하면, server는 page 전체를 새 error response로
교체할 수 없다. Fallback을 쓸모 있게 유지하고, error를 보고하고, 안전하다면 주변 page가 계속되게
하라.

Server frame 작업에는 `request.signal`을, browser resolver의 signal은 `fetch()`에 전달하라.
[Errors and Cancellation](https://guides.remix.run/errors-and-error-boundaries/)이 보고 정책을
다루고, [Production](https://guides.remix.run/production/)이 연결 끊김, compression, 그 밖의 배포
관심사를 다룬다.

다음 장 [Animation](https://guides.remix.run/animation/)은 component 삽입, 제거, layout 변화에
motion을 더한다.
