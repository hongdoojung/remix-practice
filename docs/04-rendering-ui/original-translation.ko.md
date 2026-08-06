# Rendering UI 원문 한국어 번역

원문: [Rendering UI | Remix Docs](https://guides.remix.run/rendering-ui/)
라이선스: Remix Docs 페이지 하단의 “docs and examples licensed under MIT” 표기를 기준으로 번역 및 정리했다.

프로젝트 적용 실습은 [`practice-guide.ko.md`](./practice-guide.ko.md)에서 다룬다.

## Rendering UI

앞 장에서 우리는 action이 `context.render(...)`를 호출할 수 있도록 middleware stack에 `render()`를
추가했다. 이번 장은 그 함수를 사용해 Remix component로 page를 만들고, 이어서 document shell, style,
first-party UI를 더한다.

Component model은 server와 browser에서 동일하다. Page의 일부가 event를 처리하거나 browser API를
사용하지 않는 한, page는 browser JavaScript를 필요로 하지 않는다. 그 layer는 Interactivity 장에서
추가한다.

## Remix component model

Remix component는 render function을 반환하는 setup function이다. Setup은 Remix가 component를 만들 때
한 번 실행된다. Render는 setup 직후에 실행되고, 이후 component가 update될 때마다 다시 실행된다.

`app/ui/album-heading.tsx`

```tsx
import type { Handle } from "remix/ui";

type AlbumHeadingProps = {
  artist: string;
  title: string;
};

export function AlbumHeading(handle: Handle<AlbumHeadingProps>) {
  // Setup: 이 component instance마다 한 번 실행된다.

  return () => {
    // Render: 최초 render와 모든 update에서 실행된다.
    return (
      <header>
        <p>{handle.props.artist}</p>
        <h1>{handle.props.title}</h1>
      </header>
    );
  };
}
```

Component는 `<AlbumHeading artist="..." title="..." />`처럼 JSX로 render한다. Runtime은 component
instance를 만들고 그 setup scope를 유지하며, component가 update될 때 render function을 다시 호출한다.

Render function은 `RemixNode`를 반환한다. 여기에는 `<main>` 같은 host element, 다른 Remix component,
string, number, boolean, `null`, `undefined`, 그리고 이 값들의 중첩 배열이 포함된다. Fragment를 쓰면
DOM element를 추가하지 않고 형제 node를 반환할 수 있다.

`app/ui/album-byline.tsx`

```tsx
import type { Handle } from "remix/ui";

export function AlbumByline(handle: Handle<{ artist: string; year: number }>) {
  return () => (
    <>
      <span>{handle.props.artist}</span>
      <span>{handle.props.year}</span>
    </>
  );
}
```

같은 component가 server에서 HTML로 render되고, client 전용 root에 mount되고, server-rendered page 안에서
hydrate될 수 있다. 이 중 뒤의 두 경우만 browser에서 실행된다.

> 원문에는 이 지점에 “component model demo”가 있다. 두 개의 `Counter` component가 각각 setup scope의
> `count`를 올리고 `handle.update()`를 호출하는 interactive 예제이며, 이 문서에는 코드만 옮긴다.

```tsx
import { css, on } from "remix/ui";
import type { Handle } from "remix/ui";

export function ComponentModelDemo() {
  return () => (
    <div mix={counterDemoStyles}>
      <Counter initialCount={2} label="Inbox" />
      <Counter initialCount={8} label="Deploys" />
    </div>
  );
}

function Counter(handle: Handle<{ initialCount: number; label: string }>) {
  let count = handle.props.initialCount;

  return () => (
    <button
      mix={[
        counterStyles,
        on("click", () => {
          count++;
          handle.update();
        }),
      ]}
      type="button"
    >
      <span mix={counterValueStyles}>{count}</span>
      <span>{handle.props.label}</span>
    </button>
  );
}
```

## Props, local state, context, update

모든 component는 `Handle`을 받는다. `handle.props`는 stable object이고 그 property 값은 render 직전에
교체된다. 그래서 callback과 render 출력은 항상 이 object에서 현재 값을 읽어야 한다. Object 자체를
destructuring하는 것은 안전하다. 하지만 setup에서 property 하나를 destructuring하면 초기 값만 붙잡게 된다.

```tsx
import type { Handle } from "remix/ui";

function AlbumTitle(handle: Handle<{ title: string }>) {
  let { props } = handle;
  let initialTitle = props.title;

  return () => <h1 title={`Originally ${initialTitle}`}>{props.title}</h1>;
}
```

Local state는 setup scope에 선언한 평범한 JavaScript다. Rendering에 영향을 주는 값을 저장하고, 나머지는
render 안에서 파생시킨다.

`app/ui/album-list.tsx`

```tsx
import { on } from "remix/ui";
import type { Handle } from "remix/ui";

type Album = {
  id: string;
  title: string;
  year: number;
};

export function AlbumList(handle: Handle<{ albums: Album[] }>) {
  let filter = "";

  return () => {
    let visibleAlbums = handle.props.albums.filter((album) =>
      album.title.toLowerCase().includes(filter.toLowerCase()),
    );

    return (
      <div>
        <input
          aria-label="Filter albums"
          mix={on("input", (event) => {
            filter = event.currentTarget.value;
            handle.update();
          })}
          type="search"
        />
        <ul>
          {visibleAlbums.map((album) => (
            <li key={album.id}>{album.title}</li>
          ))}
        </ul>
      </div>
    );
  };
}
```

Input handler는 `filter`를 바꾸고 `handle.update()`를 호출한다. Update는 명시적이다. 변수를 바꾸는 것만
으로는 아무것도 render되지 않고, component가 update를 요청해야 한다. 안정적인 `key` 값은 render 사이에
어떤 list item이 같은 항목인지 Remix에 알려주며, list 순서가 바뀌어도 DOM과 component state가 유지된다.
Event handler, update, hydration은 Interactivity 장에서 다룬다.

`handle.id`는 component instance의 안정적인 식별자다. 재사용 가능한 control이 label, input, description,
ARIA 관계를 연결해야 하는데 `id` prop을 받고 싶지 않을 때 유용하다.

```tsx
import type { Handle } from "remix/ui";

function AlbumSearch(handle: Handle) {
  return () => (
    <div>
      <label htmlFor={handle.id}>Search albums</label>
      <input id={handle.id} name="query" type="search" />
    </div>
  );
}
```

Component context는 descendant가 값을 필요로 하지만 그 값이 중간 component 전부에 속하지는 않을 때 쓴다.
Provider의 type이 곧 context key이므로 `get()`은 계속 typed 상태로 남는다.

`app/ui/catalog.tsx`

```tsx
import type { Handle, RemixNode } from "remix/ui";

type CatalogContext = {
  currency: "USD" | "EUR";
};

export function Catalog(handle: Handle<{ children?: RemixNode }, CatalogContext>) {
  handle.context.set({ currency: "USD" });

  return () => handle.props.children;
}

export function AlbumPrice(handle: Handle<{ amount: number }>) {
  let catalog = handle.context.get(Catalog);

  return () => (
    <span>
      {catalog.currency} {handle.props.amount.toFixed(2)}
    </span>
  );
}
```

`handle.context.set(...)`는 값을 저장하지만 update를 예약하지는 않는다. Browser에서 값이 바뀌는 context는
provider를 update하거나 `TypedEventTarget`을 사용해서, 변경을 듣는 consumer만 update되게 한다.

## Request context를 통해 page render하기

우리 album controller는 이미 `context.render(...)`로 page를 반환한다.

`app/actions/albums/controller.tsx`

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

생성된 app은 render middleware를 한 번 설치하므로, 일반적인 action은 `context.render(...)`만 호출한다.
Render된 page에 status나 header가 필요하면 `ResponseInit`을 함께 넘길 수 있다.

```tsx
return context.render(<AlbumPage album={album} />, {
  status: 404,
  headers: { "Cache-Control": "no-store" },
});
```

대부분의 component는 middleware가 자신의 tree를 어떻게 response로 바꾸는지 알 필요가 없다. 그 아래의
server renderer와, route가 소유한 영역을 독립적으로 로드하는 optional `<Frame>` API는 Streaming UI with
Frames 장에서 다룬다.

## Document shell, head content, HTML response

Page는 하나의 공유 component를 통해 완전한 document를 render해야 한다. 기본 app은 이 component를
`app/actions/document.tsx`에 둔다.

`app/actions/document.tsx`

```tsx
import type { Handle, RemixNode } from "remix/ui";

import { entryHref, entryPreloads } from "../assets.ts";

export interface DocumentProps {
  children?: RemixNode;
  head?: RemixNode;
  title?: string;
}

export function Document(handle: Handle<DocumentProps>) {
  return () => {
    let { children, head, title = "Albums" } = handle.props;

    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
          <title>{title}</title>
          {head}
          {entryPreloads.map((href) => (
            <link key={href} rel="modulepreload" href={href} />
          ))}
          <script type="module" src={entryHref}></script>
        </head>
        <body>{children}</body>
      </html>
    );
  };
}
```

`title`, `meta`, `link`, `style` element는 document의 명시적인 `<head>` 안에 두고, global stylesheet,
module preload, icon, browser entry script도 같이 둔다. Entry href와 그 module graph는 component에서
asset URL을 조립하는 대신 `app/assets.ts`에서 한 번만 resolve한다.

Renderer는 이 tree를 `createHtmlResponse()`에 넘긴다. 이 helper는 이미 있는 doctype을 보존하거나
`<!DOCTYPE html>`을 앞에 붙이고, action이 직접 지정하지 않았다면 `Content-Type: text/html; charset=UTF-8`을
설정한 뒤 평범한 Web `Response`를 반환한다.

## css와 동적 style 값으로 styling하기

정적인 rule에는 `css(...)`를 쓴다. Pseudo-selector, pseudo-element, descendant/attribute selector, media
query를 일반적인 CSS nesting 문법으로 지원한다.

`app/ui/album-card.tsx`

```tsx
import { css } from "remix/ui";
import type { Handle } from "remix/ui";

const cardStyle = css({
  border: "1px solid #d6d6d6",
  borderRadius: "12px",
  padding: "1rem",
  transition: "border-color 120ms ease",
  "&:hover": {
    borderColor: "#6d28d9",
  },
  "& .title": {
    marginBlock: "0 0.25rem",
  },
  "@media (max-width: 40rem)": {
    borderRadius: 0,
  },
});

export function AlbumCard(handle: Handle<{ soldOut: boolean; title: string }>) {
  return () => (
    <article mix={cardStyle} style={{ opacity: handle.props.soldOut ? 0.55 : 1 }}>
      <h2 class="title">{handle.props.title}</h2>
      <p>{handle.props.soldOut ? "Sold out" : "In stock"}</p>
    </article>
  );
}
```

`css(...)` 호출은 생성된 class와 정적인 rule을 만든다. Progress, 좌표, opacity, transform처럼 update마다
바뀔 수 있는 값에는 `style` prop이 더 낫다. 그런 값을 `css(...)`에 넣으면 값마다 새로운 rule이 생성된다.

Server rendering 동안 Remix는 생성된 rule을 모아 중복을 제거하고 `<style data-rmx>` tag를 document head에
넣는다. Server-rendered page는 component style을 받기 위해 browser JavaScript를 기다리지 않는다.

> 원문에는 nested CSS selector가 hover 시 title과 button 색을 바꾸는 product card demo가 있다.

## Cascade layer와 app이 소유하는 design token

`css(...)`로 생성된 rule은 first-party UI component의 style을 포함해 native `rmx` cascade layer에 들어간다.
App이 자체 layer를 쓴다면 전체 순서를 한 번 선언한다.

`app/actions/public/app.css`

```css
@layer base, rmx, app;

@layer base {
  :root {
    --color-accent: #6d28d9;
    --space-page: clamp(1rem, 4vw, 3rem);
  }

  body {
    margin: 0;
    font-family: system-ui, sans-serif;
  }
}

@layer app {
  .album-grid {
    display: grid;
    gap: var(--space-page);
  }
}
```

`rmx`보다 앞선 layer는 Remix component style이 덮어쓸 수 있는 기본값을 제공한다. `rmx` 뒤의 layer는
component style을 의도적으로 덮어쓸 수 있다. Layer가 없는 author CSS는 layer가 붙은 일반 CSS보다 우선하므로,
app에 명시적인 layer 순서가 있다면 unlayered CSS는 의도적으로만 사용한다.

Remix는 동작과 소수의 component style을 제공하지, application theme을 제공하지 않는다. Brand color, spacing,
typography, radius 같은 design token은 app이 소유하는 CSS custom property나 TypeScript 값으로 유지한다.

## First-party UI building block

`remix/ui/*` subpath는 세 단계의 소유권을 다룬다. 제품 markup에 맞는 가장 상위 API에서 시작하고, 그 조합된
component가 노출하지 않는 제어가 필요할 때만 아래 단계로 내려간다.

이 API들은 모두 server에서 render된다. Browser event를 처리하는 control은 직접이든 interactive ancestor를
통해서든 `clientEntry(...)` 경계 안에 있어야 한다. 그 경계를 고르는 방법은 다음 장에서 다룬다.

| 단계 | Subpath | App이 소유하는 것 |
| --- | --- | --- |
| Style mixin | `button`, `input`, `checkbox`, `radio`, `toggle` | native control, label, layout, state |
| Composed control | `accordion`, `breadcrumbs`, `combobox`, `menu`, `select`, `tabs` | 주변 page와 control에 넘기는 값 |
| Headless primitive | `popover`, `listbox`, `anchor`, 각 `/primitives` subpath | markup과 styling. Remix는 좁은 범위의 동작만 제공 |

### Native control을 위한 style mixin

Style mixin은 native form 동작을 우리가 render하는 element에 그대로 남긴다.

`app/ui/album-actions.tsx`

```tsx
import button from "remix/ui/button";
import checkbox from "remix/ui/checkbox";
import { css } from "remix/ui";

const actionRowStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "0.75rem",
});

export function AlbumActions() {
  return () => (
    <div mix={actionRowStyle}>
      <button mix={button({ tone: "primary" })}>Add to cart</button>
      <label>
        <input mix={checkbox()} name="gift" type="checkbox" />
        This is a gift
      </label>
    </div>
  );
}
```

Checkbox는 여전히 checkbox이고, `FormData`에 참여하며, keyboard 동작을 browser에서 얻는다. Mixin은 시각적
표현만 제공한다. Host에 app이 소유한 style이나 동작도 필요하면 `mix`에 배열을 넘겨 조합한다.

> 원문에는 `button` mixin의 tone(neutral/primary/ghost)과 size를 보여주는 demo가 있다.

### 흔한 상호작용을 위한 composed control

Composed control은 여러 element 사이의 관계를 소유한다. 예를 들어 `Accordion`은 trigger와 content region을
연결하고 disclosure state를 관리한다.

`app/ui/shipping-details.tsx`

```tsx
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "remix/ui/accordion";

export function ShippingDetails() {
  return () => (
    <Accordion defaultValue="returns">
      <AccordionItem value="delivery">
        <AccordionTrigger>Delivery</AccordionTrigger>
        <AccordionContent>Ships in two business days.</AccordionContent>
      </AccordionItem>
      <AccordionItem value="returns">
        <AccordionTrigger>Returns</AccordionTrigger>
        <AccordionContent>Return unopened albums within 30 days.</AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
```

Control이 초기 state를 스스로 소유해야 하면 `default*` prop을 쓴다. 부모가 그 state를 소유해야 하면 대응하는
controlled prop과 change callback을 쓴다. 이름은 component마다 다르다. Accordion은
`defaultValue`/`value`를, tabs는 `defaultActiveTab`/`activeTab`을 쓴다.

Selection과 disclosure event는 각 component API가 문서화한 곳에서 bubbling되므로, 부모는 모든 item에 callback을
꿰지 않고도 변경을 관찰할 수 있다. `Select`와 `Combobox`처럼 `name`을 받는 control은 hidden input을 render해서
선택된 값이 일반 form에 참여하게 한다. Disabled state, accessible name, focus 이동, keyboard 동작은 각 component
contract의 일부로 남는다.

> 원문에는 accordion overview demo와 select overview demo가 있다.

### Custom markup을 위한 headless primitive

Primitive는 색이나 spacing이 아니라 markup 자체가 달라야 할 때 선택한다. `popover`는 anchored surface 동작을,
`listbox`는 option highlight와 selection을, `anchor`는 더 낮은 수준의 floating element 배치를 제공한다.
Accordion, combobox, menu, select, tabs, toggle도 `/primitives` subpath를 노출한다.

Primitive는 더 작지만 app이 더 많은 책임을 진다. 맞는 곳에서는 native element를 유지하고, label과 ARIA 관계를
그대로 두고, pointer와 keyboard 동작을 테스트한다. 예를 들어 custom select도 form에 참여하려면 provider,
trigger, popover, list, option, hidden input이 모두 필요하다.

> 원문에는 accordion primitives를 직접 조립한 demo가 있다.

## Component runtime 없이 HTML render하기

모든 HTML response가 component tree를 필요로 하지는 않는다. `remix/html-template`은 feed, mail body, 작은
fragment 같은 string 중심 출력을 위해 escape된 `SafeHtml` 값을 만든다.

`app/actions/albums/feed.ts`

```ts
import { html } from "remix/html-template";
import { createHtmlResponse } from "remix/response/html";

import { routes } from "../../routes.ts";

export function renderAlbumFeed(albums: Array<{ id: string; title: string }>) {
  let items = albums.map((album) => {
    let href = routes.albums.show.href({ albumId: album.id });
    return html`<li><a href="${href}">${album.title}</a></li>`;
  });

  return createHtmlResponse(html`
    <html lang="en">
      <head>
        <title>Album feed</title>
      </head>
      <body>
        <ul>
          ${items}
        </ul>
      </body>
    </html>
  `);
}
```

보간된 string은 escape되고, 중첩된 `SafeHtml` fragment는 두 번 escape되지 않고 조합된다. `html.raw`는 app이
이미 신뢰하는 markup에만 쓰며, 사용자 입력을 절대 넘기지 않는다.

일반적인 page에서는 component가 조합, server rendering, 그리고 browser interactivity로 가는 경로를 제공한다.
다음 장에서는 가장 작은 interactive component를 `clientEntry(...)`로 표시하고, server response 경로를 대체하지
않은 채 hydrate한다.
