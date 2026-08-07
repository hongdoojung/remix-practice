# Interactivity 원문 한국어 번역

원문: [Interactivity | Remix Docs](https://guides.remix.run/interactivity/)
라이선스: Remix Docs 페이지 하단의 “docs and examples licensed under MIT” 표기를 기준으로 번역 및 정리했다.

프로젝트 적용 실습은 [`practice-guide.ko.md`](./practice-guide.ko.md)에서 다룬다.

## Interactivity

Start Here 장에서 album page, edit form, validation, mutation, redirect는 browser JavaScript를 추가하기
전에 이미 동작했다. 그다음 우리는 form을 client entry로 표시해서 submit button이 pending state를 보여줄 수
있게 했다.

이번 장은 server-rendered component에 browser 동작을 더한다. Component를 hydration 대상으로 표시하고,
browser runtime을 시작하고, local UI state를 update하고, event를 처리하고, 오래된 async 작업을 취소하고,
link와 form을 향상시킨다. Application state와 business rule은 component가 평범한 TypeScript를 호출하게 하고,
component 자신의 state는 UI에 집중시킨다.

## Progressive enhancement

이미 server가 받아야 할 request를 서술하고 있는 link와 form에서 시작한다. 우리 album form에는 실제 action과
method가 있다.

`app/actions/albums/edit/public/album-edit-form.tsx`

```tsx
import type { Handle } from "remix/ui";

import { routes } from "../../../../routes.ts";

interface Album {
  artist: string;
  id: string;
  title: string;
  year: number;
}

export function AlbumEditForm(handle: Handle<{ album: Album }>) {
  return () => {
    let { album } = handle.props;

    return (
      <form action={routes.albums.edit.action.href({ albumId: album.id })} method="post">
        <label>
          Title
          <input defaultValue={album.title} name="title" required />
        </label>
        <label>
          Artist
          <input defaultValue={album.artist} name="artist" required />
        </label>
        <label>
          Year
          <input defaultValue={album.year} name="year" required type="number" />
        </label>
        <button type="submit">Save album</button>
      </form>
    );
  };
}
```

JavaScript가 없으면 browser는 `FormData`를 route에 POST한다. Action은 그것을 validate하고 album을 update한 뒤
redirect를 반환한다. JavaScript가 있으면 event handler가 같은 제출을 가로채서 pending UI를 더하거나 page의
일부를 다시 불러올 수 있다. Mutation과 모든 error response는 여전히 controller가 소유한다.

Navigation에도 같은 규칙을 적용한다. 먼저 쓸모 있는 `href`를 가진 anchor를 render하고, browser runtime이
가능할 때 same-origin navigation을 향상시키게 한다.

어떤 상호작용은 JavaScript가 있어야만 의미가 있다. 그래도 server는 그 주변의 유용한 content, navigation, form을
render할 수 있다. Page 전체를 browser code로 옮기는 대신, hydrate되는 component에 필요한 serializable data와
route URL을 넘긴다.

## clientEntry로 hydration 경계 정하기

`clientEntry(...)`는 browser에서 실행되어야 하는 가장 작은 component를 표시한다. Album edit page는 server 전용으로
남고 그 안의 form만 hydrate될 수 있다.

`app/actions/albums/edit/public/album-edit-form.tsx`

```tsx
import { clientEntry } from "remix/ui";
import type { Handle } from "remix/ui";

import { routes } from "../../../../routes.ts";

interface Album {
  artist: string;
  id: string;
  title: string;
  year: number;
}

export const AlbumEditForm = clientEntry(
  import.meta.url,
  function AlbumEditForm(handle: Handle<{ album: Album }>) {
    return () => {
      let { album } = handle.props;

      return (
        <form action={routes.albums.edit.action.href({ albumId: album.id })} method="post">
          {/* fields */}
        </form>
      );
    };
  },
);
```

Server에서 이 component는 여전히 평범한 component처럼 render된다. Browser에서는 Remix가 같은 component module을
불러와 server-rendered page의 props로 시작한다.

Client entry의 props는 server에서 browser로 건너가므로 serializable해야 한다. String, number, boolean, `null`,
`undefined`, plain object와 array, JSX element를 담을 수 있다. Function, class instance, custom prototype을 가진
database record 같은 불투명한 runtime 값은 넘기지 않는다.

습관적으로 page 전체가 아니라 interactive UI 주위에 경계를 둔다. 아래의 button이 hydrate된다고 해서 그 위의 정적
ancestor와 sibling까지 hydrate될 필요는 없다. Database, 인증된 사용자, request context는 server에 둔다. Client
entry에는 자신이 맡은 page 조각을 처리하는 데 필요한 초기 데이터, route URL, 그리고 browser에서 안전한 값만 넘긴다.

## run으로 browser runtime 시작하기

Document shell은 `app/actions/public/entry.ts`를 불러온다. 이 module은 `run()`을 한 번 호출한다.

`app/actions/public/entry.ts`

```ts
import { run } from "remix/ui";

let app = run({
  async loadModule(moduleUrl, exportName) {
    let module = await import(moduleUrl);
    return module[exportName];
  },
});

app.addEventListener("error", (event) => {
  console.error("Component error:", event.error);
});

await app.ready();
```

`loadModule`은 document에서 발견된 모든 client entry에 대해 지정된 component를 import한다.

반환된 app runtime에는 세 가지 lifecycle method가 있다.

- `app.ready()`는 최초 client entry들이 hydrate된 뒤 resolve된다.
- `app.flush()`는 대기 중인 component update를 동기적으로 적용한다. 주로 DOM을 즉시 관찰해야 하는 test와 통합에서
  유용하다.
- `app.dispose()`는 runtime의 component와 listener를 제거한다.

`run()`은 server-rendered page를 hydrate한다. 두 번째 application router가 아니다. Browser request는 여전히 해당
server 동작을 소유한 route action으로 간다.

Route가 소유한 영역을 독립적으로 로드하거나 다시 로드해야 하면 Streaming UI with Frames 장에서 optional
`resolveFrame` callback을 추가한다.

## createRoot로 client 전용 UI mount하기

Hydrate할 server-rendered component가 없을 때 `createRoot(container)`를 쓴다. 예를 들어 다른 application이 만든
container에 명령형 widget을 mount하는 경우다.

`app/actions/public/support-widget.tsx`

```tsx
import { createRoot } from "remix/ui";
import type { Handle } from "remix/ui";

function SupportWidget(_handle: Handle) {
  return () => <a href="/support">Contact support</a>;
}

let container = document.getElementById("support-widget");

if (container) {
  let root = createRoot(container);
  root.render(<SupportWidget />);

  window.addEventListener("pagehide", () => root.dispose(), { once: true });
}
```

Root는 그 container를 소유한다. `root.render(node)`는 tree를 예약하고, `root.flush()`는 대기 중인 작업을 동기적으로
적용하며, `root.dispose()`는 tree를 제거하고 cleanup을 실행한다. 일반적인 page UI는 server에서 시작해
`clientEntry(...)`를 써야 한다. 그렇지 않으면 사용자는 server가 render할 수 있었던 content를 보기 위해 JavaScript를
기다리게 된다.

## State, update, post-render task

Component-local UI state는 setup scope에 있다. Event handler에서 그 값을 바꾼 뒤 `handle.update()`를 호출한다.

```tsx
import { on } from "remix/ui";
import type { Handle } from "remix/ui";

function Counter(handle: Handle<{ initialCount: number }>) {
  let count = handle.props.initialCount;

  return () => (
    <button
      mix={on("click", () => {
        count++;
        handle.update();
      })}
      type="button"
    >
      Count: {count}
    </button>
  );
}
```

`count`는 setup scope에 있으므로 component의 props가 되지 않고도 render 사이에 살아남는다.

`handle.update()`는 작업을 예약하고 promise를 반환한다. 다음 단계가 update된 DOM을 필요로 하면 await한다.

```tsx
import { on, ref } from "remix/ui";
import type { Handle } from "remix/ui";

function RenameButton(handle: Handle) {
  let editing = false;
  let input: HTMLInputElement;

  return () => (
    <div>
      <button
        mix={on("click", async () => {
          editing = true;
          await handle.update();
          input.focus();
        })}
        type="button"
      >
        Rename
      </button>
      {editing && <input aria-label="Album title" mix={ref((node) => (input = node))} />}
    </div>
  );
}
```

이 promise는 `AbortSignal`로 resolve되지만, update 이후 또 다른 async 경계를 넘어 작업이 이어질 때만 그 signal을
붙잡으면 된다. Runtime은 `await handle.update()`와 그다음 동기 문장 사이에서 signal을 abort할 수 없으므로
`input.focus()`에는 signal 검사가 필요 없다. 이어지는 async 작업이 있다면 가능한 한 그 작업에 signal을 넘기고,
이후 `await` 뒤에 signal을 확인하고 계속한다.

```ts
// async event handler 안에서:
let signal = await handle.update();
let response = await fetch(href, { signal });
if (signal.aborted) return;

status = response.ok ? "saved" : "error";
handle.update();
```

`handle.queueTask(task)`는 다음 update의 commit 시점에 task를 실행한다. DOM 측정이나 다른 update가 그 flush의
일부여야 할 때 쓴다.

```ts
// `detailsSection`이 할당된 뒤 event handler 안에서:
showDetails = true;
handle.update();
handle.queueTask(() => {
  detailsSection.scrollIntoView({ block: "nearest" });
});
```

Queue된 task가 나중에 알아채도록 하려고 추가 state를 만들지 않는다. 작업을 소유한 event handler에서 시작하거나,
queue된 task를 그것이 관찰하는 prop 값에 직접 연결한다.

Update가 list를 바꿀 때는 언제나 key가 중요하다. 정렬 시 바뀌는 array index나 render 중 만든 무작위 값이 아니라
안정적인 ID를 쓴다. Key가 맞아야 Remix가 기존 DOM과 component instance를 옮길 수 있고, state가 엉뚱한 항목에
붙지 않는다.

> 원문에는 list를 뒤집고 섞으며 key 동작을 보여주는 `KeyedList` demo가 있다.

Setup scope 변수는 menu가 열려 있는지, 어떤 field에 focus가 있는지, request가 pending인지 같은 UI state를 담기에
적합하다. Business rule과 공유 application state는 component 밖의 평범한 TypeScript에 두고 event handler에서
호출한다.

## on으로 event 처리하기

`on(type, handler, capture?)`는 typed DOM event를 host element에 붙인다. Event의 `currentTarget`은 그 host에서
추론된다.

```tsx
import { on } from "remix/ui";
import type { Handle } from "remix/ui";

function AlbumForm(_handle: Handle) {
  return () => (
    <form
      mix={on("submit", (event) => {
        event.preventDefault();
        let formData = new FormData(event.currentTarget);
        console.log(formData.get("title"));
      })}
    >
      {/* fields */}
    </form>
  );
}
```

Native element와 native event를 우선한다. Button의 `click` event는 이미 pointer, touch, Enter, Space 활성화를
모두 다룬다. Form의 `submit` event는 submit button과 field에서의 Enter를 다룬다. 낮은 수준의 pointer/keyboard
event는 상호작용 자체가 그것을 요구할 때만 쓰고, platform이 이미 제공하는 동작을 다시 만들기 위해 쓰지 않는다.

어떤 event가 `window`나 `document`에 임시 listener를 붙인다면 그 listener에 별도의 cleanup signal을 주고 상호작용이
끝나거나 component가 disconnect될 때 정리한다.

`preventDefault()`는 향상된 경로가 browser의 일을 끝까지 대신할 때만 호출한다. Event handler가 단지 일반 form 제출
앞에 pending state만 더한다면 제출은 그대로 진행되게 둔다.

## Controlled input과 uncontrolled input

Uncontrolled input은 현재 값을 DOM에 유지하고 `defaultValue`가 초기 값을 준다. Controlled input은 현재 값을
component state에서 받는다. Input handler가 DOM 값을 그 state로 복사하고 component를 update한다.

`app/ui/public/title-inputs.tsx`

```tsx
import { on } from "remix/ui";
import type { Handle } from "remix/ui";

const initialTitle = "Thriller";

function TitleInputs(handle: Handle) {
  let title = initialTitle;

  return () => (
    <div>
      <p>
        <label>
          Uncontrolled <input defaultValue={initialTitle} />
        </label>
      </p>

      <p>
        <label>
          Controlled{" "}
          <input
            value={title}
            mix={on("input", (event) => {
              title = event.currentTarget.value;
              handle.update();
            })}
          />
        </label>
      </p>

      <button
        mix={on("click", () => {
          title = initialTitle;
          handle.update();
        })}
        type="button"
      >
        Reset controlled input
      </button>
    </div>
  );
}
```

타이핑하면 두 input 모두 바뀐다. Button을 누르면 controlled input만 초기화되는데, 그 `value`가 `title`에서 오기
때문이다. Uncontrolled input은 `defaultValue`가 초기 값만 적용하므로 DOM 값을 그대로 유지한다.

## mix로 동작 조합하기

`mix` prop은 재사용 가능한 동작과 style을 host element에 붙인다. Mixin 하나를 직접 넘기거나, 여러 개가 필요하면
배열로 넘긴다.

```tsx
import button from "remix/ui/button";
import { attrs, css, on, ref } from "remix/ui";
import type { Handle } from "remix/ui";

const saveButtonStyle = css({ minWidth: "8rem" });

function SaveButton(_handle: Handle) {
  return () => (
    <button
      mix={[
        button({ tone: "primary" }),
        saveButtonStyle,
        attrs({ type: "button" }),
        ref((node) => console.log("Mounted", node)),
        on("click", () => console.log("Save album")),
      ]}
    >
      Save
    </button>
  );
}
```

핵심 mixin은 host 수준에서 서로 다른 일을 한다.

- `on(...)`은 typed event handler를 붙인다.
- `ref(...)`는 element가 삽입될 때 setup을 실행하고 cleanup signal을 제공한다.
- `attrs(...)`는 명시적인 element prop을 대체하지 않으면서 기본 attribute를 제공한다.
- `link(...)`는 client navigation 동작과 link semantics를 더한다.
- `css(...)`는 정적인 생성 CSS를 적용한다.

Animation mixin도 같은 prop을 쓰며 Animation 장에서 다룬다. 자주 바뀌는 값은 정적 mixin을 매번 새로 만드는 대신
`style`, `value`, `checked`, ARIA attribute 같은 일반 prop에 둔다.

## DOM reference, global event, cleanup

`ref(...)`는 삽입된 DOM node와, 그 node가 제거될 때 abort되는 signal을 받는다. Observer와 element가 소유한
listener를 그 signal에 묶는다.

```tsx
import { ref } from "remix/ui";
import type { Handle } from "remix/ui";

function MeasuredPanel(handle: Handle) {
  let width = 0;

  return () => (
    <div
      mix={ref((node, signal) => {
        let observer = new ResizeObserver((entries) => {
          let entry = entries[0];
          if (!entry) return;
          width = Math.round(entry.contentRect.width);
          handle.update();
        });

        observer.observe(node);
        signal.addEventListener("abort", () => observer.disconnect());
      })}
    >
      Panel width: {width}px
    </div>
  );
}
```

Ref callback은 element가 삽입될 때 실행되며 component update마다 실행되지 않는다. Element가 조건부라면 그 ref의
signal은 “이 element만 사라질 때 멈춰야 하는 작업”에 알맞은 수명을 가진다.

`window`, `document`, media query 같은 `EventTarget` 값에는 `addEventListeners(target, signal, listeners)`를 쓴다.
Browser 전용 setup은 client commit 이후로 예약하고, component가 disconnect될 때 abort되는 `handle.signal`에 묶는다.

```tsx
import { addEventListeners, clientEntry } from "remix/ui";
import type { Handle } from "remix/ui";

export const ViewportWidth = clientEntry(import.meta.url, function ViewportWidth(handle: Handle) {
  let width: number | undefined;

  handle.queueTask(() => {
    width = window.innerWidth;
    addEventListeners(window, handle.signal, {
      resize() {
        width = window.innerWidth;
        handle.update();
      },
    });
    handle.update();
  });

  return () => <span>{width === undefined ? "Measuring…" : `${width}px`}</span>;
});
```

Setup을 예약하면 server rendering 중에 `window`를 읽는 것을 피할 수 있다. Client 전용 root라면 setup 자체가 browser
에서만 실행되므로 listener를 바로 등록해도 된다.

어떤 listener는 component보다 짧은 수명이 필요하다. 그 작업이 시작될 때 `AbortController`를 만들고 그 signal을
`addEventListeners(...)`에 쓰고, 작업이 끝나면 abort한다. Navigation이 임시 listener를 남기지 않도록
`handle.signal`에서도 abort한다.

## Async 작업과 cancellation

Remix는 async 작업에 그 작업을 만든 범위에 맞는 abort signal을 제공한다.

| Signal | Abort되는 시점 | 적합한 용도 |
| --- | --- | --- |
| `on(...)` handler의 두 번째 인자 | 같은 handler가 다시 실행되거나 element가 제거될 때 | 최신 event가 이전 작업을 대체해야 하는 request |
| Queue된 task의 인자 | Component가 다시 render되거나 disconnect될 때 | Prop에 연동된 loading과 post-render DOM 작업 |
| `handle.signal` | Component가 disconnect될 때 | Component 수명의 timer와 global listener |

가장 좁은 signal을 `fetch()`에 넘기고, signal을 받을 수 없는 await 뒤에는 signal을 확인한다. 아래 예제에서 server는
`routes.albums.search.href()`를 `searchHref`로 넘기고 route는 짧은 text 결과를 반환한다. Browser component는 endpoint를
하드코딩하지 않는다.

`app/ui/public/album-search.tsx`

```tsx
import { clientEntry, on } from "remix/ui";
import type { Handle } from "remix/ui";

export const AlbumSearch = clientEntry(
  import.meta.url,
  function AlbumSearch(handle: Handle<{ searchHref: string }>) {
    let error: string | undefined;
    let loading = false;
    let resultText = "";

    return () => (
      <div>
        <input
          aria-label="Search albums"
          mix={on("input", async (event, signal) => {
            let url = new URL(handle.props.searchHref, window.location.href);
            url.searchParams.set("query", event.currentTarget.value);
            error = undefined;
            loading = true;
            handle.update();

            try {
              let response = await fetch(url, { signal });
              if (!response.ok) {
                throw new Error(`Search failed with status ${response.status}`);
              }

              let nextResultText = await response.text();
              if (signal.aborted) return;

              resultText = nextResultText;
              loading = false;
              handle.update();
            } catch (caught) {
              if (signal.aborted) return;
              error = caught instanceof Error ? caught.message : "Search failed";
              loading = false;
              handle.update();
            }
          })}
          type="search"
        />
        {error ? <p role="alert">{error}</p> : null}
        {loading ? <p>Searching…</p> : null}
        {resultText ? <p>{resultText}</p> : null}
      </div>
    );
  },
);
```

다시 타이핑하면 이전 handler의 signal과 그 fetch가 abort된다. 오래된 query의 느린 응답이 더 새로운 결과를 덮어쓸 수
없다.

## Application logic은 component 밖에 둔다

Setup scope 변수는 component state를 쉽게 만들어 주지만, 그렇다고 component가 모든 rule의 올바른 주인이 되지는 않는다.
현재 UI를 서술하는 값(panel이 열려 있는지, 어떤 element가 focus를 받아야 하는지, request가 pending인지)은 component에
둔다. Application data와 operation은 component가 호출하는 평범한 TypeScript에 둔다.

작은 model이 그 경계를 구체적으로 만든다. 이 cart는 자신의 item과 수량 변경을 소유한다.

`app/ui/public/cart-model.ts`

```ts
import { TypedEventTarget } from "remix/ui";

export interface CartItem {
  id: string;
  quantity: number;
}

export class CartModel extends TypedEventTarget<{ change: Event }> {
  #items: CartItem[];

  constructor(items: readonly CartItem[]) {
    super();
    this.#items = [...items];
  }

  get itemCount(): number {
    return this.#items.reduce((total, item) => total + item.quantity, 0);
  }

  add(productId: string): void {
    let item = this.#items.find((item) => item.id === productId);

    this.#items = item
      ? this.#items.map((item) =>
          item.id === productId ? { ...item, quantity: item.quantity + 1 } : item,
        )
      : [...this.#items, { id: productId, quantity: 1 }];

    this.dispatchEvent(new Event("change"));
  }
}
```

Component는 serializable prop에서 model을 만들고, 변경을 듣고, details panel의 열림 state만 유지한다.

`app/ui/public/cart.tsx`

```tsx
import { addEventListeners, clientEntry, on } from "remix/ui";
import type { Handle } from "remix/ui";

import { CartModel, type CartItem } from "./cart-model.ts";

interface CartProps {
  initialItems: CartItem[];
  product: { id: string; name: string };
}

export const Cart = clientEntry(import.meta.url, function Cart(handle: Handle<CartProps>) {
  let cart = new CartModel(handle.props.initialItems);
  let detailsOpen = false;

  addEventListeners(cart, handle.signal, {
    change() {
      handle.update();
    },
  });

  return () => (
    <section>
      <button mix={on("click", () => cart.add(handle.props.product.id))} type="button">
        Add {handle.props.product.name}
      </button>
      <button
        aria-expanded={detailsOpen}
        mix={on("click", () => {
          detailsOpen = !detailsOpen;
          handle.update();
        })}
        type="button"
      >
        Cart ({cart.itemCount})
      </button>
      {detailsOpen ? <p>{cart.itemCount} items in your cart.</p> : null}
    </section>
  );
});
```

`addEventListeners()`가 model 변경을 `handle.update()`에 연결하고, `handle.signal`이 component가 disconnect될 때
구독을 제거한다. 여러 component가 같은 model을 쓴다면 가장 가까운 공통 client 경계에서 만들고 component context로
제공한다. Class instance는 `clientEntry(...)` prop으로 넘기지 않는다. 그 prop은 직렬화되기 때문이다.

이 분리는 각 test의 초점을 좁게 유지한다. Cart의 rule은 DOM 없이 테스트하고, details button과 render된 item 개수는
component와 DOM에 의존하므로 component test로 확인한다.

## Client navigation

Link에는 계속 실제 anchor를 쓴다. `run()`이 시작된 뒤에는 runtime이 browser의 Navigation API를 통해 same-origin
navigation을 향상시킬 수 있다. Cross-origin link, download, browser가 가로챌 수 없는 navigation은 평범한 document
request로 계속된다.

`app/ui/album-link.tsx`

```tsx
import type { Handle } from "remix/ui";

import { routes } from "../routes.ts";

function AlbumLink(handle: Handle<{ albumId: string; title: string }>) {
  return () => (
    <a href={routes.albums.show.href({ albumId: handle.props.albumId })}>{handle.props.title}</a>
  );
}
```

Navigation이 code에서 시작할 때는 `navigate(href, options)`를 쓴다. 전체 표면이 interactive한 card처럼 link처럼
동작해야 하는 HTML host에는 `link(href, options)`를 적용한다.

`app/ui/album-navigation.tsx`

```tsx
import { link, navigate, on } from "remix/ui";
import type { Handle } from "remix/ui";

import { routes } from "../routes.ts";

function AlbumNavigation(handle: Handle<{ albumId: string; title: string }>) {
  return () => {
    let href = routes.albums.show.href({ albumId: handle.props.albumId });

    return (
      <div>
        <article mix={link(href)}>{handle.props.title}</article>
        <button mix={on("click", () => navigate(href, { history: "replace" }))} type="button">
          Replace current album
        </button>
      </div>
    );
  };
}
```

Anchor가 아닌 host에서 `link(...)`는 `role="link"`를 더하고, 필요할 때 keyboard focus가 가능하게 만들고, Enter와
mouse/modifier-key 활성화를 처리하고, disabled host를 `aria-disabled`로 반영한다. Markup이 맞으면 anchor를 우선한다.
다른 host를 link처럼 동작하게 만드는 것이 UI의 의도적인 일부일 때 mixin을 쓴다.

Native anchor도 `link(...)`와 `navigate(...)` option에 대응하는 attribute로 frame 인식 navigation을 제어할 수 있다.

- `rmx-target`은 다시 로드할 frame 이름을 지정한다.
- `rmx-src`는 그 frame을 위해 fetch할 URL을 제공하며 `href`는 browser의 목적지로 남는다.
- `rmx-reset-scroll="false"`는 현재 scroll 위치를 유지한다.
- `rmx-document`는 가로채기를 끄고 browser가 전체 document navigation을 수행하게 한다.

이 attribute들은 Streaming UI with Frames 장에서 named frame과 함께 다룬다.

## fetch와 navigation으로 form 향상시키기

이제 두 번째 mutation API를 만들지 않고 album form을 향상시킬 수 있다. Handler는 form이 이미 가진 action, method,
`FormData`를 보내고 action의 redirect를 따라간다.

```tsx
// AlbumEditForm의 render function 안에서:
<form
  action={routes.albums.edit.action.href({ albumId: album.id })}
  method="post"
  mix={on("submit", async (event, signal) => {
    let form = event.currentTarget;
    event.preventDefault();
    error = undefined;
    pending = true;
    handle.update();

    try {
      let response = await fetch(form.action, {
        body: new FormData(form),
        method: form.method,
        signal,
      });

      if (signal.aborted) return;
      if (!response.ok) {
        error = await response.text();
        if (signal.aborted) return;
        pending = false;
        handle.update();
        return;
      }

      await navigate(response.url, { history: "replace" });
    } catch (caught) {
      if (signal.aborted) return;
      error = caught instanceof Error ? caught.message : "Unable to save album";
      pending = false;
      handle.update();
    }
  })}
>
  {/* 위 progressive enhancement form과 같은 field들 */}
  <button disabled={pending} type="submit">
    {pending ? "Saving…" : "Save album"}
  </button>
  {error ? <p role="alert">{error}</p> : null}
</form>
```

Controller action은 바뀌지 않았다. 향상되지 않은 제출은 여전히 redirect나 error response를 받는다. 향상된 경로는 그
response를 소비하고, 성공이 아니면 error를 지역적으로 보여주고, 성공이면 controller가 알려준 redirect URL을
`navigate(...)`로 따라간다.

UI에 맞는 동기화 경계를 고른다.

- Document navigation이 올바른 결과라면 기존 form을 그대로 제출한다.
- Navigation 전에 pending이나 inline error UI가 필요하면 `fetch()`로 가로챈다.
- Browser 쪽 model이 데이터를 소유하고 server-rendered 영역이 바뀔 필요가 없으면 JSON을 보낸다.
- 데이터가 현재 page와 무관하게 바뀐다면 작은 JSON endpoint를 polling한다.

Mutation이 전체 document를 navigate하지 않고 route가 소유한 한 영역만 다시 로드하는 optional case는 Streaming UI with
Frames 장에서 다룬다.

## Pending UI와 optimistic UI

Album form은 render 출력이 읽기 때문에 `pending`을 setup scope에 둔다. Submit handler가 request 전에 그것을 설정하고
request가 끝나면 해제한다. Disabled control, pending label, progress indicator, 중복 제출 방지에는 이것으로 충분하다.

Optimistic UI는 request가 끝나기 전에 예상 결과를 render한다. Optimistic operation과 복구 정책은 데이터를 소유한
model에 둔다. Component는 model의 현재 state를 render하면서 pending label, 열린 menu, focus된 control 같은 UI 관심사만
지역적으로 유지할 수 있다.

Optimistic state는 toggle, 순서 변경, 이미 알고 있는 item 추가처럼 되돌릴 수 있고 예측 가능한 변경에 가장 잘 맞는다.
Server가 최종 값을 정하거나, 파괴적인 operation이거나, 사용자가 먼저 해결해야 하는 방식으로 request를 거부할 수 있으면
응답을 기다린다. Optimistic request가 실패하면 model이 이전 state를 복원하거나 server response를 채택할 수 있고,
component는 그 결과로 생긴 error나 retry control을 render할 수 있다.

## 언제 custom event mixin을 만드는가

대부분의 application code는 native event와 함께 `on(...)`을 써야 한다. 여러 component가 낮은 수준 event 여러 개로
조립된 같은 상호작용을 필요로 할 때(예: timing이나 pointer state가 있는 gesture) event mixin을 만든다. Mixin은 그
state를 setup scope에 유지하고, consumer에게 하나의 의미 있는 typed event를 dispatch할 수 있다.

이 `longPress()` mixin은 눌린 pointer를 `app:longpress` event로 바꾼다.

`app/ui/public/long-press.tsx`

```tsx
import { createMixin, on } from "remix/ui";

export const longPressType = "app:longpress" as const;

export class LongPressEvent extends Event {
  constructor() {
    super(longPressType, { bubbles: true });
  }
}

declare global {
  interface HTMLElementEventMap {
    [longPressType]: LongPressEvent;
  }
}

export const longPress = createMixin<HTMLElement>((handle) => {
  let node: HTMLElement | undefined;
  let timeout: number | undefined;

  handle.addEventListener("insert", (event) => {
    node = event.node;
  });
  handle.addEventListener("remove", cancel);

  function cancel() {
    window.clearTimeout(timeout);
  }

  return () => (
    <handle.element
      mix={[
        on("pointerdown", () => {
          cancel();
          timeout = window.setTimeout(() => {
            node?.dispatchEvent(new LongPressEvent());
          }, 500);
        }),
        on("pointerup", cancel),
        on("pointercancel", cancel),
        on("pointerleave", cancel),
      ]}
    />
  );
});
```

의미 있는 event는 다른 DOM event처럼 `on(...)`으로 소비한다.

```tsx
<button
  mix={[
    longPress(),
    on(longPressType, () => {
      console.log("Long press");
    }),
  ]}
>
  Hold for options
</button>
```

Custom event 이름에는 namespace를 붙여 충돌을 피하고, 한 번만 쓰는 동작은 그것을 쓰는 component 안에 둔다.

다음 장은 같은 server renderer와 browser runtime으로 `<Frame>`을 사용해 route가 소유한 UI를 stream하고 다시 로드한다.
그 뒤 Animation 장은 component state, `mix` 조합, key, cancellation을 entrance/exit/layout/spring/tween motion에
적용한다.
