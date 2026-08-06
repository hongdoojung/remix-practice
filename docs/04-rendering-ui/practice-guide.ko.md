# Rendering UI

원문: [Rendering UI | Remix Docs](https://guides.remix.run/rendering-ui/) ·
전문 번역: [`original-translation.ko.md`](./original-translation.ko.md)

이 문서 하나로 챕터의 개념을 익히고, `vinyl-shelf` 프로젝트 코드로 실습한다. 각 절은 먼저
개념을 설명하고, **vinyl-shelf에서는** 단락에서 이 프로젝트의 실제 코드와 연결한다.

이 문서의 코드와 파일 경로는 `curriculum 04: Rendering UI` 커밋 시점 기준이다.

3장까지는 요청이 controller에 닿는 길을 만들었다. 이번 장은 action이 `context.render(...)`에
넘긴 component tree가 완전한 HTML document가 되는 과정이다.

```text
controller action
  -> context.render(<Page />)
  -> Document (html / head / body)
  -> css() rule 수집 -> <style data-rmx>
  -> createHtmlResponse
  -> Response (text/html)
```

이 장의 내용은 전부 서버에서 일어난다. 페이지 일부가 이벤트를 처리하거나 브라우저 API를
써야 할 때만 브라우저 JavaScript가 필요하고, 그 layer는 Interactivity 장에서 얹는다.

## 1. Remix component model

1장에서 봤던 두 단계 구조를 이제 정식으로 정리한다. Remix component는 **render 함수를
반환하는 setup 함수**다.

```tsx
export function AlbumHeading(handle: Handle<{ artist: string; title: string }>) {
  // setup: component instance마다 한 번 실행된다.
  return () => {
    // render: 최초 render와 이후 모든 update에서 실행된다.
    return (
      <header>
        <p>{handle.props.artist}</p>
        <h1>{handle.props.title}</h1>
      </header>
    )
  }
}
```

runtime은 `<AlbumHeading artist="..." title="..." />`를 만나면 instance를 만들고, setup
scope를 유지한 채 update 때마다 render 함수만 다시 부른다.

render 함수가 반환하는 값(`RemixNode`)은 `<main>` 같은 host element, 다른 component,
string·number·boolean·`null`·`undefined`, 그리고 이것들의 중첩 배열이다. DOM element를
추가하지 않고 형제 node들을 반환하려면 Fragment(`<>...</>`)를 쓴다.

같은 component가 세 자리에서 동작한다 — 서버에서 HTML로 render되거나, 브라우저 전용
root에 mount되거나, 서버가 render한 페이지 안에서 hydrate되거나. 앞의 경우만 서버이고
뒤의 둘만 브라우저에서 실행된다.

### vinyl-shelf에서는

`app/ui/vinyl-shelf.tsx`의 모든 page component가 이 모양이다. 새 component를 추가할 때
헷갈리면 이 파일의 아무 component나 펴 놓고 setup/render 경계를 확인하면 된다.

## 2. Props, local state, update

`handle.props`는 **안정된 객체**다. 객체 자체는 바뀌지 않고, 그 property 값이 render 직전에
교체된다. 여기서 규칙 하나가 나온다 — **setup에서 property를 꺼내면 초기 값에 고정된다.**

```tsx
function AlbumTitle(handle: Handle<{ title: string }>) {
  let { props } = handle          // 객체 자체를 꺼내는 것은 안전
  let initialTitle = props.title  // property를 꺼내면 이 시점 값에 고정

  return () => <h1 title={`Originally ${initialTitle}`}>{props.title}</h1>
}
```

local state는 setup scope의 평범한 변수다. 그리고 **update는 명시적이다** — 변수를 바꾸는
것만으로는 화면에 아무 일도 일어나지 않고, `handle.update()`를 불러야 그 component가 다시
render된다.

```tsx
export function AlbumList(handle: Handle<{ albums: Album[] }>) {
  let filter = ''

  return () => {
    let visible = handle.props.albums.filter((a) =>
      a.title.toLowerCase().includes(filter.toLowerCase()),
    )
    return (
      <div>
        <input
          type="search"
          mix={on('input', (event) => {
            filter = event.currentTarget.value
            handle.update()
          })}
        />
        <ul>
          {visible.map((album) => <li key={album.id}>{album.title}</li>)}
        </ul>
      </div>
    )
  }
}
```

목록의 `key`는 render 사이에 어떤 항목이 같은 항목인지 알려 주는 표식이다. 순서가 바뀌어도
key가 같으면 그 항목의 DOM과 component state가 유지된다. 이벤트와 update가 실제로 도는
모습은 Interactivity 장에서 다룬다.

### vinyl-shelf에서는

프로젝트의 page component들은 전부 render 함수 **안에서** `let { albums } = handle.props`처럼
꺼낸다. setup에서 꺼내는 코드가 하나도 없는지 확인해 보자 — 위 규칙의 실물이다.

## 3. Component context와 handle.id

**`handle.id`** 는 component instance마다 주어지는 안정된 식별자다. 재사용 control이 label,
input, 설명 텍스트를 ARIA로 연결해야 할 때, `id`를 prop으로 받는 대신 이 값을 쓴다.

```tsx
function AlbumSearch(handle: Handle) {
  return () => (
    <div>
      <label htmlFor={handle.id}>Search albums</label>
      <input id={handle.id} name="query" type="search" />
    </div>
  )
}
```

**component context**는 조상이 제공한 값을 중간 component들을 거치지 않고 자손이 읽는
통로다. 별도의 key 객체가 없다 — provider component 자체가 key라서, `get(Provider)`의
반환 타입이 provider의 선언에서 그대로 나온다.

```tsx
export function Catalog(handle: Handle<{ children?: RemixNode }, CatalogContext>) {
  handle.context.set({ currency: 'USD' })
  return () => handle.props.children
}

export function AlbumPrice(handle: Handle<{ amount: number }>) {
  let catalog = handle.context.get(Catalog)
  return () => <span>{catalog.currency} {handle.props.amount.toFixed(2)}</span>
}
```

주의할 점: `handle.context.set(...)`은 값을 저장할 뿐 **update를 예약하지 않는다.** 서버
렌더링에서는 문제가 없지만, 브라우저에서 값이 바뀌는 context라면 provider를 update하거나
변경을 구독하는 장치가 필요하다. 그 패턴은 Interactivity 장에서 다룬다.

### vinyl-shelf에서는

`AppShell`이 shell 전역 값(`activePath`, `albumCount`)을 context로 제공하고, 중첩된
`PrimaryNav`가 그것을 읽는다. `app/ui/vinyl-shelf.tsx`:

```tsx
function PrimaryNav(handle: Handle) {
  let shell = handle.context.get(AppShell)

  return () => (
    <nav aria-label="Primary">
      <a href={routes.home.href()} aria-current={shell.activePath === '/' ? 'page' : undefined}>
        Start
      </a>
      {/* ... */}
    </nav>
  )
}
```

`<PrimaryNav />`는 prop을 하나도 받지 않는다. context가 없었다면 `activePath`를 `AppShell` →
nav로 다시 꿰어야 했을 자리다.

`handle.id`는 form field에서 쓴다. `TextField`는 `id` prop 없이 label·input·에러 메시지를
연결한다.

```tsx
let errorId = `${handle.id}-error`

<label htmlFor={handle.id}>{label}</label>
<input id={handle.id} name={name} aria-describedby={error ? errorId : undefined} ... />
{error ? <small id={errorId}>{error}</small> : null}
```

## 4. Page render와 document shell

action에서의 사용법은 이미 익숙하다 — `context.render(<Page />)`. status나 header가
필요하면 `ResponseInit`을 같이 넘긴다.

```tsx
return context.render(<AlbumPage album={album} />, {
  status: 404,
  headers: { 'Cache-Control': 'no-store' },
})
```

페이지는 공유 `Document` component 하나를 통해 완전한 document로 render한다. 원칙은 head가
가질 것들 — `title`, `meta`, `link`, stylesheet, entry script — 을 전부 명시적인 `<head>`
안에서 이 component가 소유하는 것이다. asset URL은 component 안에서 조립하지 말고
`app/assets.ts`에서 한 번만 만들어 둔다.

render 결과는 `createHtmlResponse()`를 거친다. 이 helper가 `<!DOCTYPE html>`을 붙이고
`Content-Type: text/html; charset=UTF-8`을 설정해서, 최종 결과는 여전히 평범한 Web
`Response`다.

### vinyl-shelf에서는

`app/ui/document.tsx`가 이번 챕터에서 세 가지 바뀌었다.

1. entry script가 `<body>` 끝에서 `<head>`로 올라왔다. `type="module"` script는 기본으로
   defer되어 파싱을 막지 않으니, head에 두면 브라우저가 더 일찍 다운로드를 시작한다.
2. `description` prop이 생겨 페이지마다 `<meta name="description">`을 넣는다. 페이지가 head
   element를 더 넣는 확장점으로 `head` prop도 그대로 있다.
3. `<body mix={css({ margin: 0 })}>`가 사라졌다. body reset은 다음 절의 `app.css`가 맡는다.

asset URL은 `app/assets.ts`에서 한 번 resolve한다.

```ts
export const entryHref = routes.assets.href({ path: 'app/assets/entry.ts' })
export const stylesheetHref = '/app.css'
```

## 5. css와 동적 style 값

정적인 rule은 `css(...)`로 쓴다. pseudo-selector, 자손 selector, media query까지 일반 CSS
nesting 문법 그대로다.

```tsx
const cardStyle = css({
  border: '1px solid #d6d6d6',
  transition: 'border-color 120ms ease',
  '&:hover': { borderColor: '#6d28d9' },
  '@media (max-width: 40rem)': { borderRadius: 0 },
})
```

`css(...)` 하나가 class 하나와 정적 rule을 만든다. 그래서 **update마다 바뀔 수 있는 값 —
진행률, 좌표, opacity, transform — 은 `style` prop에 둔다.** 그런 값을 `css(...)`에 넣으면
값이 바뀔 때마다 새 rule이 쌓인다.

서버 렌더링 중에 Remix는 생성된 rule을 모아 중복을 제거하고 `<style data-rmx>` 태그로
document head에 넣는다. 즉 서버가 render한 페이지는 스타일을 받으려고 브라우저 JavaScript를
기다리지 않는다.

### vinyl-shelf에서는

이번 챕터부터 component의 `css(...)` 값이 색을 직접 쓰지 않고 다음 절의 design token을
읽는다.

```ts
const cardStyle = css({
  background: 'var(--shelf-surface)',
  border: '1px solid var(--shelf-line)',
  borderRadius: 'var(--shelf-radius)',
})
```

## 6. Cascade layer와 design token

`css(...)`가 만드는 rule은 first-party component style과 함께 `rmx`라는 cascade layer(CSS
우선순위를 이름 붙인 층으로 나누는 표준 기능)에 들어간다. 앱이 자체 layer를 쓴다면 전체
순서를 한 번 선언한다.

```css
@layer base, rmx, app;
```

- `rmx` **앞**의 layer(`base`) — component style이 덮어써도 되는 기본값과 token.
- `rmx` **뒤**의 layer(`app`) — component style을 의도적으로 덮어쓰는 규칙.
- layer가 없는 CSS는 layer가 있는 CSS보다 항상 우선하므로, 순서를 선언한 앱에서 unlayered
  CSS는 의도했을 때만 쓴다.

그리고 Remix는 동작과 최소한의 component style만 제공하지, 앱의 theme은 제공하지 않는다.
brand color, spacing, 글꼴, radius 같은 design token은 **앱이 소유**한다 — CSS custom
property나 TypeScript 값으로.

### vinyl-shelf에서는

`public/app.css`가 layer 순서와 token을 선언하고, `staticFiles()` middleware가 그대로
서빙한다.

```css
@layer base, rmx, app;

@layer base {
  :root {
    --shelf-bg: #f4f1eb;
    --shelf-accent: #1f6f54;
    /* ... */
  }
  body { margin: 0; font-family: var(--shelf-font); }
}

@layer app {
  .shelf-cta { border-radius: var(--shelf-radius); }
}
```

`.shelf-cta`가 `app` layer에 있는 이유가 이 절의 핵심이다. 다음 절의 `remix/ui/button`
mixin은 알약 모양(`border-radius: 999px`)을 주지만 Vinyl Shelf는 각진 버튼을 쓴다. `rmx`
뒤의 layer에서 덮어쓰면 selector 우선순위 싸움 없이 이긴다.

```tsx
<button type="submit" class="shelf-cta" mix={button({ tone: 'primary', size: 'lg' })}>
  Add album
</button>
```

## 7. First-party UI building block

`remix/ui/*`의 UI 재료는 소유권에 따라 세 단계다. **제품 markup에 맞는 가장 위 단계에서
시작하고, 그 단계가 노출하지 않는 제어가 필요할 때만 내려간다.**

| 단계 | 예 | 앱이 소유하는 것 |
| --- | --- | --- |
| Style mixin | `button`, `input`, `checkbox`, `radio`, `toggle` | native control, label, layout, state 전부 — mixin은 시각만 준다 |
| Composed control | `accordion`, `combobox`, `menu`, `select`, `tabs` | 주변 페이지와, control에 넘기는 값 |
| Headless primitive | `popover`, `listbox`, `anchor`, 각 `/primitives` | markup과 styling 전부 — Remix는 좁은 동작만 준다 |

- **mixin** — native 요소를 그대로 두고 겉모습만 입힌다. `<input mix={checkbox()} />`는
  여전히 checkbox라서 `FormData`에 참여하고 keyboard 동작을 브라우저에서 얻는다.
- **composed control** — 여러 element 사이의 관계(예: accordion의 trigger와 content)를
  대신 소유한다. 초기 상태만 맡기려면 `default*` prop, 부모가 상태를 소유하려면 대응하는
  controlled prop을 쓴다. `Select`처럼 `name`을 받는 control은 hidden input을 render해서
  일반 form에 참여한다.
- **primitive** — 색이 아니라 markup 자체가 달라야 할 때 고른다. 대신 label, ARIA 관계,
  keyboard 동작의 책임이 앱으로 넘어온다.

이 API들은 전부 서버에서 render된다. 브라우저 이벤트를 처리하는 control은
`clientEntry(...)` 경계 안에 있어야 하고, 그 경계를 고르는 법이 다음 장의 주제다.

### vinyl-shelf에서는

가장 위 단계인 mixin만 도입했다.

| 단계 | 이번 챕터 | 이유 |
| --- | --- | --- |
| Style mixin (`button`, `input`) | 사용 | native 동작을 유지한 채 시각만 얻는다 |
| Composed control | 미사용 | 지금 form에 필요한 상호작용이 없다 |
| Headless primitive | 미사용 | markup을 다르게 만들 이유가 아직 없다 |

mixin은 host를 바꾸지 않으므로 3장까지 만든 서버 동작 — form 제출, `FormData`, redirect —
이 전부 그대로다.

## 8. Component runtime 없이 HTML 만들기

모든 HTML 응답에 component tree가 필요한 것은 아니다. feed, 메일 본문, 작은 조각처럼
문자열 중심 출력에는 `remix/html-template`이 있다. `html` template tag가 보간 값을
escape한 `SafeHtml` 값을 만들고, 중첩된 `SafeHtml` 조각은 두 번 escape되지 않고 조합된다.

```ts
let items = albums.map((album) => {
  let href = routes.albums.show.href({ slug: album.slug })
  return html`<li><a href="${href}">${album.title}</a></li>`
})

return createHtmlResponse(html`
  <html lang="en">
    <head><title>Album feed</title></head>
    <body><ul>${items}</ul></body>
  </html>
`)
```

`html.raw`는 escape를 건너뛴다 — 앱이 이미 신뢰하는 markup 전용이고, 사용자 입력은 절대
넘기지 않는다.

### vinyl-shelf에서는

`GET /feed`가 이 방식이다(`app/actions/feed.ts`). 확인할 것이 두 가지 있다.

1. 이 응답에는 `<style data-rmx>`도 client entry 데이터도 없다 — component runtime을 아예
   거치지 않았기 때문이다. `/feed`의 소스 보기와 일반 페이지의 소스 보기를 비교해 보자.
2. 보간 값은 escape된다. 제목이 `<script>alert(1)</script>`인 앨범을 만들어도 feed에는
   `&lt;script&gt;`로 나온다. `controller.test.ts`의 테스트가 이 동작을 직접 확인한다.

## 정독 후 확인 질문

1. setup scope에서 `handle.props.title`을 destructuring하면 왜 위험한가? `let { props } =
   handle`은 왜 안전한가?
2. `css(...)`와 `style` prop은 각각 어떤 값에 적합한가?
3. `@layer base, rmx, app;`에서 `app`을 `rmx` 뒤에 둔 이유는 무엇인가?
4. `handle.context.set(...)`이 update를 예약하지 않는다는 사실은 브라우저에서 왜 중요해지는가?
5. `/feed` 응답에 `<style data-rmx>`가 없는 이유는 무엇인가?
6. `handle.id` 대신 `id`를 prop으로 받게 만들면 어떤 문제가 생기는가?

## 스터디 과제

**앨범 목록에 정렬 기능을 추가한다.** 브라우저 JavaScript 없이 동작해야 한다.

1. `GET /albums`가 `?sort=title` 또는 `?sort=year`를 받으면 서버에서 정렬해 render한다.
   query 값은 `context.url.searchParams`에서 읽는다.
2. 목록 페이지에 `method="get"` form을 추가한다 — native `<select name="sort">`와 적용
   버튼. label과 select는 `handle.id`로 연결하고, 버튼은 `remix/ui/button` mixin을 쓰되
   모양이 어긋나면 `@layer app`에서 덮어쓴다.
3. 새로 쓰는 스타일은 색·radius를 직접 쓰지 말고 `var(--shelf-*)` token만 읽는다.
4. `?sort=year`일 때 목록 순서가 연도순인지 확인하는 테스트를 추가한다.

다 만들었으면 JavaScript를 끈 브라우저에서도 정렬이 동작하는지 확인해 보자.
