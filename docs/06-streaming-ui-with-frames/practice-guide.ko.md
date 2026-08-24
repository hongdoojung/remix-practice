# Streaming UI with Frames

원문: [Streaming UI with Frames | Remix Docs](https://guides.remix.run/streaming-ui-with-frames/) ·
전문 번역: [`original-translation.ko.md`](./original-translation.ko.md)

이 문서 하나로 챕터의 개념을 익히고, `vinyl-shelf` 프로젝트 코드로 실습한다. 각 절은 먼저
개념을 설명하고, **vinyl-shelf에서는** 단락에서 이 프로젝트의 실제 코드와 연결한다.

이 문서의 코드와 파일 경로는 `curriculum 06: Streaming UI with Frames` 커밋 시점 기준이다.

지금까지 페이지는 component tree 하나를 반환했다. 이번 장은 페이지의 한 **영역**을 자기
`GET` route 뒤로 옮기고, `<Frame>`으로 페이지에 stream해 넣고, 문서 전체를 이동하지 않고 그
영역만 다시 로드한다.

```text
GET /albums/kind-of-blue                     ← 문서 전체
  └─ <Frame name="album-recommendations"
            src="/albums/kind-of-blue/recommendations"
            fallback={...} />                ← 영역만 담당하는 별도 request
```

## 1. Frame이 필요해지는 기준

component가 느리다거나 상호작용이 있다는 이유만으로 frame을 꺼내지 않는다. 평범한 component
조합에서 시작하고, 어떤 영역이 **자기 route를 가져야 하고** 다음 중 하나 이상이 해당할 때만
frame으로 옮긴다.

- 주변 페이지보다 늦게 도착해도 된다.
- mutation 후에 독립적으로 다시 로드되어야 한다.
- 여러 페이지가 같은 영역을 render한다.
- 그 데이터와 에러 응답이 별도 요청에 속한다.

### vinyl-shelf에서는

album detail의 추천(recommendation) 영역이 네 기준 중 셋에 해당해서 frame으로 옮겼다 —
늦게 도착해도 되고(fallback), 독립적으로 reload되고(새로고침 버튼), 없는 앨범이면 영역만
404가 된다. 반대로 albums 목록과 edit form은 기준에 하나도 해당하지 않아 평범한 component
조합으로 남겼다.

## 2. 영역 route: shell을 render하지 않는다

영역 route는 평범한 route다. `routes.ts`에 추가하고 controller에 action을 만든다. 다른 점은
하나 — action이 **frame에 들어갈 영역만** render하고 `Document` shell을 거치지 않는다.
응답에 `<html>`도 nav도 없어야 한다.

페이지는 그 route를 `<Frame src={...} />`로 품는다.

### vinyl-shelf에서는

`app/actions/albums/controller.tsx`의 `recommendations` action:

```tsx
recommendations(context) {
  let album = getAlbum(context.params.slug)
  if (!album) {
    return new Response('Album not found', { status: 404 })
  }

  return context.render(
    <AlbumRecommendations album={album} recommendations={getRecommendations(album)} />,
  )
}
```

테스트가 이 경계를 지킨다 — 영역 응답에 `<html`이나 primary nav가 들어가는 순간 실패한다.

```ts
assert.equal(html.includes('<html'), false)
assert.equal(html.includes('aria-label="Primary"'), false)
```

영역이 404여도 페이지 전체가 404가 되지 않는다는 것이 "에러 응답이 별도 요청에 속한다"의
의미다.

## 3. Fallback이 blocking을 결정한다

`<Frame>`의 동작은 `fallback` 유무로 갈린다.

- fallback이 **없으면** blocking이다 — 서버는 영역 응답을 기다렸다가 완성된 페이지 하나를
  보낸다. 초기 페이지가 그 영역 없이는 말이 되지 않을 때 이걸 유지한다.
- fallback이 **있으면** 초기 HTML에 fallback이 먼저 들어가고, 영역 HTML은 **같은 응답
  stream의 뒤쪽에** `<template id="...">` chunk로 도착해 fallback을 교체한다. 브라우저는
  페이지를 먼저 보고, 영역은 늦게 채워진다.

fallback은 loading UI지 error boundary가 아니다 — 요청이 실패했을 때 무슨 일이 일어날지는
다음 절의 resolver가 정한다.

### vinyl-shelf에서는

```tsx
<Frame
  name="album-recommendations"
  src={routes.albums.recommendations.href({ slug: album.slug })}
  fallback={<p mix={leadStyle}>Loading recommendations…</p>}
/>
```

streaming은 눈으로 확인할 수 있다 — `router.fetch(...).text()`로 응답 전체를 읽으면
fallback 문자열이 영역 문자열보다 먼저 나온다. 테스트가 그 순서와 `<template id="` chunk의
존재를 확인하고, 여러 flush에 걸쳐 나뉜 `rmx-data` JSON을 병합해 frame의 `name`, `src`,
`status: 'pending'`을 검사한다.

## 4. Frame resolver는 server와 browser에 하나씩

frame의 URL을 실제 HTML로 바꾸는 함수가 resolver이고, 두 곳에 있다.

**server** — 초기 렌더링 중 frame을 만나면 render middleware의 `renderToStream(...)`에 준
`resolveFrame`이 같은 router로 sub-request를 보낸다. frame이 문서와 세션을 공유하도록
cookie를 전달하고, `request.signal`을 물려줘 사용자가 떠나면 sub-request도 취소된다.

**browser** — fallback 상태로 도착한 frame과 이후의 reload는 `run()`에 준 `resolveFrame`이
fetch로 처리한다. 제거되거나 교체된 frame의 요청이 계속되지 않도록 받은 signal을 `fetch()`에
넘긴다. resolver는 신뢰할 수 있는 HTML만 반환해야 한다 — same-origin route URL이 일반적인
선택이다.

참고로 코드 진행 전에 완성된 HTML 문자열이 필요한 경우(email 미리보기 등)를 위한
`renderToString()`도 있지만, 일반 페이지 응답에는 streaming renderer를 쓴다 — client entry와
fallback frame이 그 위에서만 동작한다.

### vinyl-shelf에서는

server 쪽은 `app/middleware/render.tsx`(4장부터 있던 resolver에 `target`을 `X-Remix-Target`
header로 넘기는 부분을 추가), browser 쪽은 `app/assets/entry.ts`(`credentials:
'same-origin'`과 `target` header 추가)다.

실패 방침은 "throw 대신 **그 영역 안에 갇힌 error HTML** 반환"을 택했다 — 실패한 frame이
페이지 전체를 무너뜨리지 않는다. fallback이 이미 전송된 뒤에는 서버가 페이지를 에러 응답으로
교체할 수 없으므로, 이 방침이 streaming과도 맞는다.

## 5. Named frame과 reload

다른 client entry가 찾아야 하는 frame에는 `name`을 준다. 그러면 component가 frame을 다시
로드할 수 있다.

```tsx
await handle.frame.reload()                              // 자신을 담은 frame
await handle.frames.get('album-recommendations')?.reload()  // 이름으로 찾은 frame
```

reload되면 그 영역이 route의 **현재** HTML로 교체된다. mutation과 조합하면 이 패턴이 된다 —
form 제출은 기존 action으로 fetch하고, 성공하면 관련 frame을 reload한다. mutation 응답과
영역 HTML이 서로 다른 두 요청이므로, 어느 서버 경로도 중복되지 않는다.

### vinyl-shelf에서는

`app/assets/recommendations-refresher.tsx`가 frame **이름 문자열**만 prop으로 받는 작은
client entry다.

```tsx
on('click', async (_event, signal) => {
  let frame = handle.frames.get(handle.props.frameName)
  if (!frame) return

  pending = true
  handle.update()

  await frame.reload()
  if (signal.aborted) return

  pending = false
  reloads++
  handle.update()
})
```

`handle.frames.get(name)`은 frame이 mount되어 있지 않으면 `undefined`라서, 이 버튼이 엉뚱한
페이지에 놓여도 조용히 아무 일도 하지 않는다. frame handle 같은 runtime 객체를 prop으로
넘기지 않는 이유는 5장의 직렬화 규칙 그대로다.

원문의 "edit 성공 → recommendations reload" 조율은 이 프로젝트에서는 의미가 없어서(edit
성공 시 detail 페이지로 navigate하고, navigate하면 frame은 어차피 새로 로드된다) reload
자체를 보여주는 refresher 버튼으로 대신했다.

## 6. Link와 form으로 frame을 target한다

frame은 mixin 없이 attribute만으로도 조작할 수 있다. link에 세 가지를 붙이면:

```tsx
<a
  href={routes.albums.show.href({ slug: pick.slug })}
  rmx-src={routes.albums.recommendations.href({ slug: pick.slug })}
  rmx-target="album-recommendations"
  rmx-reset-scroll="false"
>
```

- runtime 시작 전(또는 JavaScript가 없으면): 평범한 link — `href`의 detail 페이지로 간다.
- runtime 시작 후: click을 가로채 `rmx-src`의 HTML을 `rmx-target` frame으로 로드한다.

`href`에 공개 목적지를 유지하는 것이 핵심이다. 향상이 실패해도 link는 옳은 곳으로 간다.
`rmx-src` 없이 `rmx-target`만 있으면 `href` 자체가 frame으로 로드된다.

**설치된 beta.5와 원문의 차이** — 원문은 설치된 `remix@3.0.0-beta.5`보다 앞서 있다.
`node_modules`의 타입 선언과 runtime 코드로 확인한 차이는:

| 원문 | beta.5 |
| --- | --- |
| browser `resolveFrame(src, options)` — form body 전달 | `resolveFrame(src, signal?, target?)` — form body 없음 |
| `data-rmx-*` attribute | `rmx-*` attribute |
| `data-rmx-history="push\|replace"` | 해당 attribute 없음 |
| GET form도 frame navigation으로 가로챔 | form 가로채기 없음 — link만 가로챈다 |

그래서 원문의 "form으로 frame을 navigate한다" 절은 이 버전에서 재현할 수 없고, 그 자리를
5절의 refresher 패턴이 대신한다.

## 정독 후 확인 질문

1. 추천 영역이 frame일 이유는 무엇인가? 같은 기준으로 albums 목록은 왜 frame이 아닌가?
2. fallback을 지우면 응답의 어떤 성질이 바뀌는가? `<template>` chunk는 어디로 가는가?
3. server resolver와 browser resolver는 각각 언제 호출되는가?
4. 영역 route가 404일 때 페이지 전체가 404가 되지 않는 이유는 무엇인가?
5. refresher에 frame handle 대신 이름 문자열을 넘기는 이유는 무엇인가?
6. `rmx-src` 없이 `rmx-target`만 있는 link를 click하면 무엇이 로드되는가?

## 스터디 과제

**홈 화면에 "shelf 통계" 영역을 만든다.** 앨범 수, 장르 수, 가장 최근 연도 정도를 보여주는
작은 영역이다.

1. 시작하기 전에, 이 영역이 1절의 네 기준 중 어디에 해당하는지(혹은 해당하지 않는지) 판정
   메모를 먼저 쓴다. frame이 아니라고 판단했다면 그 근거를 모임에 가져와도 과제 완료다.
2. frame으로 만들기로 했다면: `GET /stats` 영역 route와 action을 추가한다. 응답은 shell
   없이 영역만 render한다.
3. 홈 페이지에 named `<Frame>`으로 넣고, fallback을 줄지 blocking으로 둘지 정한다 — 이
   선택의 이유도 설명할 수 있어야 한다.
4. 테스트 두 개를 추가한다: 영역 응답에 `<html>`이 없는지, 홈 응답의 `rmx-data`에 frame이
   등록되는지.

다 만들었으면 dev tools Network 탭을 Slow 4G로 두고 fallback이 교체되는 순간을 확인해 보자.
