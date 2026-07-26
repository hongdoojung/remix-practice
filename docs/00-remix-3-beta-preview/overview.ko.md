# Remix 3 Beta Preview

이 문서는 `vinyl-shelf` 실습을 시작하기 전에 읽는 0번째 커리큘럼이다. Remix 3가 Remix 2와
무엇이 달라졌는지, 왜 그런 방향으로 바뀌었는지, 앞으로의 챕터를 어떤 관점으로 읽어야 하는지를
정리한다.

## 참고 자료

- [Wake up, Remix!](https://remix.run/blog/wake-up-remix)
- [Remix Jam 2025 Recap](https://remix.run/blog/remix-jam-2025-recap)
- [Remix Blog](https://remix.run/blog)
- [Remix 3 ditched React: Should you stick with it? - LogRocket Blog](https://blog.logrocket.com)

정확한 API 사용은 각 챕터의 공식 가이드와 현재 `vinyl-shelf` 코드로 확인한다. 이 문서는 개념
정리를 위한 문서이며, 프로젝트 코드는 1번 커리큘럼부터 변경한다.

## 1. Remix 3가 Remix 2와 달라진 점

### Props에서 네이티브 브라우저 이벤트로

React에서는 부모 컴포넌트에서 자식 컴포넌트로 데이터나 함수를 전달할 때 props를 사용한다. 자식이
깊어질수록 중간 컴포넌트를 계속 거쳐 props를 내려줘야 하는 props drilling 문제가 생긴다. 자식에서
발생한 이벤트를 부모가 처리하려면 부모가 callback function을 props로 내려줘야 한다.

Remix 3는 React 메커니즘에 의존하지 않고, 브라우저에 이미 있는 표준 이벤트 시스템을 더 적극적으로
활용하는 방향을 취한다. 자식 쪽에서 `CustomEvent`를 dispatch하고, 부모나 상위 영역은
`addEventListener`로 그 이벤트를 받을 수 있다.

```ts
let event = new CustomEvent('album-selected', {
  detail: { slug: 'kind-of-blue' },
  bubbles: true,
})

element.dispatchEvent(event)
```

이 방식은 프레임워크 전용 props 전달보다 웹 플랫폼에 가깝다. 다만 모든 상태 전달을 이벤트로
바꾼다는 뜻은 아니다. “브라우저가 이미 잘하는 일은 브라우저 API로 처리한다”는 방향으로 이해하면
된다.

### RSC에서 HTML 기반 경계로

React Server Components는 서버와 클라이언트 사이에 React 전용 protocol과 component tree 경계를
둔다. Remix 3는 이 방향보다 HTML 기반 경계를 선호한다. 서버가 완성된 HTML 조각을 반환하고,
브라우저가 그 조각을 필요한 영역에 교체해 넣는 방식이다.

개념적으로는 HTMX의 사고방식과 비슷하다.

1. 클라이언트가 특정 영역의 갱신을 서버에 요청한다.
2. 서버는 JSON이나 React 전용 payload가 아니라 렌더링이 끝난 HTML 조각을 반환한다.
3. 클라이언트는 받은 HTML을 지정된 경계에 반영한다.

이 관점은 이후 Frames, 부분 업데이트, progressive enhancement를 이해하는 데 중요하다.

### Node 전용 `req`/`res`에서 표준 `Request`/`Response`로

Remix 2 시절에는 런타임마다 요청과 응답을 표현하는 방식이 달랐다.

- Node.js: `http.IncomingMessage`, `http.ServerResponse`
- Cloudflare Workers, Deno, Bun: Fetch API의 `Request`, `Response`

이 차이 때문에 Node용 adapter, Cloudflare용 adapter처럼 런타임별 변환 계층이 필요했다. Remix 3는
시작점부터 웹 표준 `Request`와 `Response`를 중심으로 동작한다. 따라서 서버 action은 Node 전용
객체가 아니라 Web API를 기준으로 작성한다.

```ts
export async function action(request: Request) {
  let formData = await request.formData()
  return new Response('OK', { status: 200 })
}
```

이 프로젝트에서도 controller는 Web `Response`를 반환한다. HTML, redirect, JSON, 404 모두 같은
응답 모델 위에 있다.

### 가상 DOM 의존 제거와 명시적 업데이트

React에서는 상태가 바뀌면 React가 virtual DOM tree를 다시 계산하고 실제 DOM과의 차이를 반영한다.

```jsx
function Counter() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(count + 1)}>{count}</button>
}
```

Remix UI는 React hook이나 React rendering lifecycle을 사용하지 않는다. 컴포넌트 setup scope에 상태를
두고, 상태를 바꾼 뒤 명시적으로 update를 요청한다.

```tsx
function Counter(handle) {
  let count = 0

  return () => (
    <button
      onclick={() => {
        count++
        handle.update()
      }}
    >
      {count}
    </button>
  )
}
```

이 방식은 자동 재렌더링에 익숙한 개발자에게는 학습 곡선이 있지만, 어떤 상태 변화가 UI update를
일으키는지 더 직접적으로 드러난다.

## 2. Remix 3를 이끄는 여섯 가지 원칙

### 1. 모델 중심 개발

Remix 3는 개발자와 AI 도구가 모두 이해하기 쉬운 명확한 코드 구조를 선호한다. route, controller,
request, response가 런타임 코드로 드러나면 에이전트도 파일을 따라가며 변경 지점을 찾기 쉽다.

```tsx
export const handlers = {
  async GET({ params }) {
    const post = await getPost(params.slug)
    if (!post) return render(<NotFound />, { status: 404 })
    return render(<PostPage post={post} />)
  },

  async POST({ request, params }) {
    const form = await request.formData()
    const comment = form.get('comment')
    await saveComment(params.slug, comment)
    return redirect(routes.posts.show.href({ slug: params.slug }))
  },
}
```

### 2. 웹 API 기반

Remix 3는 framework-specific request abstraction보다 Fetch, `Request`, `Response`, `FormData` 같은
표준 API를 중심으로 설계한다.

```ts
const formData = await request.formData()
const title = formData.get('title')

return new Response('OK', { status: 200 })
```

### 3. 런타임 중심

빌드 시점의 마법이나 과도한 code generation보다 런타임 JavaScript가 그대로 실행할 수 있는 구조를
선호한다. routes, middleware, controllers, tests가 일반 코드처럼 실행되는 것이 중요하다.

### 4. 무거운 의존성 배제

Remix 3는 React, Express 같은 큰 라이브러리에 모든 것을 맡기기보다 작고 집중된 모듈을 선호한다.
목표는 더 적은 dependency surface, 빠른 실행, 더 명확한 ownership이다.

### 5. 조합 가능성 요구

router, server utilities, UI runtime 같은 구성 요소는 독립적으로도 의미가 있어야 한다. 전체
framework를 쓰는 경우에도 내부 조각들이 분리되어 있으면 학습과 교체가 쉬워진다.

### 6. 단일 패키지 배포

내부는 모듈식으로 나누되, 사용자는 하나의 `remix` package와 subpath imports로 접근한다.

```ts
import { get, route } from 'remix/routes'
import { createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'
```

## 3. 주요 신기능과 방향성

### 타입 안정적 라우터

Remix 3는 파일명 규칙만으로 route를 추론하기보다 코드로 route contract를 정의하는 방식을 쓴다.
이 route map은 URL 생성, params typing, controller mapping, tests의 기준이 된다.

```ts
import { form, get, resources, route } from 'remix/routes'

export const routes = route({
  assets: get('/assets/*path'),
  home: get('/'),
  auth: {
    login: form('login'),
    logout: form('logout'),
    verifyEmail: form('verify-email'),
  },
  dashboard: get('/dashboard'),
  cases: resources('cases', { only: ['index', 'new', 'create', 'show'] }),
})

export const remixClientEntryAssetPath = 'app/assets/entry.ts'

export const remixClientEntryAssetHref = routes.assets.href({
  path: remixClientEntryAssetPath,
})
```

### Frames와 부분 업데이트

Frames는 서버가 작은 HTML 조각을 보내고 브라우저가 해당 영역을 갱신하는 방향의 기능이다. JSON API와
복잡한 client state 관리 없이도 부분 갱신과 streaming을 다룰 수 있게 한다.

```tsx
export function CommentsSection({ postId, comments }) {
  return (
    <frame id="comments-frame">
      <ul>
        {comments.map((comment) => (
          <li key={comment.id}>{comment.text}</li>
        ))}
      </ul>
      <form action={`/posts/${postId}/comments`} method="POST" target="#comments-frame">
        <input name="comment" required />
        <button type="submit">댓글 작성</button>
      </form>
    </frame>
  )
}
```

### 기존 Remix 패턴의 유지

Remix 3가 React 의존성을 줄이고 runtime 모델을 바꾸더라도, Remix의 핵심 패턴은 이어진다.

- GET으로 데이터 로딩
- POST, PUT, DELETE로 mutation
- route별 controller/action
- 명시적인 redirect와 HTTP error response
- route 경계에 맞춘 오류 처리

```tsx
export const handlers = {
  async GET({ params }) {
    const post = await getPost(params.slug)
    if (!post) {
      throw new Response('게시글을 찾을 수 없습니다.', { status: 404 })
    }
    return render(<PostPage post={post} />)
  },

  async POST({ request, params }) {
    const form = await request.formData()
    const comment = form.get('comment')
    await saveComment(params.slug, comment)
    return redirect(routes.posts.show.href({ slug: params.slug }))
  },
}
```

## 4. 장단점

### 장점

- 클라이언트 JavaScript 용량을 줄일 수 있다.
- server-rendered HTML과 표준 Web API를 중심으로 성능을 끌어내기 쉽다.
- Node, Deno, Bun, Workers 같은 런타임 사이의 개념 차이가 줄어든다.
- route contract와 controller가 코드로 드러나 에이전트와 사람이 함께 이해하기 쉽다.

### 단점

- React 생태계의 UI library, hook 기반 state library, React Query 같은 도구와 직접 호환되지 않는다.
- 자동 재렌더링과 hook에 익숙한 개발자는 Remix UI의 explicit update 모델을 새로 익혀야 한다.
- Remix 3 beta 단계의 API는 변동 가능성이 있으므로, 공식 문서와 현재 설치된 package를 계속 확인해야 한다.

## 5. 일반적인 파일 구조

```text
my-remix-app/
├── server.ts              # 해당 런타임의 요청 엔트리포인트
└── app/
    ├── routes.ts          # 라우트 정의, 라우트 맵, URL 헬퍼
    ├── router.ts          # 미들웨어, 라우트, 컨트롤러 매핑
    ├── middleware/        # 요청 미들웨어 및 컨텍스트 제공자
    ├── actions/           # 컨트롤러, 라우트 액션, 라우트 로컬 UI
    ├── ui/                # 공유 뷰, 레이아웃, Remix 컴포넌트
    ├── assets.ts          # 브라우저 모듈 서버 설정
    └── entry.browser.ts   # 브라우저 런타임 시작점
```

HTTP 요청은 `server.ts`로 들어와 `app/router.ts`로 전달된다. 그 뒤 middleware를 거쳐
`app/routes.ts`의 route definition과 매칭되고, `app/actions/`의 route action에 의해 처리되어 Web
`Response`를 반환한다.

## 6. 이 커리큘럼에서 코드 변경을 하지 않는 이유

0번 커리큘럼은 Remix 3의 방향성, Remix 2와의 차이, 학습 관점을 잡기 위한 이론 문서다. 여기서
프로젝트 코드를 바꾸기 시작하면 1번 Start Here 실습과 역할이 겹친다.

따라서 0번에서는 코드 변경 없이 다음 질문에 답할 수 있으면 충분하다.

1. Remix 3는 왜 React 의존성을 줄이려 하는가?
2. `Request`/`Response` 중심 모델이 왜 중요한가?
3. route contract를 코드로 정의하면 어떤 장점이 있는가?
4. HTML 기반 부분 업데이트는 JSON API 중심 client state 관리와 무엇이 다른가?
5. Remix UI의 explicit update 모델은 React hook 모델과 어떻게 다른가?
