# Start Here 원문 한국어 번역

원문: [Start Here | Remix Docs](https://guides.remix.run/start-here/)
라이선스: Remix Docs 페이지 하단의 “docs and examples licensed under MIT” 표기를 기준으로 번역 및 정리했다.

이 문서는 사용자가 대화에 제공한 Start Here 원문 내용을 기준으로 한국어로 옮긴 번역 문서다.
프로젝트 적용 실습은 [`practice-guide.ko.md`](./practice-guide.ko.md)에서 다룬다.

## Start Here

## What is Remix?

Remix는 웹의 요청과 응답 모델을 중심으로 만들어진 TypeScript 프레임워크다. 서버는 Web
`Request`를 받고, Remix는 그것을 typed route에 매칭하며, controller가 요청을 처리하고,
앱은 Web `Response`를 반환한다.

`remix` 패키지에는 애플리케이션 전반에서 사용하는 서버, 라우터, 미들웨어, UI, 데이터, 인증,
asset, 테스트 패키지가 포함되어 있다. 각 패키지는 독립적으로도 유용하므로, 앱은 전체 요청 경로를
사용할 수도 있고 필요한 계층만 사용할 수도 있다.

Remix의 설계는 여섯 가지 핵심 원칙에서 나온다.

1. **Agent-First Development.** Remix는 LLM에 맞춰 소스 코드, 문서, 도구, 추상화를 최적화하고,
   당신이 만드는 제품 안에서 모델을 사용할 수 있는 primitive를 제공한다.
2. **Build on Web APIs.** Remix는 `Request`, `Response`, `URL`, `FormData`, headers, cookies,
   JavaScript 위에 만들어진다. 공통 플랫폼 API를 사용하면 full stack 전반에서 context switching이
   줄어들고 애플리케이션의 이식성도 유지된다.
3. **Religiously Runtime.** Remix API는 bundler, type generation, static analysis에 의존하지
   않는다. routes, middleware, controllers, tests는 일반 runtime code로 실행되어야 한다.
4. **Avoid Dependencies.** Remix는 의존성을 신중하게 선택하고, 자체 경계 뒤로 감싸며, 프레임워크가
   장기적인 제어권을 가져야 하는 경우 집중된 패키지로 대체하는 방향으로 나아간다.
5. **Demand Composition.** Remix 패키지는 단일 목적을 가지며, 교체 가능하고, 독립적으로도 유용하다.
   앱이 변함에 따라 조각을 추가하거나 제거할 수 있고, 강하게 결합된 모듈은 함께 있어야 한다.
6. **Distribute Cohesively.** Remix는 조합 가능한 조각들을 하나의 `remix` 패키지와 하나의 문서
   경로로 배포하여 생태계를 배우고 사용하기 쉽게 유지한다.

Remix를 가장 빠르게 이해하는 방법은 요청 경로를 한 번 직접 만들어 보는 것이다. 서버를 만들고,
routes를 정의하고, router를 연결하고, response를 반환해보면 된다.

## Quickstart: create and run a Remix app

Remix 앱을 시작하는 가장 빠른 방법은 `remix` CLI를 사용하는 것이다. CLI는 Node server, typed
routes, render middleware, server-rendered home page, source-served assets, hydrated component
하나를 포함한 작은 full-stack 애플리케이션을 만든다.

먼저 실행한다.

```sh
npx remix@next new my-remix-app
```

다음으로 프로젝트 의존성을 설치한다.

```sh
cd my-remix-app
npm i
```

의존성에 대해 한 가지 짚고 넘어가자. `package.json`을 열어보면 runtime dependency가 하나뿐인
것을 볼 수 있다. 바로 `remix`다. 앱은 이 단일 패키지를 server adapter, router, middleware, UI,
assets, client entry에 사용한다.

```json
{
  "name": "my-remix-app",
  "private": true,
  "type": "module",
  "dependencies": {
    "remix": "^3.0.0"
  }
}
```

마지막으로 dev server를 시작한다.

```sh
npm run dev
```

서버가 시작되면 로컬 URL을 출력한다. 기본적으로 dev server는
`http://localhost:44100`에서 listen한다.

새 앱에는 Agent Skill과, agentic coding environment에 복사해 넣을 수 있는 prompt가 있는 home
page가 포함되어 있다. 직접 탐색해보고 싶다면 하나를 시도해봐도 된다. 준비가 되면 다시 돌아와서
파일들을 둘러보자.

## Project tour: where code lives

일반적인 Remix 애플리케이션은 파일 구조 안에서 request flow가 보이도록 유지한다. HTTP request는
`server.ts`로 들어오고, `app/router.ts`로 전달되며, middleware를 통과하고, `app/routes.ts`에 있는
route definition과 매칭되고, `app/actions/` 안의 route action에서 처리된 뒤 Web `Response`를
반환한다. 이 response는 Remix component가 생성한 HTML인 경우가 많지만, 같은 action이 redirect,
JSON, file, stream, error 또는 다른 어떤 Web response도 반환할 수 있다.

이 흐름은 모든 코드가 있어야 할 위치를 분명하게 해준다. `routes.ts`에서 routes를 정의하고,
`router.ts`에서 middleware, routes, controllers를 연결하며, `actions/`에서 route-specific behavior를
처리하고, `ui/`에 shared views와 layouts를 둔다. 그리고 `app/` 아래 어디에 있든 browser에서 로드할
수 있는 module은 `.browser.ts` 또는 `.browser.tsx` suffix로 표시한다.

```text
my-remix-app/
├── server.ts              # 이 runtime의 request entrypoint
└── app/
    ├── routes.ts          # route definitions, route map, URL helpers
    ├── router.ts          # middleware, routes, controller mapping
    ├── middleware/        # request middleware와 context providers
    ├── actions/           # controllers, route actions, route-local UI
    ├── ui/                # shared views, layouts, Remix components
    ├── assets.ts          # browser module server configuration
    └── entry.browser.ts   # browser runtime 시작
```

이제 작은 기능을 만들어가며 각 파일을 더 자세히 만져볼 것이다. 유일하게 건드리지 않을 파일은
`server.ts`다. 단순화한 버전은 다음과 같다.

```ts
import * as http from "node:http";
import { createRequestListener } from "remix/node-fetch-server";
import { router } from "./app/router.ts";

const requestListener = createRequestListener(async (request) => {
  return await router.fetch(request);
});

const server = http.createServer(requestListener);

server.listen(44100, () => {
  console.log("Server listening on http://localhost:44100");
});
```

`server.ts`는 runtime entrypoint다. Node 기반 예제에서는 HTTP server를 만들고, 각 Node request를
Web `Request`로 변환한 뒤 `router.fetch(request)`에 넘긴다.

Request Handling 챕터에서는 runtime adapters, `createRequestListener`, middleware ordering,
typed request context를 더 깊게 다룬다.

## Define your first route

Remix에서 routes는 매칭된 요청을 처리하는 actions와 분리해서 정의한다. `app/routes.ts`에서는 앱이
받아들이는 URL과 HTTP methods를 정의한다. `app/actions/`에서는 controllers가 그 route 중 하나가
매칭되었을 때 어떤 `Response`를 반환할지 결정한다.

URL contract를 분리해두면 controllers, links, forms, redirects, tests가 URL 생성을 request handling과
결합하지 않고도 하나의 typed source of truth를 공유할 수 있다.

디지털 레코드 상점에서 여러 album을 볼 수 있는 route를 정의하는 것으로 시작하자.

```ts
import { get, route } from "remix/routes";

export const routes = route({
  assets: get("/assets/*path"),
  home: "/",
  albums: {
    show: get("/albums/:albumId"),
  },
});
```

이 route definition은 많은 일을 한다.

- `albums`를 route group으로 정의하고, `show`를 코드에서 참조할 route name으로 정의한다.
- `get()`으로 `show` route를 좁혀 GET requests만 매칭되게 한다.
- URL pattern `"/albums/:albumId"`를 정의하므로 `/albums/thriller` 같은 pathname이 매칭된다.
- `:albumId`를 path variable로 사용하며, action에서는 `params.albumId` route param으로 읽을 수 있다.
- typed href constructor를 제공한다. 예: `routes.albums.show.href({ albumId: "thriller" })`.

`:albumId` 같은 path variables 외에도 route patterns는 wildcards, optional groups, search
constraints, hostnames, full origins를 표현할 수 있다.

이제 albums route map을 설정하고 있으니, 정리를 위해 `app/actions/` 안에 albums routes와 관련된
모든 것을 담을 directory를 만들고 controller file을 만든다.

```sh
mkdir app/actions/albums
touch app/actions/albums/controller.tsx
```

이 controller는 지금은 작게 시작해서 지금까지 가진 단일 `show` action만 처리한다. `routes.albums`를
`createController`에 넘기면 `show` function을 가진 actions를 제공해야 한다. `show` 자체는 type-safe
params를 받기 때문에, 앞에서 설정한 `:albumId` path variable로부터 `albumId`가 존재함을 보장할 수
있다.

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

마지막으로 `app/router.ts`에서 albums route map을 router에 map해야 한다.

```ts
import { createRouter, type RouterContext } from "remix/router";
import { staticFiles } from "remix/middleware/static";
import controller from "./actions/controller.tsx";
import albumsController from "./actions/albums/controller.tsx";
import { render } from "./middleware/render.tsx";
import { routes } from "./routes.ts";

// ...
router.map(routes, controller);
router.map(routes.albums, albumsController);
```

지금 `show` action은 plain Web `Response`를 반환한다.

브라우저에서 `http://localhost:44100/albums/thriller`로 이동하면 다음 text response가 보일 것이다.

```text
Album: thriller
```

Routing and Controllers 챕터에서는 route maps와 route builders를 더 깊게 다룬다.

## Build your first page

이 album page를 Remix component에서 HTML을 반환하도록 만들어 조금 더 흥미롭게 바꿔보자.

Remix UI는 JSX를 사용하며 two-phase component model을 가진다. component는 handle을 받는 함수이고,
JSX를 render하는 또 다른 함수를 반환한다. 바깥 함수는 setup이다. component가 만들어질 때 한 번
실행되므로, 그 안에 선언된 일반 JavaScript 변수는 local state를 담을 수 있다. 반환된 함수는
render다. 첫 render와 이후 모든 update에서 실행된다.

component model은 나중에 다시 다룬다. 지금 전체 모델을 보고 싶다면 Rendering UI 챕터를 보면 된다.

```tsx
function MyComponent(handle) {
  // Setup phase: 이 component가 만들어질 때 한 번 실행된다.
  // handle은 props와 다른 Remix UI API에 접근할 수 있게 해준다.
  return () => {
    // Render phase: 첫 render와 이후 모든 update에서 실행된다.
    // 여기서 JSX를 반환한다.
    return <div>Hello, Remix</div>;
  };
}
```

이제 album page를 위한 간단한 UI를 만들 수 있다. 앱 shell을 추가하기 위해 이미 다른 곳에 정의된
기존 `Document` component를 사용한다.

```sh
touch app/actions/albums/show-page.tsx
```

```tsx
import type { Handle } from "remix/ui";
import { Document } from "../../ui/document.tsx";

export function AlbumPage(handle: Handle<{ id: string }>) {
  return () => {
    return (
      <Document title="Album — Albums">
        <main>
          <h1>{handle.props.id}</h1>
        </main>
      </Document>
    );
  };
}
```

이 component를 사용하려면 action에서 response를 render해서 반환해야 한다. route는 여전히 Web
`Response`를 반환하지만, `context.render(...)`는 string 대신 component tree에서 그 response를
생성한다. 지금은 matched `albumId`를 그대로 넘겨서 이전 섹션처럼 route param을 계속 보여주게 한다.
render middleware는 app code이며, Rendering UI 챕터에서 어디서 오는지 보여준다.

```tsx
import { createController } from "remix/router";
import { routes } from "../../routes.ts";
import { AlbumPage } from "./show-page.tsx";

export default createController(routes.albums, {
  actions: {
    show(context) {
      return context.render(<AlbumPage id={context.params.albumId} />);
    },
  },
});
```

이 walkthrough에서는 작은 in-memory database를 설정한다. 실제 database setup은 Data and Validation
챕터에서 더 자세히 다룬다.

```sh
touch app/actions/albums/data.ts
```

```ts
export type Album = {
  artist: string;
  id: string;
  title: string;
  year: number;
};

let albums: Album[] = [
  {
    artist: "Michael Jackson",
    id: "thriller",
    title: "Thriller",
    year: 1983,
  },
];

export async function getAlbum(albumId: string) {
  return albums.find((album) => album.id === albumId);
}

export async function updateAlbum(albumId: string, values: Partial<Album>) {
  let album = albums.find((album) => album.id === albumId);
  if (album === undefined) {
    return undefined;
  }

  // Simulate network latency
  await new Promise((resolve) => setTimeout(resolve, 1000));

  Object.assign(album, values);
  return album;
}
```

이제 route param을 사용해 적절한 album을 “load”하고, 없으면 404를 반환하고, album data를 props로
component에 넘길 수 있다.

```tsx
import { createController } from "remix/router";
import { routes } from "../../routes.ts";
import { getAlbum } from "./data.ts";
import { AlbumPage } from "./show-page.tsx";

export default createController(routes.albums, {
  actions: {
    async show(context) {
      let album = await getAlbum(context.params.albumId);
      if (album === undefined) {
        return new Response("Album not found", { status: 404 });
      }
      return context.render(<AlbumPage album={album} />);
    },
  },
});
```

album data를 표시하도록 `AlbumPage` component를 수정하자.

```tsx
import type { Handle } from "remix/ui";
import type { Album } from "./data.ts";
import { Document } from "../../ui/document.tsx";

export function AlbumPage(handle: Handle<{ album: Album }>) {
  return () => {
    let { album } = handle.props;

    return (
      <Document title={`${album.title} — Albums`}>
        <main>
          <p>
            {album.artist} · {album.year}
          </p>
          <h1>{album.title}</h1>
        </main>
      </Document>
    );
  };
}
```

이제 페이지는 album title, artist, year를 표시한다.

`css` function과 `mix` prop으로 가운데 정렬하고 약간의 spacing을 추가하자. Rendering UI 챕터에서는
이 helper와 prop을 더 자세히 다룬다.

```tsx
import type { Handle } from "remix/ui";
import { css } from "remix/ui";
import type { Album } from "./data.ts";
import { Document } from "../../ui/document.tsx";

export function AlbumPage(handle: Handle<{ album: Album }>) {
  return () => {
    let { album } = handle.props;

    return (
      <Document title={`${album.title} — Albums`}>
        <main
          mix={css({
            maxWidth: "44rem",
            margin: "0 auto",
            padding: "4rem 1.5rem",
          })}
        >
          <p mix={css({ color: "#666" })}>
            {album.artist} · {album.year}
          </p>
          <h1>{album.title}</h1>
        </main>
      </Document>
    );
  };
}
```

`http://localhost:44100/albums/thriller`를 다시 열어보자. 같은 URL이 이제 album page를 반환한다.

## Build your first form action

이제 album을 가져와 표시할 수 있다. 다음으로 form과 그것을 update할 수 있는 POST action을 추가하자.

`routes.ts`로 돌아가 `form()` route helper를 사용한다. 이것은 같은 URL에 두 routes를 만든다. form을
보여주는 GET route와 submission을 처리하는 POST route다.

```ts
import { form, get, route } from "remix/routes";

export const routes = route({
  assets: get("/assets/*path"),
  home: "/",
  albums: {
    show: get("/albums/:albumId"),
    edit: form("/albums/:albumId/edit"),
  },
});
```

이 경우 `form("/albums/:albumId/edit")`는 다음을 만든다.

- `routes.albums.edit.index`: `GET /albums/:albumId/edit`
- `routes.albums.edit.action`: `POST /albums/:albumId/edit`

`albums.edit`은 nested route map이므로 controller와 form module을 둘 `edit/` directory를 만든다.

```sh
mkdir app/actions/albums/edit
touch app/actions/albums/edit/controller.tsx app/actions/albums/edit/page.tsx
```

controller를 scaffold한다.

```tsx
import { createController } from "remix/router";
import { routes } from "../../../routes.ts";

export default createController(routes.albums.edit, {
  actions: {
    async index() {
      return new Response();
    },
    async action() {
      return new Response();
    },
  },
});
```

그리고 router에도 map한다.

```ts
import { createRouter, type RouterContext } from "remix/router";
import { staticFiles } from "remix/middleware/static";
import controller from "./actions/controller.tsx";
import albumsController from "./actions/albums/controller.tsx";
import albumsEditController from "./actions/albums/edit/controller.tsx";
import { render } from "./middleware/render.tsx";
import { routes } from "./routes.ts";

// ...
router.map(routes, controller);
router.map(routes.albums, albumsController);
router.map(routes.albums.edit, albumsEditController);
```

이제 form page를 만들 수 있다. 기존 data를 표시하고 edit action으로 POST request를 보내는 아주
간단한 form이다.

```tsx
import { css } from "remix/ui";
import type { Handle } from "remix/ui";
import { routes } from "../../../routes.ts";
import { Document } from "../../../ui/document.tsx";
import type { Album } from "../data.ts";

export function AlbumEditPage(handle: Handle<{ album: Album }>) {
  return () => {
    let { album } = handle.props;

    return (
      <Document title={`Edit ${album.title} — Albums`}>
        <main mix={css({ padding: "1rem" })}>
          <h1>Edit {album.title}</h1>
          <form
            action={routes.albums.edit.action.href({ albumId: album.id })}
            method="post"
            mix={css({
              display: "grid",
              gap: "0.75rem",
              maxWidth: "fit-content",
              "& input": {
                marginLeft: "0.5rem",
              },
            })}
          >
            <label>
              Title
              <input name="title" defaultValue={album.title} required />
            </label>
            <label>
              Artist
              <input name="artist" defaultValue={album.artist} required />
            </label>
            <label>
              Year
              <input name="year" defaultValue={album.year} required type="number" />
            </label>
            <button type="submit">Save album</button>
          </form>
        </main>
      </Document>
    );
  };
}
```

새 form을 보려면 controller의 `index` action에 component를 연결한다.

```tsx
import { createController } from "remix/router";
import { routes } from "../../../routes.ts";
import { getAlbum } from "../data.ts";
import { AlbumEditPage } from "./page.tsx";

export default createController(routes.albums.edit, {
  actions: {
    async index(context) {
      let album = await getAlbum(context.params.albumId);
      if (album === undefined) {
        return new Response("Album not found", { status: 404 });
      }
      return context.render(<AlbumEditPage album={album} />);
    },
    async action() {
      return new Response("Not implemented", { status: 501 });
    },
  },
});
```

`http://localhost:44100/albums/thriller/edit`를 열면 album data가 채워진 HTML form이 반환된다.

POST request를 처리하기 전에 `app/router.ts`에 form-data middleware를 추가한다. 이것은 browser form
body를 한 번 parsing하고 route actions에서 `FormData`를 사용할 수 있게 한다.

```ts
import { createRouter, type RouterContext } from "remix/router";
import { formData } from "remix/middleware/form-data";
import { staticFiles } from "remix/middleware/static";

// ...
export const router = createRouter({
  middleware: [staticFiles("./public", { index: false }), formData(), render()],
});

export type AppContext = RouterContext<typeof router>;

declare module "remix/router" {
  interface RouterTypes {
    context: AppContext;
  }
}

// ...
```

또한 raw `FormData`를 album update 전에 typed values로 바꾸기 위해 `remix/data-schema/form-data`를
사용한다. `remix/data-schema`는 여러 종류의 데이터를 validate하고 parse하기 위한 Remix 내장
library다. Data and Validation 챕터에서 더 자세히 다룬다.

```tsx
import { createController } from "remix/router";
import * as s from "remix/data-schema";
import * as f from "remix/data-schema/form-data";
import * as coerce from "remix/data-schema/coerce";
import { redirect } from "remix/response/redirect";
import { routes } from "../../../routes.ts";
import { getAlbum, updateAlbum } from "../data.ts";
import { AlbumEditPage } from "./page.tsx";

const albumFormSchema = f.object({
  artist: f.field(s.string()),
  title: f.field(s.string()),
  year: f.field(coerce.number()),
});

export default createController(routes.albums.edit, {
  actions: {
    async index(context) {
      let album = await getAlbum(context.params.albumId);
      if (album === undefined) {
        return new Response("Album not found", { status: 404 });
      }
      return context.render(<AlbumEditPage album={album} />);
    },
    async action({ formData, params }) {
      let result = s.parseSafe(albumFormSchema, formData);
      if (!result.success) {
        return new Response("Invalid album data", { status: 400 });
      }

      let album = await updateAlbum(params.albumId, result.value);
      if (album === undefined) {
        return new Response("Album not found", { status: 404 });
      }

      return redirect(routes.albums.show.href({ albumId: album.id }), 303);
    },
  },
});
```

action route action은 parsed Web `FormData`를 validate하고, invalid input이나 missing album에 대해
명시적인 response를 반환하며, update 성공 후 album page로 redirect한다. Data and Validation 챕터는
field-level validation errors를 form에 다시 render하는 방법을 보여준다.

이제 album data를 update하고 올바른 year로 설정할 수 있다.

Routing and Controllers와 Data and Validation 챕터에서는 request handling, validation,
database-backed mutations를 더 깊게 다룬다.

## Add your first hydrated component

album 저장에 시간이 조금 걸린다는 것을 눈치챘을 수도 있다. 느린 연결이나 서버에서 멀리 떨어진
사용자가 경험할 수 있는 상황처럼, 1초의 simulated latency를 추가했기 때문이다. 아주 나쁜 loading
experience는 아니지만 더 좋게 만들 수 있다.

지금까지는 browser에서 JavaScript를 전혀 사용하지 않았다. 여기까지의 모든 것은 server-side
JavaScript다. component조차 서버에서 render되어 HTML로 stream된다.

사용자에게 form submission이 pending 중임을 알리고 싶다면 browser JavaScript를 조금 가져와야 한다.
Remix에서 이를 하는 가장 쉬운 방법은 component를 `clientEntry(...)`로 감싸는 것이다. component는
여전히 서버에서 render되지만, browser에 도착하면 Remix가 hydrate하고 user interaction에 반응하며
다른 server response를 기다리지 않고 component를 update할 수 있다.

먼저 form을 위한 route-local browser module을 만든다.

```sh
touch app/actions/albums/edit/album-edit-form.browser.tsx
```

`.browser.ts` 또는 `.browser.tsx`로 끝나는 파일은 browser-loadable module이다. template의 asset
server는 이미 `app/` 아래의 matching files를 serve하도록 설정되어 있으므로, server-rendered component가
client entry가 되면 Remix는 source file을 browser module URL로 바꿀 수 있다. template은 또한 Remix UI
client runtime을 browser에서 시작하는 `app/entry.browser.ts`를 이미 load한다. Files and Assets 챕터는
bundlerless 접근 방식과 `remix/assets`가 어떻게 동작하는지 더 깊게 다룬다.

form이 위치할 장소가 생겼으니, form을 자체 component로 분리하자.

```tsx
import { css } from "remix/ui";
import type { Handle } from "remix/ui";
import type { Album } from "../data.ts";
import { routes } from "../../../routes.ts";

export function AlbumEditForm(handle: Handle<{ album: Album }>) {
  return () => {
    let { album } = handle.props;

    return (
      <form
        action={routes.albums.edit.action.href({ albumId: album.id })}
        method="post"
        mix={css({
          display: "grid",
          gap: "0.75rem",
          maxWidth: "fit-content",
          "& input": {
            marginLeft: "0.5rem",
          },
        })}
      >
        <label>
          Title
          <input name="title" defaultValue={album.title} required />
        </label>
        <label>
          Artist
          <input name="artist" defaultValue={album.artist} required />
        </label>
        <label>
          Year
          <input name="year" defaultValue={album.year} required type="number" />
        </label>
        <button type="submit">Save album</button>
      </form>
    );
  };
}
```

edit page가 이 새 `AlbumEditForm` component를 render하도록 수정한다.

```tsx
import type { Handle } from "remix/ui";
import { css } from "remix/ui";
import { AlbumEditForm } from "./album-edit-form.browser.tsx";
import { Document } from "../../../ui/document.tsx";
import type { Album } from "../data.ts";

export function AlbumEditPage(handle: Handle<{ album: Album }>) {
  return () => {
    let { album } = handle.props;

    return (
      <Document title={`Edit ${album.title} — Albums`}>
        <main mix={css({ padding: "1rem" })}>
          <h1>Edit {album.title}</h1>
          <AlbumEditForm album={album} />
        </main>
      </Document>
    );
  };
}
```

모든 것은 이전처럼 보일 것이다.

다음으로 form을 client entry로 표시한다. `import.meta.url`은 asset server에게 어떤 source file을
browser-loadable module로 바꿔야 하는지 알려준다.

```tsx
import { clientEntry, css } from "remix/ui";
import type { Handle } from "remix/ui";
import type { Album } from "../data.ts";
import { routes } from "../../../routes.ts";

export const AlbumEditForm = clientEntry(
  import.meta.url,
  function AlbumEditForm(handle: Handle<{ album: Album }>) {
    // ...
  },
);
```

페이지는 여전히 같은 모습과 동작을 가져야 한다. `clientEntry(...)`는 Remix에게 form을 서버에서
render하고, props를 serialize하며, client runtime이 시작될 때 이 component를 browser에서 hydrate하라고
알릴 뿐이다.

이제 form이 browser에서 실행될 수 있으므로 pending state를 추가할 수 있다. Remix의 state는 그냥
변수다. setup scope에 state로 사용할 변수, 여기서는 `let pending`을 만든다.

```tsx
// ...
export const AlbumEditForm = clientEntry(
  import.meta.url,
  function AlbumEditForm(handle: Handle<{ album: Album }>) {
    let pending = false;

    return () => {
      // ...
    };
  },
);
```

form이 submit되면 `pending` 변수를 `false`에서 `true`로 바꾸고 `handle.update()`를 호출한다.
`handle.update()`는 Remix UI에게 이 component를 새 local state로 다시 render하라고 알려준다. submit을
listen하기 위해 `on` helper로 event listener를 추가하고, `mix` prop에 array를 전달한다.

```tsx
import { clientEntry, css, on } from "remix/ui";
import type { Handle } from "remix/ui";
import type { Album } from "../data.ts";
import { routes } from "../../../routes.ts";

export const AlbumEditForm = clientEntry(
  import.meta.url,
  function AlbumEditForm(handle: Handle<{ album: Album }>) {
    let pending = false;

    return () => {
      let { album } = handle.props;

      return (
        <form
          action={routes.albums.edit.action.href({ albumId: album.id })}
          method="post"
          mix={[
            css({ display: "grid", gap: "0.75rem", maxWidth: "fit-content" }),
            on("submit", () => {
              pending = true;
              handle.update();
            }),
          ]}
        >
          {/* ... */}
          <button disabled={pending} type="submit">
            {pending ? "Saving…" : "Save album"}
          </button>
        </form>
      );
    };
  },
);
```

이제 form을 submit하면 button이 disabled되고 button text가 “Saving…”으로 바뀐다.

full page navigation을 피하기 위해 더 많은 것을 할 수도 있지만, 그러려면 cancellations, error states
등을 다뤄야 한다. Interactivity 챕터에서는 client entries, events, progressive enhancement를 더
자세히 다룬다.

다음으로 Routing and Controllers는 여기서 사용하기 시작한 route leaves, nested maps, controllers를
더 자세히 살펴본다.
