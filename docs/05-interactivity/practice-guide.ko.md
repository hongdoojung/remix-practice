# Interactivity

원문: [Interactivity | Remix Docs](https://guides.remix.run/interactivity/) ·
전문 번역: [`original-translation.ko.md`](./original-translation.ko.md)

이 문서 하나로 챕터의 개념을 익히고, `vinyl-shelf` 프로젝트 코드로 실습한다. 각 절은 먼저
개념을 설명하고, **vinyl-shelf에서는** 단락에서 이 프로젝트의 실제 코드와 연결한다.

이 문서의 코드와 파일 경로는 `curriculum 05: Interactivity` 커밋 시점 기준이다.

4장까지의 페이지는 전부 서버에서 render됐다. 이번 장은 그 위에 브라우저 동작을 얹는다 —
component를 hydrate 대상으로 표시하고, 이벤트를 처리하고, 오래된 async 작업을 취소하고,
link와 form을 향상시킨다. 중요한 것은 **서버 동작을 하나도 대체하지 않는다**는 점이다.

## 1. Progressive enhancement

출발점은 이미 서버가 받아야 할 요청을 서술하고 있는 link와 form이다. form에는 실제
`action`과 `method`가 있고, anchor에는 쓸모 있는 `href`가 있다.

- JavaScript가 **없으면** — 브라우저가 `FormData`를 route에 POST하고, action이 검증·저장·
  redirect를 처리한다. 1~3장에서 만든 경로 그대로다.
- JavaScript가 **있으면** — 이벤트 핸들러가 같은 제출을 가로채 pending UI를 더하거나
  페이지 일부만 갱신한다. mutation과 에러 응답의 주인은 여전히 controller다.

어떤 상호작용은 JavaScript가 있어야만 의미가 있다. 그래도 페이지 전체를 브라우저 코드로
옮기지 않는다 — 서버는 그 주변의 콘텐츠·내비게이션·form을 계속 render하고, hydrate되는
component에는 필요한 초기 데이터와 route URL만 넘긴다.

### vinyl-shelf에서는

앨범 추가 form과 삭제 form은 향상하지 않았다 — 제출 후 문서 전체가 이동하는 것이 올바른
결과라서, 평범한 form 제출로 충분하다. 향상 대상은 edit form(10절)과 검색(7절)처럼
"이동 전에 화면 안에서 반응해야 하는" 것들뿐이다.

## 2. clientEntry로 hydration 경계 정하기

`clientEntry(...)`는 브라우저에서 실행되어야 하는 **가장 작은** component를 표시한다.
페이지는 서버 전용으로 남고 그 안의 조각만 hydrate된다. 습관은 이렇다 — 버튼 하나가
hydrate된다고 그 위의 정적 조상과 형제까지 hydrate할 필요가 없다.

경계에는 직렬화 규칙이 따라온다. client entry의 props는 서버에서 브라우저로 건너가므로
string, number, boolean, `null`/`undefined`, plain object/array, JSX element만 담을 수 있다.
함수, class instance, ORM이 만든 record 같은 불투명한 runtime 값은 넘기지 않는다.
database 접근, 인증된 사용자, request context는 서버에 남긴다.

### vinyl-shelf에서는

이 프로젝트에는 경계를 강제하는 장치가 하나 더 있다. `app/assets.ts`의
`allow: ['app/assets/**', 'node_modules/**']` 때문에 그 밖의 파일은 브라우저로 서빙되지
않는다. 그래서 브라우저 module은 전부 `app/assets/`에 있고, server 코드를 **값으로**
import할 수 없다.

```ts
import type { Album } from '../data/albums.ts'  // 안전: type은 컴파일 시 지워진다
import { routes } from '../routes.ts'           // 위험: browser가 이 module을 받을 수 없다
```

그래서 route URL은 서버가 prop으로 넘긴다 — "endpoint를 하드코딩하지 말라"는 원문의 조언이
여기서는 제약으로 강제된다.

```tsx
<AlbumSearch searchHref={routes.apiAlbums.href()} />
```

albums 페이지에서 hydrate되는 것은 `AlbumSearch`와 `QueuePanel` 둘뿐이다. 서버가 만든 HTML
끝의 manifest(`rmx-data` JSON)에 hydrate 대상이 기록되므로, 테스트가 그것을 읽어 경계를
지킨다.

```ts
assert.deepEqual(names, ['AlbumSearch', 'QueuePanel'])
```

직렬화 규칙의 실무 디테일 둘: `QueuePanel`에는 `Album` 전체가 아니라 `{ slug, title }`만
넘긴다. 그리고 prop 타입은 `interface`가 아니라 `type` 별칭으로 선언해야 한다 —
`SerializableProps`가 요구하는 index signature가 interface에는 암묵적으로 없어서 타입
에러가 난다.

## 3. Browser runtime: run과 createRoot

document shell이 로드하는 entry module이 `run()`을 한 번 호출한다. `run()`은 문서에서
client entry marker를 찾아 `loadModule`로 module을 import하고 hydrate한다(1장 7절의 과정).
반환된 app 객체에는 세 가지가 있다 — `app.ready()`(최초 hydrate 완료 시 resolve),
`app.flush()`(대기 중인 update를 동기 적용, 주로 테스트용), `app.dispose()`(정리).

`run()`은 어디까지나 서버가 render한 페이지를 hydrate하는 것이지, 두 번째 router가
아니다. 브라우저의 요청은 여전히 서버 route action으로 간다.

hydrate할 서버 HTML이 없는 곳에 UI를 새로 mount해야 할 때만 `createRoot(container)`를
쓴다. 일반 페이지 UI를 이걸로 만들면 사용자는 서버가 그냥 render할 수 있었던 콘텐츠를
JavaScript 로드가 끝날 때까지 기다리게 된다.

### vinyl-shelf에서는

`app/assets/entry.ts`가 `run()`을 호출한다. `createRoot`는 쓸 곳이 없다 — 모든 UI가
서버에서 시작하기 때문이고, 그게 정상이다.

## 4. State, update, post-render task

local state는 setup scope의 변수이고, update는 명시적이다(4장 2절). 이번 장의 추가
내용은 **update의 반환값**이다.

`handle.update()`는 promise를 반환한다. 다음 작업이 update된 DOM을 필요로 하면 await한다.

```tsx
editing = true
await handle.update()
input.focus()          // 이 input은 방금 update로 생겼다
```

await한 결과는 `AbortSignal`인데, update 직후의 동기 코드에는 확인이 필요 없다 — runtime이
그 사이에 abort할 수 없기 때문이다. 이어서 또 다른 async 작업(fetch 등)을 한다면 그 작업에
signal을 넘기고, await 뒤에 `signal.aborted`를 확인한다.

`handle.queueTask(task)`는 다음 update가 DOM에 반영되는 시점에 task를 실행한다. DOM 측정,
스크롤 이동처럼 "그 flush의 일부여야 하는" 작업에 쓴다.

그리고 update가 목록을 바꿀 때는 언제나 `key`가 중요하다 — 배열 index나 무작위 값이 아니라
안정된 ID를 쓴다. key가 맞아야 runtime이 기존 DOM과 component instance를 옮길 수 있고,
state가 엉뚱한 항목에 붙지 않는다.

### vinyl-shelf에서는

edit form의 에러 표시가 `await handle.update()` 패턴의 실물이다. 에러 alert은 조건부로
render되므로, update를 기다린 뒤에야 focus를 줄 수 있다.

```tsx
pending = false
await handle.update()   // alert은 이 update 이후에야 존재한다
alert?.focus()
```

`alert` 변수는 `ref(...)` mixin이 채운다(6절).

## 5. Event 처리: on, controlled input, mix

`on(type, handler)`는 타입이 잡힌 DOM 이벤트를 host element에 붙인다. 원칙은 **native
element와 native event 우선**이다. 버튼의 `click`은 이미 pointer·touch·Enter·Space를 다
다루고, form의 `submit`은 버튼과 field의 Enter를 다 다룬다. 낮은 수준의 pointer/keyboard
이벤트는 상호작용 자체가 요구할 때만 쓴다(12절의 long-press가 그 예다).
`preventDefault()`도 향상된 경로가 브라우저의 일을 끝까지 대신할 때만 부른다.

input은 두 방식이 있다. **uncontrolled**는 현재 값을 DOM이 들고 `defaultValue`로 초기값만
준다. **controlled**는 `value`가 component state에서 오고, input 핸들러가 DOM 값을 state로
복사한 뒤 update한다. 코드가 값을 되돌리거나 가공해야 할 때만 controlled가 필요하다.

`mix` prop은 이런 동작들을 조합하는 자리다. 핵심 mixin은 host 수준에서 서로 다른 일을 한다.

| Mixin | 역할 |
| --- | --- |
| `on(...)` | typed 이벤트 핸들러 |
| `ref(...)` | element 삽입 시 setup 실행 + 정리용 signal |
| `attrs(...)` | 명시적 prop을 덮지 않는 기본 attribute |
| `link(...)` | client navigation 동작과 link 의미론 (9절) |
| `css(...)` | 정적 스타일 (4장) |

자주 바뀌는 값은 mixin을 매번 새로 만들지 말고 `style`, `value`, `checked` 같은 일반
prop에 둔다.

### vinyl-shelf에서는

검색 input은 uncontrolled다 — 값을 코드가 되돌릴 일이 없고, `on('input', ...)`으로 읽기만
하면 된다. controlled input이 필요한 UI는 아직 없다.

## 6. DOM ref와 전역 listener 정리

`ref(...)`는 삽입된 DOM node와, 그 node가 **제거될 때 abort되는 signal**을 준다. observer나
element 소유 listener를 그 signal에 묶으면 정리가 자동이다. ref callback은 삽입 시 한 번
실행되지 update마다 실행되지 않으므로, 조건부 element의 ref signal은 그 element의 수명과
정확히 일치한다.

`window`, `document` 같은 전역 대상에는 `addEventListeners(target, signal, listeners)`를
쓴다. component 수명에 묶을 listener라면 signal 자리에 `handle.signal`(component가
disconnect될 때 abort)을 넘긴다. 서버 렌더링 중 `window`를 읽지 않도록, 브라우저 전용
setup은 `handle.queueTask(...)`로 client 반영 이후로 미룬다.

### vinyl-shelf에서는

두 용법이 다 있다 — edit form의 에러 alert이 `ref(...)`(4절), `QueuePanel`의 model 구독이
`addEventListeners(queue, handle.signal, ...)`(8절)다.

## 7. Async 취소: 세 가지 signal

Remix는 async 작업의 범위마다 맞는 abort signal을 준다. 이 표는 외워 둘 가치가 있다.

| Signal | abort되는 시점 | 맞는 용도 |
| --- | --- | --- |
| `on(...)` 핸들러의 두 번째 인자 | 같은 핸들러가 다시 실행되거나 element가 제거될 때 | 최신 이벤트가 이전 작업을 대체해야 하는 요청 |
| queueTask의 인자 | component가 다시 render되거나 disconnect될 때 | prop에 연동된 로딩, post-render DOM 작업 |
| `handle.signal` | component가 disconnect될 때 | component 수명의 timer와 전역 listener |

규칙: **가장 좁은 signal을 `fetch()`에 넘기고, signal을 못 넘긴 await 뒤에는
`signal.aborted`를 확인한다.**

### vinyl-shelf에서는

`app/assets/album-search.tsx`가 첫 행의 패턴이다.

```tsx
on('input', async (event, signal) => {
  query = event.currentTarget.value
  loading = query !== ''
  handle.update()

  let url = new URL(handle.props.searchHref, window.location.href)
  url.searchParams.set('query', query)

  let response = await fetch(url, { headers: { Accept: 'application/json' }, signal })
  let payload = (await response.json()) as { albums: SearchResult[] }
  if (signal.aborted) return

  results = payload.albums
  loading = false
  handle.update()
})
```

사용자가 한 글자 더 입력하면 이 signal이 abort되어 이전 fetch가 취소된다. 오래된 검색어의
느린 응답이 새 결과를 덮어쓸 수 없다. `response.json()` 사이에 취소될 수도 있으니 await
다음의 `signal.aborted` 확인도 생략하지 않는다.

## 8. Application logic은 component 밖에

setup 변수로 state를 쉽게 만들 수 있다고 해서 component가 모든 규칙의 주인이 되는 건
아니다. 경계는 이렇다 — **현재 UI를 서술하는 값**(panel이 열려 있는지, 무엇이 focus를
받는지, 요청이 pending인지)은 component에, **application 데이터와 연산**은 component가
호출하는 평범한 TypeScript에 둔다.

모델을 `TypedEventTarget`으로 만들면 component는 만들고 구독만 하면 된다.

```tsx
let cart = new CartModel(handle.props.initialItems)
addEventListeners(cart, handle.signal, {
  change() { handle.update() },
})
```

`handle.signal` 덕분에 구독이 component보다 오래 살지 않는다. 여러 component가 같은 모델을
쓰면 가장 가까운 공통 client 경계에서 만들어 component context로 내린다. 그리고 **class
instance는 clientEntry prop으로 넘기지 않는다** — prop은 직렬화되기 때문이다(2절).

이 분리는 테스트 경계이기도 하다. 모델의 규칙은 DOM 없이 테스트하고, render 결과는
component 테스트로 확인한다.

### vinyl-shelf에서는

`app/assets/shelf-queue.ts`의 `ShelfQueue`가 그 모델이다 — DOM도 component도 모르는
class이고, 변경 때마다 `change` 이벤트를 쏜다. `QueuePanel`은 setup에서 모델을 만들고
구독하며, 자기 손에는 `statusOpen` 하나만 남긴다. 모델을 prop으로 받지 않는 이유가 바로 위
직렬화 규칙이다.

## 9. Client navigation

link에는 계속 **진짜 anchor**를 쓴다. `run()`이 시작된 뒤에는 runtime이 same-origin
navigation을 Navigation API로 알아서 향상시키고, cross-origin과 download는 평범한 document
요청으로 남는다. 그 위에 두 가지 도구가 있다.

- `navigate(href, options)` — 코드에서 navigation을 시작할 때.
- `link(href)` mixin — anchor가 아닌 host를 의도적으로 link처럼 동작시킬 때.
  `role="link"`, keyboard focus, Enter/modifier-key 처리, `aria-disabled` 반영까지 해 준다.
  markup이 가능하면 anchor가 우선이다.

### vinyl-shelf에서는

검색 결과 행은 `<li mix={link(album.href)}>`다 — 행 전체가 클릭 표면이어야 해서 mixin을
썼고, `href`는 서버의 JSON 응답이 담아 준다(브라우저 코드가 URL을 조립하지 않는다).

```ts
.map((album) => ({ ...album, href: routes.albums.show.href({ slug: album.slug }) }))
```

반면 서버가 render한 anchor들("Open detail" 등)에는 아무것도 하지 않았다 — runtime이
알아서 향상시킨다.

## 10. Form 향상: fetch와 navigate

두 번째 mutation API를 만들지 않는 것이 이 절의 전부다. 핸들러는 form이 **이미 가진**
`action`, `method`, `FormData`를 fetch로 보내고, controller가 정한 결과를 따른다 —
실패면 에러를 화면 안에 보여주고, 성공이면 redirect를 따라간다.

UI마다 맞는 동기화 방식은 다르다. 원문의 네 선택지와 이 프로젝트의 선택을 겹쳐 보면:

| 선택지 | 언제 | 이 프로젝트에서 |
| --- | --- | --- |
| form을 그대로 제출 | document 이동이 올바른 결과일 때 | 앨범 추가·삭제 form |
| `fetch()`로 가로채기 | 이동 전에 pending/inline error가 필요할 때 | edit form |
| JSON 보내기 | 브라우저 모델이 데이터를 소유할 때 | queue panel |
| JSON polling | 현재 페이지와 무관하게 데이터가 바뀔 때 | 미사용 (해당 데이터 없음) |

### vinyl-shelf에서는

`app/assets/album-edit-form.tsx`의 제출 핸들러가 이 패턴이고, 원문과 다른 선택이 둘 있다.

```tsx
on('submit', async (event, signal) => {
  let form = event.currentTarget
  event.preventDefault()
  pending = true
  handle.update()

  let response = await fetch(form.action, {
    body: new FormData(form),
    method: form.method,
    headers: { Accept: 'application/json' },
    signal,
  })

  if (response.ok) {
    await navigate(response.url, { history: 'replace' })
    return
  }
  // 400이면 JSON의 errors를 읽어 inline으로 render한다
})
```

1. **`Accept: application/json`을 보낸다.** 원문 예제는 실패 응답을 `response.text()`로
   읽지만, 우리 action의 실패 응답은 HTML 페이지 전체라 에러 메시지로 못 쓴다. 그래서
   controller가 content negotiation(같은 URL에서 `Accept` header를 보고 응답 형식을 고르는
   것)을 한다 — 같은 실패가 일반 제출에는 HTML 400, fetch에는 JSON 400으로 갈린다.
   테스트가 두 경로를 모두 확인한다.
2. **성공 시 `response.url`로 navigate한다.** action이 반환한 303을 fetch가 따라갔으므로
   `response.url`이 최종 목적지다. client가 목적지를 추측하지 않고 controller가 정한 곳으로
   간다.

controller의 action 자체는 바뀌지 않았다 — JavaScript를 끄면 3장까지의 경로가 그대로
동작한다.

## 11. Pending UI와 optimistic UI

pending은 setup 변수 하나로 충분하다 — 요청 전에 켜고 끝나면 끈다. 버튼 disabled, 라벨
교체, 중복 제출 방지가 다 여기서 나온다.

optimistic UI(응답이 오기 전에 예상 결과를 먼저 render하는 것)는 되돌릴 수 있고 예측
가능한 변경 — toggle, 순서 변경 — 에 맞는다. 서버가 최종 값을 정하거나 파괴적인 작업이면
응답을 기다린다. optimistic 연산과 실패 시 복구 정책은 데이터를 소유한 모델에 두고,
component는 모델의 현재 state를 render할 뿐이다.

### vinyl-shelf에서는

edit form의 `pending`이 전자다. optimistic UI는 아직 없다 — queue가 서버에 저장되지 않아서
"요청보다 먼저 보여줄" 것이 없기 때문이고, 데이터 저장 챕터에서 자연스럽게 등장한다.

## 12. Custom event mixin

대부분의 코드는 native 이벤트와 `on(...)`으로 충분하다. event mixin을 만드는 기준은 —
**여러 낮은 수준 이벤트를 조합한 하나의 상호작용을 여러 component가 쓸 때**다. mixin이
조합 state를 자기 setup에 숨기고, 소비자에게는 의미 있는 typed 이벤트 하나만 준다.

### vinyl-shelf에서는

"누르고 있으면 queue 비우기"가 그 사례다. `app/assets/long-press.tsx`의 `longPress()`가
`pointerdown/up/cancel/leave` 네 이벤트와 timer를 조합해 `shelf:longpress` 이벤트 하나로
바꾼다. 소비하는 쪽에는 그냥 또 하나의 DOM 이벤트다.

```tsx
<button mix={[button({ tone: 'ghost' }), longPress(), on(longPressType, () => queue.clear())]}>
  Hold to clear
</button>
```

이벤트 이름에는 `shelf:` namespace를 붙여 충돌을 피했다. 한 곳에서만 쓰는 동작이라면
mixin으로 뽑지 말고 component 안에 두는 편이 낫다.

## 정독 후 확인 질문

1. `clientEntry(...)` 경계를 페이지 전체로 넓히면 무엇을 잃는가?
2. `on(...)` 핸들러의 signal, queueTask의 signal, `handle.signal`은 각각 언제 abort되는가?
3. edit form이 `Accept: application/json`을 보내는 이유는? 안 보내면 어떤 UI 문제가 생기는가?
4. 성공 응답에서 목적지를 client가 계산하지 않고 `response.url`을 쓰는 이유는 무엇인가?
5. `ShelfQueue`를 `QueuePanel`의 prop으로 넘기면 왜 안 되는가?
6. 서버가 render한 anchor에는 아무 mixin도 없는데 어떻게 client navigation이 되는가?

## 스터디 과제

**앨범 추가 form을 edit form과 같은 방식으로 향상시킨다.** JavaScript를 끄면 지금의 경로가
그대로 동작해야 한다.

1. create action에 content negotiation을 추가한다 — 검증 실패 시 `Accept: application/json`
   요청에는 `{ errors, values }` JSON 400을, 일반 제출에는 지금처럼 HTML 400을 반환한다.
2. 추가 form을 `app/assets/` 아래 client entry로 분리한다. props는 직렬화 가능한 값만
   넘긴다 — action URL도 서버가 prop으로 준다.
3. submit 핸들러에서 fetch로 가로채 pending 동안 버튼을 disabled하고, 실패면 inline 에러를
   render한 뒤 `await handle.update()` 후 에러 영역에 focus를 주고, 성공이면
   `response.url`로 navigate한다.
4. 같은 실패 요청이 `Accept`에 따라 JSON 400과 HTML 400으로 갈리는 테스트를 추가한다.

다 만들었으면 JavaScript를 끈 브라우저에서 추가 → 검증 실패 → 성공 흐름을 한 번 돌려 보자.
