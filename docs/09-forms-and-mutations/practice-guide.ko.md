# Forms and Mutations

원문: [Forms and Mutations | Remix Docs](https://guides.remix.run/forms-and-mutations/) ·
전문 번역: [`original-translation.ko.md`](./original-translation.ko.md)

이 문서 하나로 챕터의 개념을 익히고, `vinyl-shelf` 프로젝트 코드로 실습한다. 각 절은 먼저
개념을 설명하고, **vinyl-shelf에서는** 단락에서 이 프로젝트의 실제 코드와 연결한다. 개념
설명에 붙은 코드 블록은 API의 모양만 보여주는 것이고, **vinyl-shelf에서는** 쪽 블록은 위에
적은 경로의 실제 파일 내용이다.

이 문서의 코드와 파일 경로는 `curriculum 09: Forms and Mutations` 커밋 시점 기준이다.

이 챕터는 **mutation**(데이터를 바꾸는 요청) 하나가 거치는 길을 끝까지 본다. 앨범을 추가하고
수정하고 지우는 것은 앞 챕터들에서 이미 만들었다. 이 챕터에서는 그 form이 결과에 따라 어떤
응답을 돌려주는지를 본다. 응답이 네 가지로 갈린다 — 성공하면 303, 입력이 잘못됐으면 400, 그
사이 남이 먼저 저장했으면 409, 같은 자리에 머무르는 저장이면 200.

만드는 순서도 정해져 있다. **JavaScript 없는 경로를 먼저 올바르게 만들고, 그 위에 개선을
얹는다.** 거꾸로 하면 개선을 없앴을 때 동작하지 않는 form이 남는다.

## 1. HTML이 먼저인 form 작업 흐름

form 제출은 브라우저 이벤트이기 전에 HTTP POST 요청이다. `<form method="post">`는 JavaScript가
한 줄도 없어도 서버로 요청을 보낸다. 필요한 것은 셋뿐이다.

- **진짜 `<form method="post">`** — `action` 속성에 보낼 URL을 적는다.
- **`name`이 붙은 기본 control** — `<input name="title">`처럼. `name`이 없는 입력칸은 제출되지
  않는다.
- **submit 버튼** — `<button type="submit">`.

action URL은 직접 문자열로 적지 않고 `routes.<name>.href(...)`로 만든다. URL이 한 곳에서만
정의되므로 route를 고치면 link·form·redirect·테스트가 전부 같이 바뀐다.

controller는 **예상되는 모든 결과마다 명시적인 `Response`를 돌려준다.** 잘못된 입력, 없는 행,
충돌은 예외가 아니라 그 route가 의도한 응답이다. 예외로 던져서 바깥에서 잡는 구조로 만들면 이
route가 어떤 상태 코드를 낼 수 있는지가 코드에서 보이지 않는다.

### vinyl-shelf에서는

앨범 추가 form이 이 모양 그대로다. `app/ui/vinyl-shelf.tsx`:

```tsx
<form method="post" action={routes.albums.create.href()} mix={panelStyle}>
  <h2 mix={headingStyle}>Add album</h2>
  <TextField name="title" label="Title" value={values.title} error={errors.title} />
  ...
  <button type="submit" class="shelf-cta" mix={button({ tone: 'primary', size: 'lg' })}>
    Add album
  </button>
</form>
```

이 form에는 hydrate되는 컴포넌트가 하나도 없다. 브라우저 JavaScript를 전부 끄고도 앨범이
추가된다. 직접 확인해 보려면 dev tools의 Network 탭을 열고 제출해 보자 — POST 다음에 303,
그다음 GET이 보인다.

`routes.albums.create.href()`가 만드는 URL은 `/albums`다. `app/routes.ts`에서 같은 경로에 GET과
POST를 따로 정의했기 때문에, 목록을 보는 요청과 추가하는 요청이 다른 action으로 간다.

```ts
albums: {
  index: get('/albums'),
  create: post('/albums'),
  ...
}
```

## 2. form route와 controller 소유

form 하나는 보통 URL 두 개가 필요하다. form을 보여주는 GET과 제출을 받는 POST다. `form(path)`가
그 쌍을 한 번에 만든다.

```ts
edit: form('/albums/:slug/edit')
```

이렇게 하면 leaf 두 개가 생긴다.

- `routes.albums.edit.index` — GET. form 페이지.
- `routes.albums.edit.action` — POST. 제출 처리.

**두 leaf는 같은 route map에 있으므로 controller도 하나다.** 그 map을 `router.map`에 넘겨 연결한다.
`router.map`은 넘긴 map의 직접 leaf만 연결하므로, 중첩 map은 자기 controller를 따로 등록해야 한다.

action 이름이나 method는 URL 계약에 이득이 있을 때만 직접 지정한다. 기본 `index`/`action` 쌍으로
충분한데 이름을 바꾸면, 읽는 사람이 route 정의를 찾아봐야 무슨 URL인지 알게 된다.

### vinyl-shelf에서는

`app/routes.ts`의 `edit`이 `form()`으로 정의되어 있고, 나머지 앨범 route는 개별 method로 적혀
있다.

```ts
albums: {
  index: get('/albums'),
  create: post('/albums'),
  show: get('/albums/:slug'),
  recommendations: get('/albums/:slug/recommendations'),
  destroy: del('/albums/:slug'),
  edit: form('/albums/:slug/edit'),
},
```

`create`와 `destroy`는 form 페이지가 따로 없다 — 추가 form은 목록 페이지 안에 있고, 삭제 form은
상세 페이지 안에 있다. 그래서 `form()`이 아니라 `post()`와 `del()`이다. 반면 `edit`은 자기 페이지가
있어서 GET과 POST 쌍이 맞다.

controller 연결은 `app/router.ts`에 세 줄로 나와 있다.

```ts
router.map(routes, controller)
router.map(routes.albums, albumsController)
router.map(routes.albums.edit, albumsEditController)
```

`routes.albums.edit`이 중첩 map이라서 세 번째 줄이 필요하다. 이 줄을 지우면 `/albums/:slug/edit`
요청이 어느 action에도 닿지 않는다. `app/actions/albums/edit/controller.tsx`의 디렉터리 이름
`edit`은 URL 경로가 아니라 route map의 key에서 온 것이다.

## 3. FormData를 한 번 parse하고, 그다음 검증한다

`request.formData()`는 요청 body를 읽는다. body는 한 번만 읽을 수 있는 stream이므로, 여러 군데서
부르면 곤란해진다. 그래서 `formData()` middleware가 요청마다 한 번 parse해서 context에 넣는다.

설치 순서에 규칙이 하나 있다. **form 필드에 의존하는 middleware보다 앞에 둔다.** 뒤에 두면 그
middleware가 볼 값이 아직 없다.

parse와 검증은 다른 일이다. `formData()`는 body를 `FormData` 객체로 만드는 것까지만 한다. 그 안의
값이 쓸 수 있는 값인지는 `remix/data-schema/form-data` schema가 본다.

검증해야 할 것이 입력칸 값만은 아니다. 아래 네 가지가 모두 boundary에서 처리할 일이다 — action
안에서 `if`로 확인할 일이 아니다.

- **없는 필드** — 사용자가 HTML을 고쳐 입력칸을 지울 수 있다.
- **반복된 필드** — 같은 `name`이 여러 번 올 수 있다. `f.fields(...)`가 배열로 모은다.
- **체크박스** — 체크하지 않으면 아예 안 온다. 값이 `'off'`로 오지 않는다.
- **coercion** — 숫자 입력칸도 문자열로 온다.

### vinyl-shelf에서는

`formData()`는 `app/router.ts`에서 `methodOverride()` 앞에 있다. 7절에서 왜 그 순서인지 다룬다.

수정 form의 schema가 이 챕터에서 커졌다. 입력칸 다섯 개 말고 숨은 값 둘을 더 받는다.
`app/data/validation.ts`:

```ts
export const albumFormSchema = f.object(albumFields)

export const albumEditFormSchema = f.object({
  ...albumFields,
  intent: f.field(intentField),
  revision: f.field(revisionField),
})
```

추가 form과 수정 form이 입력칸은 같고 숨은 값만 다르므로, 공통 필드를 `albumFields`로 빼고 수정
쪽에서 펼쳤다. `intent`는 6절, `revision`은 9절에서 다룬다.

`revision`은 숫자여야 하므로 coercion이 필요하다.

```ts
// A missing revision lands on 0, which matches no stored album, so the action
// answers with a conflict instead of writing blind.
const revisionField = s.defaulted(coerce.number(), 0).transform((value) => Math.trunc(value))
```

`defaulted(..., 0)`가 "없는 필드"를 받아낸다. 숨은 입력칸을 지우고 제출하면 `0`이 되고, 저장된
앨범의 revision은 1부터 시작하므로 어느 것과도 맞지 않아 409가 된다. 이렇게 두면 revision을 안
보낸 제출이 검사를 건너뛰고 덮어쓰는 일이 없다.

파일 업로드(`f.file`, `f.files`)는 이 프로젝트에 아직 없다. asset/file handling 챕터에서 다룬다.

## 4. 검증 실패를 form과 함께 돌려준다

검증이 실패하면 `400`과 함께 **form을 다시 렌더링한다.** 세 가지를 같이 담는다.

1. 사용자가 입력한 값 — 다시 타이핑하게 만들지 않는다.
2. 어느 입력칸이 왜 잘못됐는지 — 필드 옆에 붙인다.
3. `400` 상태 — 응답이 성공이 아니라는 사실.

에러 메시지는 페이지 맨 위에 한 덩어리로 모으지 않고 필드 옆에 둔다. 입력칸이 다섯 개인데
"입력이 잘못되었습니다"만 보이면 어디를 고쳐야 하는지 알 수 없다.

다시 채우지 말아야 하는 값이 둘 있다. **password와 파일**이다. password를 HTML에 다시 써 보내면
그 값이 브라우저 캐시와 서버 로그에 남는다. 파일은 값을 다시 채울 방법 자체가 없다 —
`<input type="file">`은 스크립트로 값을 설정할 수 없다.

### vinyl-shelf에서는

`validateEditAlbum`이 실패하면 에러와 값을 함께 돌려주고, action이 그것을 400 응답으로 만든다.
`app/actions/albums/edit/controller.tsx`:

```tsx
if (!result.ok) {
  if (asJson) {
    return json({ errors: result.errors, values: result.values }, 400)
  }

  let album = await getAlbum(context.db, context.params.slug)
  if (!album) {
    return context.render(<NotFoundPage slug={context.params.slug} />, { status: 404 })
  }

  return context.render(
    <AlbumEditPage album={album} errors={result.errors} values={result.values} />,
    { status: 400 },
  )
}
```

검증 실패 경로에서 앨범을 다시 읽는 이유는 페이지 제목과 breadcrumb에 앨범 정보가 필요하기
때문이다. 그 사이 앨범이 지워졌으면 400이 아니라 404가 맞다.

**검증이 revision 확인보다 먼저다.** 순서를 거꾸로 두면 제목을 비운 채 오래된 form으로 제출한
사용자가 409를 받는다. 고칠 수 있는 문제(제목 비었음)를 놔두고 고치기 어려운 문제(충돌)를 먼저
보여주는 셈이다. 테스트가 이 순서를 고정한다. `app/actions/controller.test.ts`:

```ts
// A stale revision and an empty title at once: the user sees the fixable
// problem, and nothing is written.
let response = await editAlbum({ title: '', revision: '99' })

assert.equal(response.status, 400)
assert.match(await response.text(), /Title is required/)
```

password와 파일 입력칸은 이 form에 없다. auth 챕터에서 로그인 form이 생기면 password를 다시
채우지 않는 처리를 그때 한다.

## 5. mutation이 성공하면 redirect한다

성공한 POST에 페이지를 직접 그려 주면 안 된다. 그 상태로 사용자가 새로고침하면 브라우저가
**같은 POST를 다시 보낸다.** 앨범이 두 개 생긴다.

그래서 `303 See Other`로 결과 페이지로 보낸다. 브라우저는 그 URL로 GET을 보내고, 주소창에는 GET
URL이 남는다. 새로고침해도 GET이 다시 갈 뿐이다. 이 세 단계를 **PRG**(Post/Redirect/Get)라고
부른다.

`303`을 쓰는 이유는 `302`와 달리 "다음 요청은 GET으로 하라"가 명세에 박혀 있기 때문이다.

성공 메시지를 보여주려면 한 가지 문제가 생긴다. redirect 후의 GET은 별개의 요청이라서, POST에서
만든 메시지를 들고 갈 방법이 없다. 여기에 쓰는 것이 **session flash 데이터**다 — 한 번 읽히면
사라지는 session 값이다. session은 auth, session, security 챕터에서 다룬다.

### vinyl-shelf에서는

성공한 mutation 세 곳이 모두 303이다.

앨범 추가는 상세 페이지로 (`app/actions/albums/controller.tsx`):

```tsx
let album = await createAlbum(context.db, result.value)
return redirect(routes.albums.show.href({ slug: album.slug }), 303)
```

삭제는 목록으로 (같은 파일의 `destroy`):

```tsx
return redirect(routes.albums.index.href(), 303)
```

수정은 상세 페이지로 (`app/actions/albums/edit/controller.tsx`의 마지막 줄):

```tsx
return redirect(routes.albums.show.href({ slug: outcome.album.slug }), 303)
```

`context.params.slug`가 아니라 `outcome.album.slug`를 쓴다. 나중에 수정이 slug를 바꿀 수 있게
되면, 요청에 담겨 온 옛 slug로 보내면 없는 URL이 된다. 실제로 저장된 행에서 읽으면 그 일이 안
생긴다.

성공 메시지는 아직 없다. 저장하면 상세 페이지로 이동하고, 거기서 바뀐 내용이 보인다. flash
메시지를 쓰려면 session이 필요해서 auth 챕터로 미뤘다.

## 6. 여러 submit intent와 mutation 응답

form 하나에 서로 관련된 동작이 몇 개 있을 때, form을 여러 개로 쪼개지 않고 **`name`이 붙은 submit
버튼**을 쓴다.

```html
<button type="submit" name="intent" value="save">Save</button>
<button type="submit" name="intent" value="save-and-continue">Save and keep editing</button>
```

브라우저는 **누른 버튼의 `name`과 `value`만** body에 넣는다. 다른 버튼의 값은 안 간다. 그래서
action이 `intent`를 읽으면 어느 버튼이었는지 알 수 있다.

form을 쪼개지 않는 이유는 입력칸이다. 두 동작이 같은 입력칸 값을 쓰는데 form이 둘이면 입력칸도
복사해야 한다.

응답은 **부르는 쪽에 맞춰 고른다.**

| 경우 | 돌려줄 것 |
| --- | --- |
| 그 자리에서 실패를 보여줄 때 | 렌더링된 HTML (400/409) |
| 보통의 브라우저 성공 | redirect (303) |
| 정말로 데이터로 소비되는 endpoint | JSON |

"정말로 데이터로 소비되는"이 조건이다. HTML 응답과 redirect로 충분한 form에 JSON 계층을 덧붙이면
같은 동작이 두 경로로 갈라진다. 10절에서 다시 다룬다.

### vinyl-shelf에서는

수정 form에 버튼이 둘이다. `app/assets/album-edit-form.tsx`:

```tsx
<button type="submit" name="intent" value="save" ...>
  {pending ? 'Saving…' : 'Save changes'}
</button>

<button type="submit" name="intent" value="save-and-continue" ...>
  Save and keep editing
</button>
```

`save`는 상세 페이지로 303, `save-and-continue`는 수정 페이지를 200으로 다시 그린다. 화면에서
`Save and keep editing`을 누르면 주소창이 그대로이고 form 위에 `Saved. Keep editing or open the
album.`이 뜬다.

`intent` 값도 검증을 거친다. 다만 다른 필드와 처리가 다르다. `app/data/validation.ts`:

```ts
/**
 * An unrecognized intent means a stale or edited form, not a typo the user can
 * fix, so it collapses to the default action instead of becoming an error.
 */
const intentField = s
  .defaulted(s.string(), 'save')
  .transform((value): SaveIntent => (value === 'save-and-continue' ? 'save-and-continue' : 'save'))
```

모르는 `intent`를 에러로 만들지 않은 이유는 사용자가 고칠 수 있는 문제가 아니기 때문이다.
입력칸 값이 잘못된 것은 사용자가 다시 쓰면 되지만, `intent`는 사용자가 본 적 없는 숨은 값이다.
오래된 탭에 남아 있던 form이나 누가 손댄 form에서 올 뿐이므로, 기본 동작으로 처리한다.
`.transform`을 쓰면 출력 타입이 `SaveIntent`로 좁혀져서 action 쪽에서 분기가 두 가지로 끝난다.

테스트가 이 선택을 고정한다.

```ts
it('treats an unrecognized intent as a plain save instead of an error', async () => {
  let response = await editAlbum({ intent: 'drop-the-table' })

  assert.equal(response.status, 303)
  ...
})
```

## 7. HTML form에서 PUT, PATCH, DELETE 쓰기

HTML form은 **GET과 POST만** 보낸다. `<form method="delete">`는 동작하지 않는다 — 브라우저가 GET으로
처리한다. fetch로는 어떤 method든 보낼 수 있지만, JavaScript 없이 동작하는 form을 먼저 만들기로
했으니 여기서 막힌다.

해결은 숨은 필드 하나다. form은 POST로 보내고, 안에 `_method`로 진짜 method를 적어 둔다.
`methodOverride()` middleware가 그 값을 읽어 요청의 method를 바꾼다. route는 `del(...)`로 정의되어
있어도 된다.

**`methodOverride()`는 `formData()` 뒤에 와야 한다.** `_method`는 form body에 있고, body를 아직
읽지 않았으면 볼 값이 없다.

method를 URL 계약에 드러낼지는 선택이다. `POST /albums/:slug/delete`로 두면 middleware가 필요
없다. `DELETE /albums/:slug`로 두면 URL 하나가 행 하나를 뜻하고 동작은 method가 말한다.

### vinyl-shelf에서는

삭제 form이 `_method`를 쓴다. `app/ui/vinyl-shelf.tsx`:

```tsx
<form method="post" action={routes.albums.destroy.href({ slug: album.slug })}>
  <input type="hidden" name="_method" value="DELETE" />
  <button type="submit" mix={dangerButtonStyle}>
    Delete album
  </button>
</form>
```

route는 `destroy: del('/albums/:slug')`이고, URL은 상세 페이지와 같은 `/albums/:slug`다. 같은 URL이
GET이면 앨범을 보여주고 DELETE면 지운다.

middleware 순서는 `app/router.ts`에 있다.

```ts
middleware: [
  staticFiles('./public', { index: false }),
  requestId(),
  formData(),
  methodOverride(),
  loadDatabase(),
  render(),
],
```

`formData()`와 `methodOverride()`의 순서를 바꿔 보면 삭제 버튼이 404를 낸다 — 요청이 POST로 남아
`/albums/:slug`의 POST route를 찾다가 없어서다. 확인했으면 되돌리자.

## 8. action을 바꾸지 않고 제출을 개선한다

서버 경로가 올바르게 동작한 뒤에, 같은 form에 브라우저 동작을 얹는다. hydrate된 컴포넌트가 submit을
가로채서 직접 요청을 보내는 방식이다. 순서는 이렇다.

1. `submit` 이벤트에서 `event.preventDefault()`를 부른다.
2. `new FormData(form, event.submitter)`로 body를 만든다.
3. `fetch`로 **같은 action URL에** 보낸다. event의 abort signal을 같이 넘긴다.
4. 응답을 보고 이동하거나, 그 자리에서 상태를 바꾼다.

지켜야 할 선이 하나 있다. **개선을 없애도 서버 action이 그대로 올바르게 동작해야 한다.** 그래서
가로챈 요청도 같은 URL, 같은 필드 이름으로 보낸다. 브라우저 전용 경로를 따로 만들면 두 경로가
갈라진다.

`event.submitter`를 넘기는 것이 중요하다. `new FormData(form)`만 쓰면 **누른 버튼의 `name`과 `value`가
body에 들어가지 않는다.** 6절의 `intent`가 사라지고, action은 모든 제출을 기본 동작으로 읽는다.
JavaScript를 끄면 제대로 되는데 켜면 안 되는, 찾기 까다로운 증상이 된다.

abort signal은 제출이 여러 번 겹칠 때 쓴다. 사용자가 빠르게 두 번 누르면 앞 요청이 취소되고, 취소된
요청의 응답으로 화면을 바꾸지 않도록 `signal.aborted`를 확인한다.

### vinyl-shelf에서는

`app/assets/album-edit-form.tsx`의 submit 핸들러가 그 순서 그대로다.

```tsx
let response = await fetch(form.action, {
  // Passing the submitter keeps the pressed button's name/value in the body.
  // `new FormData(form)` alone drops it, and the action would read every
  // submission as the default intent.
  body: new FormData(form, event.submitter),
  method: form.method,
  headers: { Accept: 'application/json' },
  signal,
})
```

`form.action`과 `form.method`를 읽어 쓴다. URL을 따로 적지 않았으므로 서버 쪽 route를 바꾸면 이
코드도 자동으로 따라간다.

`Accept: application/json` 헤더가 서버에게 "이 요청은 개선된 form이 보낸 것"이라고 알린다. action은
같은 결과를 HTML이나 JSON으로 골라 돌려준다.

응답 처리는 네 갈래다.

```tsx
if (response.ok && isJson(response)) {
  // save-and-continue: the action stayed on this page and returned
  // the revision the next submission has to carry.
  ...
}

if (response.ok) {
  // The action answered with a redirect, which fetch followed.
  // Follow the controller's destination instead of guessing one.
  await navigate(response.url, { history: 'replace' })
  return
}

if (response.status === 409) { ... }
else if (response.status === 400) { ... }
```

`response.ok`인데 JSON이 아니면 redirect를 따라간 끝이다. `fetch`가 303을 자동으로 따라가므로
`response.url`은 상세 페이지 주소다. 그 주소를 직접 만들지 않고 응답에서 읽는 것이 요점이다 —
이동할 곳을 정하는 일은 controller가 계속 맡는다.

개선을 없애도 되는지는 실제로 확인할 수 있다. 브라우저에서 JavaScript를 끄고 수정 form을 제출해
보면 두 버튼이 모두 동작한다. `Save changes`는 상세 페이지로 이동하고, `Save and keep editing`은
수정 페이지를 다시 그린다.

## 9. pending, optimistic, 그리고 충돌하는 mutation

제출 중에 화면이 아무 반응도 없으면 사용자는 버튼을 또 누른다. 그래서 **시도한 작업을 setup
scope에 들고 있는다.** 그 값으로 두 가지를 한다 — 중복 control을 비활성화하고, 진행 중임을
보여준다.

한 걸음 더 나간 것이 **optimistic 렌더링**이다. 서버 응답을 기다리지 않고 성공했을 때의 화면을
먼저 그린다. 실패하면 되돌린다. 되돌리는 코드를 반드시 써야 하므로, 실패가 드물고 되돌릴 화면이
분명할 때만 쓸 만하다.

세 번째가 **충돌**이다. 두 사람이 같은 행을 동시에 고치면 나중에 저장한 쪽이 앞사람의 변경을
덮어쓴다. 에러도 안 나고 기록도 안 남는다. 막는 방법은 앱이 소유하는 **revision**이나
**precondition**이다. 구조는 이렇다.

1. form을 그릴 때 그 행의 현재 revision을 숨은 필드에 담는다
2. 제출을 받으면 담겨 온 revision과 지금 저장된 revision을 비교한다
3. 다르면 `409 Conflict`를 돌려준다. 그 사이 누군가 저장했다는 뜻이다
4. 같으면 저장하고 revision을 올린다

2번과 4번은 한 transaction 안에 있어야 한다. 떨어져 있으면 두 제출이 모두 2번을 통과하고 나서
차례로 저장해 버린다.

### vinyl-shelf에서는

이 챕터에서 `albums` table에 `revision` column이 생겼다. migration을 새로 추가했고 기존
migration은 건드리지 않았다.

`db/migrations/20260913000000_add_albums_revision/up.sql`

```sql
alter table albums add column revision integer not null default 1;
```

`app/data/schema.ts` — 같은 제약을 table 선언에도 적는다 (8장의 규칙)

```ts
// Bumped on every update so an edit form can say which version it was
// built from. Two people editing the same album no longer overwrite each
// other silently.
revision: c.integer().notNull().default(1),
```

8장에서 `updateAlbum`은 transaction 없이 slug로 읽고 id로 썼고, 그 문서에 "아직 묶지 않았다"고
적어 두었다. revision 비교가 들어오면서 그 말이 더 이상 통하지 않는다 — 읽은 revision으로 쓰기를
결정하므로 둘이 한 묶음이어야 한다.

`app/data/albums.ts` 8장 상태 — 읽고 그냥 썼다

```ts
export async function updateAlbum(db: Database, slug: string, input: CreateAlbumInput) {
  let album = await getAlbum(db, slug)
  if (!album) return null

  return db.update(albums, album.id, input)
}
```

`app/data/albums.ts` 지금 — revision을 비교하고, 읽기와 쓰기를 한 transaction에 넣었다

```ts
export async function updateAlbum(
  db: Database,
  slug: string,
  expectedRevision: number,
  input: CreateAlbumInput,
): Promise<UpdateAlbumResult> {
  return db.transaction(async (tx) => {
    let album = await getAlbum(tx, slug)
    if (!album) return { ok: false, reason: 'not-found' }
    if (album.revision !== expectedRevision) return { ok: false, reason: 'conflict', album }

    let updated = await tx.update(albums, album.id, {
      ...input,
      revision: album.revision + 1,
    })
    return { ok: true, album: updated }
  })
}
```

반환 타입이 `null`에서 세 갈래로 바뀌었다. controller가 결과마다 다른 응답을 내야 하기 때문이다.

```ts
export type UpdateAlbumResult =
  | { ok: true; album: Album }
  | { ok: false; reason: 'not-found' }
  /** `album` is the row as it stands now, so the form can show what it lost. */
  | { ok: false; reason: 'conflict'; album: Album }
```

충돌 응답은 `app/actions/albums/edit/controller.tsx`에서 만든다.

```tsx
if (!outcome.ok) {
  // Someone else saved first. 409 says the request was well-formed but no
  // longer applies, so the form comes back with the newer revision and
  // the values this user typed.
  if (asJson) {
    return json({ conflict: true, revision: outcome.album.revision }, 409)
  }

  return context.render(
    <AlbumEditPage album={outcome.album} values={result.values} notice="conflict" />,
    { status: 409 },
  )
}
```

`album`은 지금 저장된 행이고 `values`는 이 사용자가 쓴 값이다. 그래서 화면에는 입력칸에 사용자
글이 그대로 남아 있고, 숨은 revision만 새것으로 바뀐다. 다시 누르면 이번에는 저장된다 — 앞사람
변경을 덮어쓰겠다고 사용자가 한 번 더 선택한 셈이다.

화면에 보이는 증상은 이렇다. 탭 두 개에서 같은 앨범의 수정 페이지를 열고, 한쪽에서 저장한 뒤
다른 쪽에서 저장하면 `Someone else saved this album first. Your text is still here — submit again
to keep it.`이 뜬다. 8장 상태에서는 아무 말 없이 앞 저장이 사라졌다.

테스트가 이 흐름 전체를 고정한다. `app/actions/controller.test.ts`:

```ts
it('rejects a second save built from a revision that is already stale', async () => {
  assert.equal((await editAlbum({ notes: 'First writer wins.' })).status, 303)

  let response = await editAlbum({ notes: 'Second writer is late.' })
  ...
  assert.equal(response.status, 409)
  assert.match(html, /Second writer is late\./)
  assert.match(html, /<input type="hidden" name="revision" value="2"/)

  let album = await db.findOne(albums, { where: { slug: 'kind-of-blue' } })
  assert.equal(album?.notes, 'First writer wins.')
})
```

pending 상태는 5장에서 이미 만들었다. `pending`이 setup 변수이고, 버튼이 그 값으로 비활성화된다.

```tsx
let pending = false
```

개선된 제출에서 revision을 들고 있어야 하는 이유가 하나 더 있다. `save-and-continue`로 저장하면
페이지가 다시 로드되지 않으므로, 숨은 필드의 revision이 옛것으로 남는다. 그대로 또 저장하면
자기가 방금 한 저장과 충돌한다. 그래서 응답에서 새 revision을 받아 상태를 갱신한다.

```tsx
// The server hands back a new revision after every successful save, so the
// next submission from this same page is not treated as stale.
let revision = handle.props.revision
```

optimistic 렌더링은 쓰지 않았다. `save` intent는 저장 후 다른 페이지로 이동하므로 미리 그릴 화면이
없고, `save-and-continue`는 입력칸 내용이 이미 사용자가 쓴 그대로라 바뀌는 것이 메시지 한 줄뿐이다.
optimistic이 쓸 만한 곳은 삭제다 — 목록에서 행이 즉시 사라지고 실패하면 돌아오는 동작인데, 삭제
form은 아직 hydrate하지 않았다.

## 10. JSON을 돌려줄 때

JSON이 맞는 경우가 정해져 있다. autocomplete, polling, 독립된 widget, 다른 클라이언트가 쓰는 API,
서비스 간 호출이다. 공통점은 **응답을 받는 쪽이 화면이 아니라 코드**라는 것이다.

반대로 하지 말아야 할 것이 분명하다. 이미 쓸모 있는 HTML 응답과 redirect 경로를 갖춘 form에 JSON
mutation 계층을 따로 만드는 것이다. 그러면 같은 동작이 경로 둘로 갈라지고, 한쪽만 고치는 일이
생긴다.

구분이 미묘한 자리가 있다. 개선된 form이 fetch로 보내는 요청은 JSON을 받지만, 그것은 **같은 action이
응답 형식만 바꾼 것**이지 별도 endpoint가 아니다. URL도, 필드 이름도, 검증도, 저장 코드도 하나다.

### vinyl-shelf에서는

JSON을 돌려주는 곳이 두 종류다.

**독립된 endpoint** — `/api/albums`는 검색 상자가 쓰는 조회용 route다.
`app/actions/controller.tsx`:

```tsx
return new Response(JSON.stringify({ albums, query, requestId: context.requestId }), {
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
})
```

이것은 mutation이 아니라 조회이고, 받는 쪽이 `app/assets/album-search.tsx`의 브라우저 코드다. 같은
데이터를 보여주는 HTML 페이지(`/albums`)가 따로 있지만, 검색 상자는 페이지 전체가 아니라 목록만
갱신하면 되므로 JSON이 맞다.

**같은 action의 다른 응답 형식** — 수정 action은 `Accept` 헤더를 보고 형식을 고른다.

```tsx
let result = validateEditAlbum(context.formData)
// The enhanced form asks for JSON so it can stay on the page. A plain
// browser submission gets HTML for every one of these outcomes.
let asJson = wantsJson(context.request)
```

`asJson`은 네 갈래 분기 안에서만 쓰인다. 검증, revision 비교, 저장, redirect 결정은 전부 한
경로다. JSON 쪽만 따로 타는 코드가 없다는 것을 직접 확인해 보려면 `json(`으로 파일을 검색해
보자 — 응답을 만드는 자리에만 나온다.

mutation용 JSON endpoint를 따로 만들지는 않았다. `POST /api/albums`가 없는 것은 빠뜨린 것이 아니다.

## 정독 후 확인 질문

1. 성공한 POST에 페이지를 직접 그려 주면 무엇이 잘못되는가? `303`이 `302`보다 맞는 이유는
   무엇인가?
2. `new FormData(form)`과 `new FormData(form, event.submitter)`는 무엇이 다른가? 차이를 빼먹으면
   어떤 증상이 생기며, 왜 JavaScript를 끄면 안 보이는가?
3. 모르는 `intent` 값은 기본 동작으로 처리하고, 비어 있는 제목은 400으로 돌려준다. 둘을 다르게
   다루는 기준은 무엇인가?
4. 수정 action에서 검증이 revision 비교보다 먼저 와야 하는 이유를, 사용자가 보는 화면으로 설명할
   수 있는가?
5. `updateAlbum`의 revision 비교와 저장이 같은 transaction에 없으면 무엇이 깨지는가? 요청 두 개가
   끼어드는 순서로 설명해 보자.

## 스터디 과제

**앨범 삭제를 충돌로부터 보호한다.** 지금은 상세 페이지에서 삭제를 누르면 그 사이 누가 앨범을
고쳤어도 그냥 지워진다.

1. 상세 페이지의 삭제 form에 `revision` 숨은 필드를 넣는다. 이미 있는 `_method=DELETE`는 그대로
   둔다.
2. 삭제 form에 intent 둘을 만든다 — 보통 삭제와, 충돌을 본 뒤에도 지우겠다는 선택.
3. 삭제 action에서 revision을 검증한다. 담겨 온 revision이 지금 것과 다르면 `409`와 함께, 그 사이
   무엇이 바뀌었는지 알 수 있는 화면을 돌려준다. 두 번째 intent로 오면 revision이 달라도 지운다.
4. 성공한 삭제는 계속 목록으로 `303`이어야 한다.
5. 브라우저 JavaScript 없이 전부 동작해야 한다.
6. `app/actions/controller.test.ts`에 테스트를 셋 추가한다 — 보통 삭제가 303인 것, 오래된
   revision이 409인 것, 두 번째 intent가 409를 지나 삭제하는 것.

409 화면을 어디에 그릴지(상세 페이지, 목록, 전용 확인 페이지)와 "무엇이 바뀌었는지"를 어디까지
보여줄지는 정해 두지 않았다. 각자 고른 뒤 서로 비교해 보자.
