# Data and Validation

원문: [Data and Validation | Remix Docs](https://guides.remix.run/data-and-validation/) ·
전문 번역: [`original-translation.ko.md`](./original-translation.ko.md)

이 문서 하나로 챕터의 개념을 익히고, `vinyl-shelf` 프로젝트 코드로 실습한다. 각 절은 먼저
개념을 설명하고, **vinyl-shelf에서는** 단락에서 이 프로젝트의 실제 코드와 연결한다. 개념
설명에 붙은 코드 블록은 API의 모양만 보여주는 것이고, **vinyl-shelf에서는** 쪽 블록은 위에
적은 경로의 실제 파일 내용이다.

이 문서의 코드와 파일 경로는 `curriculum 08: Data and Validation` 커밋 시점 기준이다.

이 챕터에서 앱이 크게 바뀐다. 지금까지 앨범은 서버 메모리의 배열이었다. 프로세스를 재시작하면
추가한 앨범이 사라졌다. 이 챕터에서 앨범은 SQLite 파일의 행이 되고, 손으로 쓴 검증 함수는
schema로 바뀐다.

검증은 두 곳에서 일어난다. 한 곳은 요청이 앱으로 들어오는 자리, 다른 한 곳은 값이 database로
나가는 자리다. 둘은 막는 것이 다르다 — 앞쪽은 사용자가 잘못 입력한 것을 막고, 뒤쪽은 코드가
잘못 쓰는 것을 막는다. 둘을 하나로 합치려 들면 둘 다 놓친다.

## 1. 모든 trust boundary를 검증한다

**trust boundary**는 앱이 제어하지 않는 값이 앱 안으로 들어오는 경계다. form 입력, route
param, query string, cookie, 외부 서비스가 보낸 JSON이 전부 여기로 들어온다. 이 값들의 공통점은
타입이 보장되지 않는다는 것이다. `year` 입력칸에 `"1959"`가 올 수도 있고 `"서기 1959년"`이 올
수도 있고, 아무것도 안 올 수도 있다.

그래서 경계에서 한 번 parse한다. parse를 통과한 값은 타입이 확정되고, 경계 안쪽 코드는 검증을
다시 하지 않는다. 이렇게 하면 함수마다 "이 값이 숫자인지 또 확인해야 하나"를 다시 따지지
않아도 된다.

parse가 실패했을 때 무엇을 할지는 두 가지로 갈린다.

- **`parseSafe()`** — 실패를 반환값으로 받는다. `{ success: false, issues }`가 돌아오고, action은
  그것을 보고 400 응답을 만든다. form 검증 실패는 정상적인 결과이므로 대개 이쪽이다.
- **`parse()`** — 실패하면 예외를 던진다. 값이 잘못됐으면 요청을 더 진행할 방법이 정말로 없는
  경계에만 쓴다.

### vinyl-shelf에서는

form 검증은 `app/data/validation.ts`의 `validateCreateAlbum` 하나가 맡고, 앨범을 만드는 action과
수정하는 action이 둘 다 이것을 부른다.

`app/data/validation.ts` — 경계 함수의 반환 타입

```ts
export type CreateAlbumResult =
  | { ok: true; value: CreateAlbumInput }
  | { ok: false; errors: AlbumFieldErrors; values: AlbumFormValues }
```

`parseSafe`의 결과를 그대로 밖으로 내보내지 않고 이 모양으로 한 번 바꾼다. 이유는 `values`다.
검증이 실패하면 사용자가 쓰던 값을 form에 다시 채워 보여줘야 하는데, `parseSafe`의 실패 결과에는
원래 입력이 없다. 그래서 `readValues(formData)`로 입력을 따로 읽어 함께 담는다.

action 쪽은 이 결과를 HTTP 응답으로 번역한다. `app/actions/albums/controller.tsx`:

```tsx
let result = validateCreateAlbum(context.formData)

if (!result.ok) {
  return context.render(
    <AlbumsPage albums={await listAlbums(context.db)} errors={result.errors} values={result.values} />,
    { status: 400 },
  )
}
```

`/albums`에서 제목을 비우고 제출해 보면 400이 돌아오는데도 나머지 입력칸이 그대로 남아 있다.
`values`를 같이 넘긴 결과다.

route param은 아직 schema로 parse하지 않는다. `context.params.slug`는 router의 pattern이 이미
문자열임을 보장하고, 없는 slug는 `getAlbum`이 `null`을 돌려줘 404가 된다. param에 형식 제약이
붙는 경우(숫자만, UUID만)는 이 프로젝트에 아직 없다.

## 2. Schema, parsing, issue

`remix/data-schema`는 값의 모양을 선언하고 그 선언으로 parse하는 작은 라이브러리다. 내보내는
것은 크게 셋이다.

**schema를 만드는 함수** — `string()`, `number()`, `boolean()` 같은 primitive, 이것들을 묶는
`object({ ... })`, 하나만 맞으면 되는 `union([...])`, 특정 key로 분기하는 `variant('type', {...})`,
값이 없어도 되게 하는 `optional(...)`과 없을 때 채워 주는 `defaulted(..., fallback)`.

**parse 함수** — `parse(schema, input)`과 `parseSafe(schema, input)`. 둘 다 첫 인자로 schema를
받는 자유 함수이고, schema의 method가 아니다.

**issue** — 실패 하나를 나타내는 객체다. `{ message, path? }` 모양이고, `path`는 object 안에서 그
값이 있던 위치다. 기본 동작은 첫 실패에서 멈추지 않고 전부 모으는 것이다. 그래서 입력칸 다섯
개가 모두 비었으면 issue도 다섯 개 나온다. 첫 하나에서 멈추려면 `{ abortEarly: true }`를 넘긴다.

타입은 schema에서 끌어낸다. `InferOutput<typeof Schema>`가 parse 성공 시 나오는 타입이다.
schema를 고치면 그 타입을 쓰는 자리에서 타입 에러가 나므로, 검증과 타입이 갈라지지 않는다.

`parse`와 `parseSafe`는 **Standard Schema v1**(여러 검증 라이브러리가 공유하는 인터페이스 규약)을
따르는 schema를 전부 받는다. Zod나 Valibot으로 쓴 schema를 그대로 넘겨도 동작한다.

### vinyl-shelf에서는

`app/data/validation.ts`가 form schema 하나를 만들고 `parseSafe`로 부른다.

```ts
let result = s.parseSafe(albumFormSchema, formData)

if (!result.success) {
  let errors: AlbumFieldErrors = {}
  for (let issue of result.issues) {
    let field = issueField(issue)
    if (field && !errors[field]) errors[field] = issue.message
  }
  ...
}
```

issue는 배열로 온다. 화면은 입력칸마다 메시지 하나만 보여주므로, `issue.path`를 읽어 어느 입력칸
것인지 가른다. 같은 입력칸에서 issue가 여러 개 나오면 `!errors[field]` 조건이 첫 번째만 남긴다.

`path`를 읽는 부분이 조금 번거롭다. 같은 파일의 `issueField`다.

```ts
function issueField(issue: s.Issue): (typeof fieldNames)[number] | undefined {
  let segment = issue.path?.[0]
  let key = typeof segment === 'object' && segment !== null ? segment.key : segment
  return fieldNames.find((name) => name === key)
}
```

`path`의 원소가 문자열일 때도 있고 `{ key }` 객체일 때도 있다. Standard Schema의 path 표현이 둘
다 허용하기 때문이다. `remix/data-schema`는 문자열을 주지만 — 입력칸 하나가 빈 경우 issue가
`{ message: 'Title is required', path: ['title'] }`로 온다 — Zod 같은 다른 구현을 끼우면 객체
형태가 올 수 있다. 그래서 양쪽을 받아 key를 꺼내고, 꺼낸 값이 우리가 아는 입력칸 이름
목록(`fieldNames`)에 있을 때만 쓴다. 모르는 이름이면 버린다 — 화면에 보여줄 자리가 없으니까.

이 프로젝트의 form은 평평한 입력칸 다섯 개뿐이라 `path`의 첫 원소만 본다. 중첩 object나 배열
입력을 받게 되면 `path` 전체를 따라가야 한다.

## 3. check, refinement, transform, coercion

기본 schema는 타입만 본다. `string()`은 문자열인지만 확인하고, 길이나 형식은 보지 않는다.
그 위에 조건을 얹는 방법이 셋이다.

- **`.pipe(check, ...)`** — 미리 만들어 둔 `Check`를 끼운다. `remix/data-schema/checks`가
  `minLength`, `maxLength`, `email`, `url`, `min`, `max`를 제공한다. 같은 제약을 여러 schema에서
  쓸 때 이쪽이 짧다.
- **`.refine(predicate, message)`** — 술어 함수를 직접 쓴다. 값을 바꾸지 않고 통과/거부만
  정한다. 그 도메인에서만 의미 있는 조건에 쓴다.
- **`.transform(fn)`** — 검증을 통과한 값을 다른 값으로 바꾼다. 출력 타입도 같이 바뀐다.
  `"2026-04-25"`를 `Date`로 바꾸는 것이 전형적인 예다.

`.refine`과 `.transform`은 순서를 바꾸면 결과가 달라진다. 둘 다 앞 단계를 통과한 값에만
실행된다. `.refine`을 먼저 두면 **원래 모양으로 검증하고 그 뒤에 바꾼다.** 반대로 놓으면 바뀐
값을 검증한다.

문자열로 들어온 입력을 타입 있는 값으로 바꾸는 일이 잦아서 전용 도구가 따로 있다.
`remix/data-schema/coerce`의 `coerce.number()`, `coerce.boolean()`, `coerce.date()`,
`coerce.bigint()`, `coerce.string()`이다. `coerce.number()`는 `"2"`를 받아 `2`로 만든다.

### vinyl-shelf에서는

`app/data/validation.ts`에 필수 입력칸용 schema와 연도용 schema가 있다.

```ts
function requiredText(label: string) {
  return s
    .defaulted(s.string(), '')
    .transform((value) => value.trim())
    .refine((value) => value.length > 0, `${label} is required`)
}
```

`defaulted(s.string(), '')`가 먼저 오는 이유는 입력칸이 아예 안 올 수 있기 때문이다. 사용자가
HTML을 고쳐 `name="title"` 입력칸을 지우고 제출하면 `formData`에 `title`이 없다. 그때 `""`로
채워 두면 그 뒤 `.refine`이 우리가 쓴 메시지를 낸다. 빈 `FormData`를 두 schema에 넣어 직접
비교해 보면 차이가 이렇다.

```text
defaulted 있음: { message: 'Title is required', path: ['title'] }
defaulted 없음: { message: 'Expected string',   path: ['title'] }
```

`defaulted`가 없으면 값이 `undefined`라서 `s.string()` 단계에서 먼저 걸린다. 그러면 사용자는
입력칸 아래에서 `Expected string`을 읽는다 — 무엇을 해야 하는지 알 수 없는 말이다.

연도는 순서가 반대다. 같은 파일의 `yearField`다.

```ts
const yearField = s
  .defaulted(s.string(), '')
  .refine((value) => {
    let year = Number(value.trim())
    return Number.isInteger(year) && year >= 1900 && year <= 2100
  }, 'Year must be a number between 1900 and 2100')
  .transform((value) => Number(value.trim()))
```

`coerce.number()`를 쓰지 않고 문자열 상태에서 `.refine`으로 검증한 뒤 마지막에 숫자로 바꿨다.
`coerce.number()`를 먼저 쓰면 `"not-a-year"`가 `NaN`이 되어 number schema 단계에서 걸리고,
메시지가 그 단계의 기본 문구가 된다. 지금 모양은 메시지 하나를 우리가 정한 문장으로 고정한다.
화면에서는 잘못된 연도를 넣었을 때 `Year must be a number between 1900 and 2100`이 그 입력칸
아래에 뜬다.

`.transform`이 마지막에 있으니 parse를 통과한 `result.value.year`는 `number`다. 그래서
`createAlbum`에 넘기는 값의 타입이 `CreateAlbumInput`과 맞고, 중간에 `Number()`를 다시 부르는
자리가 없다.

## 4. FormData와 URLSearchParams schema

`FormData`는 일반 object가 아니다. 같은 이름으로 값이 여러 개 올 수 있고(체크박스 여러 개),
값이 문자열일 수도 파일일 수도 있다. 그래서 `s.object({...})`로는 바로 받을 수 없고 전용
helper를 쓴다. `remix/data-schema/form-data`가 그것이다.

- **`f.object({ ... })`** — `FormData`나 `URLSearchParams`를 받는 루트 schema다.
- **`f.field(schema)`** — 이름 하나에 값 하나. 없으면 `undefined`로 온다.
- **`f.fields(schema)`** — 같은 이름으로 온 값을 배열로 모은다.
- **`f.file(schema)` / `f.files(schema)`** — 업로드된 파일. `URLSearchParams`에는 쓸 수 없다.

안쪽은 2·3절에서 본 schema를 그대로 쓴다. `f.field`는 "이 이름에서 값을 꺼낸다"만 하고, 꺼낸
값을 검증하는 일은 안에 넣은 schema가 한다.

`formData()` middleware와 함께 쓰는 것이 기본이다. action마다 `await request.formData()`를 부르면
body를 읽는 일이 호출 자리마다 일어나고, form 값을 보는 다른 middleware와도 엮이지 않는다.
middleware로 한 번 parse해 두면 action은 이미 읽힌 `FormData`를 받는다.

업로드 파일은 asset/file handling 챕터에서 다룬다.

### vinyl-shelf에서는

schema는 입력칸 다섯 개를 `f.field`로 받는다. `app/data/validation.ts`:

```ts
export const albumFormSchema = f.object({
  title: f.field(requiredText('Title')),
  artist: f.field(requiredText('Artist')),
  year: f.field(yearField),
  genre: f.field(requiredText('Genre')),
  notes: f.field(requiredText('Notes')),
})
```

`formData()`는 `app/router.ts`의 middleware 목록에 있고, `methodOverride()`보다 앞이다.

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

`methodOverride()`가 뒤에 있어야 하는 이유는 그것이 form 값을 읽기 때문이다. 삭제 form은
`_method=DELETE`를 숨은 입력칸으로 보내고, `methodOverride()`가 그 값을 보고 요청 method를
바꾼다. `formData()`가 먼저 돌아 body를 읽어 놓지 않으면 볼 값이 없다.

action은 `context.formData`로 읽는다. `validateCreateAlbum(context.formData)` 한 줄이
`app/actions/albums/controller.tsx`와 `app/actions/albums/edit/controller.tsx` 양쪽에 있다.

## 5. table, column, relation 정의하기

`remix/data-table`에서 table은 `table({ name, columns })`로 선언한다. column은 builder로 쓴다 —
`c.integer()`, `c.text()`, `c.boolean()`, `c.decimal(p, s)`, `c.enum([...])`, `c.uuid()`,
`c.varchar(n)`. 여기에 modifier를 붙인다 — `.primaryKey()`, `.autoIncrement()`, `.notNull()`,
`.unique()`, `.references(table, column)`, `.onDelete(action)`, `.default(value)`.

이 선언에서 행 타입을 뽑는다. `TableRow<typeof albums>`가 그 table의 한 행 타입이다.

**이 선언은 database를 바꾸지 않는다.** 이 절에서 가장 헷갈리는 대목이다.
`c.text().notNull()`이라고 적어도 database에 `not null` 제약이 생기지 않는다. 실제 `create table`
문은 migration SQL이 소유한다(10절). 그래서 같은 제약을 두 곳에 적게 되는데, 어느 쪽을 기준으로
삼을지 규칙을 정해 두어야 한다. 둘 중 하나다.

- **양쪽에 같이 적는다** — table 선언이 앱이 아는 스키마 설명서 역할도 한다.
- **table 선언에는 column만 적고 제약은 SQL에만 적는다** — 중복이 없어지는 대신, 코드만 읽으면
  제약을 알 수 없다.

relation은 table 바깥에서 따로 만든다. `hasMany(source, target)`, `hasOne(source, target)`,
`belongsTo(source, target)`, `hasManyThrough(source, target, options)`가 relation 값을 돌려주고,
조회할 때 `.with({ ... })`에 넘긴다.

### vinyl-shelf에서는

table 선언은 `app/data/schema.ts`에 있고, 같은 제약을 migration SQL에도 적는 쪽을 골랐다.

`app/data/schema.ts` — 지금 파일에 있는 선언

```ts
export const albums = table({
  name: 'albums',
  columns: {
    id: c.integer().primaryKey().autoIncrement(),
    slug: c.text().notNull().unique(),
    title: c.text().notNull(),
    artist: c.text().notNull(),
    year: c.integer().notNull(),
    genre: c.text().notNull(),
    notes: c.text().notNull(),
  },
  ...
})
```

`db/migrations/20260824000000_create_albums/up.sql` — 실제 DDL을 소유하는 쪽

```sql
create table albums (
  id integer primary key autoincrement,
  slug text not null unique,
  title text not null,
  artist text not null,
  year integer not null,
  genre text not null,
  notes text not null
);

create index albums_slug_idx on albums (slug);
```

두 블록을 나란히 놓고 비교해 보면 규칙이 보인다. `index`는 SQL에만 있다 — table 선언에 index를
적는 자리가 없기 때문이다. 앱은 index의 존재를 몰라도 되고, 조회 성능만 달라진다.

이 규칙은 `app/data/schema.ts` 맨 위 주석에 적어 두었다.

```ts
/**
 * Runtime table metadata for the app. The column modifiers mirror the SQL in
 * db/migrations, but the migrations own the actual DDL — editing this file
 * never changes the database.
 */
```

relation은 아직 없다. table이 하나뿐이기 때문이다. 앨범에 여러 트랙이 달리거나 사용자별
컬렉션이 생기면 `hasMany`가 필요해진다 — auth 챕터에서 사용자가 들어오면 그때 다룬다.

행 타입은 `app/data/albums.ts`가 `Album`으로 다시 내보낸다.

```ts
export type Album = AlbumRow
```

그래서 UI 컴포넌트와 테스트는 `data-table`을 직접 import하지 않고 `Album`만 쓴다.

## 6. CRUD helper와 query object

조회와 쓰기에 쓰는 API가 두 벌이다.

**CRUD helper** — 흔한 작업을 한 줄로 한다.

- `db.find(table, pk)` / `db.findOne(table, { where, orderBy })` — 행 하나 또는 `null`
- `db.findMany(table, { where, orderBy, limit, offset })` — 행 배열
- `db.count(table, { where })` — 개수
- `db.create(table, value)` — 기본은 쓰기 결과 metadata, `{ returnRow: true }`를 주면 행
- `db.createMany(table, values)` — 여러 행을 한 번에
- `db.update(table, pk, changes)` — 바뀐 행. 대상이 없으면 예외를 던진다
- `db.delete(table, pk)` — `boolean`

`orderBy`는 tuple이다. 하나면 `['id', 'desc']`, 여럿이면 `[['status', 'asc'], ['created_at', 'desc']]`.

**query object** — join, projection, aggregate, relation eager loading, 범위가 정해진 bulk write가
필요할 때 쓴다. 만드는 방법이 둘인데 차이는 database에 묶였는지다.

- `query(table)` — database와 무관한 값을 만든다. 변수에 담아 두고 재사용하거나 조합할 수 있고,
  실행은 `db.exec(query)`로 한다.
- `db.query(table)` — 같은 builder가 이미 그 database에 묶여 나온다. `.all()`, `.first()`로 바로
  실행한다.

그 아래에 raw SQL이 탈출구로 있다. `db.exec(sql\`select ... where id = ${id}\`)`는 값을 문자열로
이어 붙이지 않고 parameter로 넘긴다.

### vinyl-shelf에서는

`app/data/albums.ts`가 CRUD helper만 쓴다. 앨범 하나에 대한 작업이 전부 단일 table 조회라서
query object가 필요한 자리가 아직 없다.

```ts
export function listAlbums(db: Database) {
  // Newest first: form-created albums get higher ids than the seeds.
  return db.findMany(albums, { orderBy: ['id', 'desc'] })
}

export function getAlbum(db: Database, slug: string) {
  return db.findOne(albums, { where: { slug } })
}
```

이 파일의 함수는 전부 첫 인자로 `db`를 받는다. 모듈에서 singleton을 import하지 않는다. 이유는
11절에서 다룬다.

삭제와 수정은 slug로 행을 먼저 찾고 id로 쓴다. 같은 파일의 `updateAlbum`이다.

```ts
export async function updateAlbum(db: Database, slug: string, input: CreateAlbumInput) {
  let album = await getAlbum(db, slug)
  if (!album) return null

  return db.update(albums, album.id, input)
}
```

`db.update`는 대상이 없으면 예외를 던지므로, 없는 slug를 404로 만들려면 여기서 미리
`null`을 돌려줘야 한다. 그 `null`이 controller에서 404 응답이 된다.

query object가 필요해질 함수가 하나 있다. 같은 파일의 `getRecommendations`는 앨범 전체를 읽어 온
뒤 JavaScript에서 걸러낸다.

```ts
let others = (await listAlbums(db)).filter((candidate) => candidate.slug !== album.slug)
let related = others.filter((candidate) => {
  let candidateGenre = candidate.genre.toLowerCase()
  let sharesGenre = genreWords.some((word) => candidateGenre.includes(word))
  let sharesDecade = Math.floor(candidate.year / 10) === decade
  return sharesGenre || sharesDecade
})
```

행이 몇 개뿐인 연습용 앱이라 이대로 두었다. 행이 수만 개가 되면 이 조건은 `where`로 내려가야
하고, 장르 단어 매칭과 연대 계산이 섞여 있으니 CRUD helper의 `where` 객체로는 표현이 안 되어
query object가 필요해진다.

## 7. table validation과 lifecycle hook

table 선언에 hook을 달 수 있다. 쓰기 한 번에 이 순서로 돈다.

1. `beforeWrite` — 값을 다듬거나 거부한다
2. `validate` — 검증한다. `{ value }` 또는 `{ issues }`를 돌려준다
3. timestamp와 default 채우기
4. 실제 SQL 실행
5. `afterWrite` — 끝난 쓰기를 관찰한다

삭제에는 `beforeDelete`(거부 가능)와 `afterDelete`가 있고, 읽기에는 행마다 도는 `afterRead`가
있다. hook 안에서 issue를 낼 때는 `{ issues: [...] }`를 직접 만들지 않고 `fail(message, path)`을
쓰면 된다.

알아 둘 제약이 셋이다.

- **동기로만 돈다.** hook에서 Promise를 돌려주면 검증 에러가 된다. 그래서 hook 안에서 database를
  다시 읽을 수 없다.
- **값이 부분적으로 온다.** `update`는 바뀐 column만 담아 오므로 `value.year`가 없을 수 있다.
  그래서 hook은 값이 있는지 먼저 확인하고 본다.
- **transaction을 만들지 않는다.** hook이 돌았다고 해서 그 쓰기가 자동으로 묶이지 않는다.
  rollback이 필요하면 8절의 `db.transaction()`을 쓴다.

table hook과 1절의 request schema는 막는 대상이 다르다. request schema는 **사용자가 보낸 것**을
검증한다. table hook은 **누가 쓰든** 지켜야 하는 것을 강제한다. migration 스크립트, 관리자 도구,
나중에 추가될 가져오기 기능은 form을 거치지 않는다. 그것들도 같은 규칙을 지키게 하려면 규칙이
table 쪽에 있어야 한다.

### vinyl-shelf에서는

`app/data/schema.ts`에 hook 둘이 있다.

```ts
beforeWrite({ value }) {
  let next = { ...value }
  for (let key of ['slug', 'title', 'artist', 'genre', 'notes'] as const) {
    let field = next[key]
    if (typeof field === 'string') next[key] = field.trim()
  }
  return { value: next }
},
validate({ value }) {
  let issues = []

  if (typeof value.year === 'number' && (!Number.isInteger(value.year) || value.year < 1900 || value.year > 2100)) {
    issues.push({ message: 'year must be an integer between 1900 and 2100', path: ['year'] })
  }
  if (typeof value.slug === 'string' && value.slug === '') {
    issues.push({ message: 'slug must not be empty', path: ['slug'] })
  }

  return issues.length > 0 ? { issues } : { value }
},
```

`typeof value.year === 'number'` 조건이 위에서 말한 "값이 부분적으로 온다"를 받아낸다. 연도를
빼고 나머지만 수정하는 요청에서는 `value.year`가 `undefined`다. 그때는 검증할 대상이 없으니
넘어간다.

form schema에도 같은 1900–2100 범위가 있다. 중복으로 보이지만 막는 것이 다르다. schema는 사용자
입력을 막고, 여기는 form을 거치지 않는 쓰기를 막는다. 테스트가 그 차이를 직접 보여준다.
`app/actions/controller.test.ts`:

```ts
// This write skips the request schema entirely: the table hook is the
// last line of defense.
await assert.rejects(
  db.create(albums, {
    slug: 'bad-year',
    ...
    year: 1200,
    ...
  }),
  (error: unknown) => {
    assert.ok(error instanceof DataTableValidationError)
    assert.equal(error.metadata?.column, 'year')
    ...
  },
)
```

이 테스트에서 배울 것이 하나 더 있다. hook이 낸 메시지는 에러의 `message`에 들어가지 않는다.
`message`는 `Invalid value for column "year" in table "albums"`처럼 `data-table`이 만든 문장이고,
우리가 쓴 문장은 `error.issues` 배열에 남는다. 그래서 이 메시지를 사용자에게 보여주려면
`issues`를 읽어야 한다.

`beforeWrite`의 trim도 테스트로 확인한다. 제목을 `'  In Rainbows  '`로 보내면 저장된 행의
`title`이 `'In Rainbows'`다. 화면에서는 앞뒤 공백을 넣어 앨범을 추가해도 목록에 공백 없이
나온다.

## 8. Transaction

읽기와 쓰기 묶음이 전부 성공하거나 전부 없었던 일이 되어야 할 때 `db.transaction()`을 쓴다.
모양은 이렇다 (API 형태를 보여주는 예시로, 이 프로젝트에 `users`/`orders` table은 없다).

```ts
await db.transaction(async (tx) => {
  let user = await tx.create(users, { ... }, { returnRow: true })
  await tx.create(orders, { user_id: user.id, ... })
})
```

callback이 받는 `tx`는 같은 `Database` 인터페이스다. **callback 안에서는 `tx`로만 작업한다.**
바깥의 `db`를 그대로 쓰면 그 작업은 transaction 밖에서 일어나고, 묶이지 않는다.

callback이 정상 종료하면 commit, 예외가 나면 rollback이다.

필요한 자리를 찾을 때는 쓰기가 두 번 이상인지를 보지 말고, **읽은 값으로 쓰기를 결정하는지**를
본다. 읽고 나서 쓰기까지 사이에 다른 요청이 끼어들면 읽은 값이 이미 옛것이 된다.

### vinyl-shelf에서는

`createAlbum`이 그 경우다. slug를 고르는 방법이 "이미 있는 slug를 읽어 보고 겹치면 번호를
붙인다"이기 때문이다.

`app/data/albums.ts` 고치기 전 — 읽기와 쓰기가 떨어져 있었다

```ts
export async function createAlbum(db: Database, input: CreateAlbumInput) {
  let slug = await uniqueSlug(db, input.title)
  return db.create(albums, { slug, ...input }, { returnRow: true })
}
```

`app/data/albums.ts` 고친 뒤 — 한 transaction으로 묶었다

```ts
export async function createAlbum(db: Database, input: CreateAlbumInput) {
  // The slug is chosen by reading the rows that already exist, so the read and
  // the insert have to commit together. Two creates with the same title would
  // otherwise both pick the same suffix and one would hit the unique index.
  return db.transaction(async (tx) => {
    let slug = await uniqueSlug(tx, input.title)
    return tx.create(albums, { slug, ...input }, { returnRow: true })
  })
}
```

고치기 전에 무엇이 깨지는지 순서로 보면 이렇다.

1. 요청 A가 `Kind of Blue`를 추가한다. `kind-of-blue`가 이미 있으니 `kind-of-blue-2`를 고른다
2. insert가 되기 전에 요청 B가 같은 제목으로 들어온다. B도 `kind-of-blue-2`를 고른다
3. A가 insert해서 `kind-of-blue-2`가 생긴다
4. B가 insert하면 `slug` unique 제약에 걸린다 → 사용자는 500을 본다

화면에서 보이는 증상은 "같은 제목 앨범을 거의 동시에 두 번 추가하면 한쪽이 에러 페이지"다.
혼자 클릭해서는 재현되지 않는다 — 그래서 transaction이 없는 채로도 테스트가 통과했다.

rollback 자체도 테스트로 확인한다. `app/actions/controller.test.ts`:

```ts
await assert.rejects(
  db.transaction(async (tx) => {
    await tx.create(albums, { slug: 'half-written', ... })
    // Rejected by the table validate hook, which does not roll anything
    // back on its own — the transaction does.
    await tx.create(albums, { slug: 'bad-year', ..., year: 1200, ... })
  }),
)

assert.equal(await db.findOne(albums, { where: { slug: 'half-written' } }), null)
```

첫 쓰기는 성공했는데도 행이 남지 않는다. 7절의 "hook은 transaction을 만들지 않는다"가 여기서
뒤집히지 않는다는 것도 같이 보인다 — rollback한 것은 hook이 아니라 `db.transaction`이다.

transaction을 아직 안 쓴 함수가 둘 남아 있다. `updateAlbum`과 `deleteAlbum`은 slug로 행을 읽은 뒤
id로 쓴다. 그 사이에 그 행이 지워지면 `db.update`가 예외를 던진다. 지금은 혼자 쓰는 앱이라 두었고,
여러 사용자가 같은 컬렉션을 고치게 되면 이쪽도 묶어야 한다.

## 9. SQLite, PostgreSQL, MySQL database

database를 만드는 일은 두 단계다. 먼저 engine별 **adapter**를 만들고, 그것을 `createDatabase`에
넘긴다. 예시로 만든 것이다.

```ts
import { createDatabase } from 'remix/data-table'
import { createSqliteDatabaseAdapter } from 'remix/data-table/sqlite'

let adapter = createSqliteDatabaseAdapter(sqliteClient)
export const db = createDatabase(adapter)
```

engine별 import 경로와 함수 이름이 이렇다.

| engine     | import 경로                  | adapter 함수                      |
| ---------- | ---------------------------- | --------------------------------- |
| SQLite     | `remix/data-table/sqlite`    | `createSqliteDatabaseAdapter`     |
| PostgreSQL | `remix/data-table/postgres`  | `createPostgresDatabaseAdapter`   |
| MySQL      | `remix/data-table/mysql`     | `createMysqlDatabaseAdapter`      |

원문 개요는 `createSqliteDatabase()`처럼 한 단계로 끝나는 factory 이름을 적고 있는데, 설치된
`remix@3.0.0-beta.5`에는 그런 함수가 없다. 위 표의 adapter 함수와 `createDatabase` 조합이 실제
API다. 원문이 아직 개요 단계라 이름이 앞서간 것으로 보인다.

engine이 달라서 앱 코드까지 달라지는 경우가 셋이다.

- **SQLite client는 runtime이 고른다.** adapter는 `prepare`/`exec`를 가진 동기 client를 받는다.
  Node의 `node:sqlite`, Bun의 `bun:sqlite`, `better-sqlite3`가 모두 된다.
- **MySQL에는 `RETURNING`이 없다.** `db.createMany(..., { returnRows: true })`가 MySQL에서는
  동작하지 않는다. `db.create(..., { returnRow: true })`로 한 행씩 받거나, 넣은 뒤 다시 읽어야
  한다.
- **MySQL은 multi-statement를 기본으로 막는다.** migration 하나에 SQL 문이 여럿 들어가므로,
  connection pool에 `multipleStatements: true`를 줘야 migration이 돈다.

### vinyl-shelf에서는

Node 내장 SQLite를 쓴다. 의존성을 더 받지 않아도 되기 때문이다. `app/data/database.ts`:

```ts
const sqlite = new DatabaseSync(isTest ? ':memory:' : databaseFile)
sqlite.exec('pragma foreign_keys = on')

const adapter = createSqliteDatabaseAdapter(sqlite)

export const db = createDatabase(adapter)
```

`node:sqlite`를 쓰므로 Node 버전이 낮으면 테스트가 실행조차 되지 않는다. `pnpm test`가
import 단계에서 죽으면 먼저 `node --version`을 본다.

테스트는 파일 대신 메모리 database를 쓴다.

```ts
// Tests get a throwaway in-memory database; dev and production share a file.
const isTest = process.env.NODE_ENV === 'test'
```

`foreign_keys` pragma는 SQLite가 foreign key 제약을 기본으로 꺼 두기 때문에 켜 준다. 지금은
table이 하나라 효과가 없지만, relation이 생기는 시점에 이 한 줄이 없으면 참조가 깨진 행이
조용히 들어간다.

## 10. SQL이 먼저인 migration

migration은 SQL 파일이다. 디렉터리 하나가 migration 하나이고, 이름이 `YYYYMMDDHHmmss_<slug>`
형식이다. 안에 `up.sql`이 필수로, `down.sql`이 선택으로 들어간다. 되돌릴 수 없는 변경이면
`down.sql`을 빼면 된다. 파일 하나에 SQL 문 여러 개를 둘 수 있다.

**migration 파일에서 앱 코드를 import하지 않는다.** `app/data/schema.ts`를 읽어 DDL을 만드는
방식이 편해 보이지만, 그러면 migration이 언제 실행되느냐에 따라 다른 일을 한다. 6개월 전에 만든
migration을 새 체크아웃에서 처음 돌리면, 그 사이에 바뀐 schema가 적용된다. SQL 파일은 import를
할 수 없으니 이 문제가 아예 생기지 않는다.

runner를 만들어 실행한다. 예시로 만든 것이다.

```ts
let migrations = await loadMigrations('./db/migrations')
let runner = createMigrationRunner(adapter, migrations)
await runner.up()
```

runner가 해 주는 일이 넷이다.

- **journaling** — 적용한 migration을 database의 journal table에 기록해서 두 번 돌지 않게 한다.
  table 이름은 `{ journalTable: 'app_migrations' }`로 바꿀 수 있다.
- **checksum drift 감지** — 이미 적용한 `up.sql`의 내용이 바뀌면 알려준다. 적용된 migration을
  수정하는 것은 "내 database와 남의 database가 다른 상태"를 만드는 일이라서, 고치는 대신 새
  migration을 추가해야 한다.
- **범위 지정** — `runner.up({ to: '20260301113000' })`으로 목표까지, `runner.up({ step: 1 })`로
  개수만큼. `to`와 `step`은 같이 쓸 수 없다.
- **dry-run** — `runner.up({ dryRun: true })`는 실행도 기록도 하지 않고 SQL 계획만 돌려준다.

각 migration은 기본으로 transaction에 감싸여 실행된다(adapter가 DDL transaction을 지원할 때).
`up.sql`의 첫 줄에 지시를 적어 바꾼다.

```sql
-- data-table/transaction: none
```

`auto`가 기본이고, `required`는 감쌀 수 없으면 실패, `none`은 감싸지 않는다. PostgreSQL의
`create index concurrently`처럼 transaction 안에서 돌 수 없는 문장에 `none`을 쓴다.

### vinyl-shelf에서는

migration이 하나뿐이다.

```text
vinyl-shelf/db/migrations/20260824000000_create_albums/
├── up.sql
└── down.sql
```

`up.sql`은 5절에서 봤다. `down.sql`은 만든 것을 역순으로 되돌린다.

`db/migrations/20260824000000_create_albums/down.sql`

```sql
drop index if exists albums_slug_idx;
drop table if exists albums;
```

`if exists`를 붙인 이유는 rollback이 실패한 migration에서도 불릴 수 있기 때문이다. index를 만들기
전에 실패했으면 index가 없는데, 그때 `drop index`가 또 에러를 내면 되돌리는 일 자체가 막힌다.

별도 migrate 스크립트는 두지 않았다. `app/data/database.ts`가 import될 때 돈다.

```ts
// Migrations and seed data run before the router accepts any request: this
// module initializes at import time, and every request path imports it.
const migrations = await loadMigrations(migrationsDir)
const runner = createMigrationRunner(adapter, migrations)
await runner.up()
await seedAlbumsIfEmpty(db)
```

연습용 앱이라 이렇게 두었다. 서버가 여러 프로세스로 뜨는 배포에서는 이 방식이 맞지 않는다 —
프로세스들이 동시에 같은 migration을 돌린다. 그때는 migration을 배포 단계의 별도 명령으로 떼어
낸다. production 실행과 배포는 뒤 챕터에서 다룬다.

`seedAlbumsIfEmpty`는 migration이 아니다. migration은 구조를 만들고, seed는 보고 만질 데이터를
넣는다. 그래서 `count`가 0일 때만 돌고, 이미 앨범이 있으면 아무것도 하지 않는다.

## 11. 요청 단위 database 접근

database를 action에서 쓰는 방법이 둘이다. 모듈에서 singleton을 import하거나, context에서 꺼내
쓰거나.

context 쪽을 쓴다. **database를 바꿔 끼울 수 있기 때문이다.** action이
`import { db } from ...`을 하면 그 action은 그 database에 묶인다. context에서 받으면 middleware가
넣어 주는 것만 바꿔서 테스트용 database, 요청마다 다른 connection, 읽기 전용 복제본을 쓸 수
있다. action은 그대로 둔다.

형태는 이렇다. middleware가 context key에 database를 넣고, action이 꺼내 쓴다. 예시로 만든
것이다 — 이 프로젝트의 실제 코드는 아래 **vinyl-shelf에서는**에 있다.

```ts
export const DatabaseContext = createContextKey<Database>()

export function loadDatabase(): Middleware {
  return async (context, next) => {
    context.set(DatabaseContext, db)
    return next()
  }
}
```

action에서는 `context.get(DatabaseContext)`로 읽는다. 앱 context 타입은 middleware stack에서
끌어내므로, middleware를 빼면 그것을 읽는 action에서 타입 에러가 난다.

요청을 받기 전에 초기화가 끝나 있어야 한다. 첫 요청이 들어온 뒤에 migration을 돌리기 시작하면
그 요청은 table이 없는 database를 보게 된다.

### vinyl-shelf에서는

`context.get(...)` 대신 `context.db`로 짧게 읽는다. `context.set`의 세 번째 인자가 그것을
만들어 준다. `app/middleware/database.ts`:

```ts
export const DatabaseContext = createContextKey<Database>()

const databaseProperty = { property: 'db' } as const

export function loadDatabase(): Middleware<{
  key: typeof DatabaseContext
  value: Database
  property: 'db'
}> {
  return async (context, next) => {
    context.set(DatabaseContext, db, databaseProperty)
    return next()
  }
}
```

`{ property: 'db' }`를 주면 context에 `db`라는 property가 생긴다. 반환 타입에 같은 정보를 적어
두었으니 타입도 따라온다. 그래서 action이 이렇게 쓴다.

`app/actions/albums/controller.tsx`

```tsx
async index(context) {
  return context.render(<AlbumsPage albums={await listAlbums(context.db)} />)
}
```

`context.db`의 타입이 `Database`인 것은 `app/router.ts`가 router에서 context 타입을 끌어내기
때문이다.

```ts
type AppContext = RouterContext<typeof router>

declare module 'remix/router' {
  interface RouterTypes {
    context: AppContext
  }
}
```

`loadDatabase()`를 middleware 목록에서 지우면 `context.db`를 쓰는 모든 action에서 타입 에러가
난다. 직접 지워서 `pnpm run typecheck`를 돌려 보면 이 연결이 말뿐이 아니라는 것이 보인다.
확인했으면 되돌리자.

초기화 순서는 import로 보장된다. `app/middleware/database.ts`가 `app/data/database.ts`를
import하고, 그 모듈이 top-level `await`로 migration과 seed를 끝낸다. router가 만들어지는 시점에
이미 끝나 있다.

데이터 접근 함수가 `db`를 인자로 받는 이유도 여기에 있다. `app/data/albums.ts`의 함수는 전부
`listAlbums(db)`처럼 받으므로 어느 database든 넣을 수 있다. 테스트가 그것을 쓴다 —
`resetAlbumsForTest(db)`가 메모리 database를 받아 매 테스트 앞에서 행을 비우고 seed를 다시
넣는다.

## 정독 후 확인 질문

1. 같은 1900–2100 범위 검증이 form schema와 table `validate` hook 양쪽에 있다. 둘 중 하나만
   남긴다면 각각 무엇을 막지 못하게 되는가?
2. `yearField`에서 `.refine`이 `.transform`보다 먼저 오는 이유를 사용자가 보는 메시지로 설명할 수
   있는가? 순서를 바꾸면 무엇이 달라지는가?
3. `app/data/schema.ts`의 `c.text().notNull()`을 지워도 database는 그 column을 계속 `not null`로
   유지한다. 왜 그런가?
4. `createAlbum`에 transaction이 필요한 이유를, 요청 두 개가 끼어드는 순서로 설명할 수 있는가?
   `listAlbums`에는 왜 필요 없는가?
5. action이 `context.db`로 database를 받는 것과 `app/data/database.ts`에서 직접 import하는 것은
   무엇이 달라지는가?

## 스터디 과제

**앨범에 별점(`rating`) 항목을 추가한다.** 값은 1부터 5까지의 정수이고, **입력하지 않아도
된다.**

1. migration을 새로 추가해서 `rating` column을 만든다. 기존 migration을 고치지 않는다.
2. `app/data/schema.ts`의 table 선언에 column을 추가한다.
3. 앨범 추가 form과 수정 form에 입력칸을 넣고, `app/data/validation.ts`의 schema로 검증한다.
   값을 비워 보낸 경우와 `7`처럼 범위를 벗어난 값을 보낸 경우가 달라야 한다.
4. form을 거치지 않는 쓰기도 막는다. 범위를 벗어난 `rating`으로 `db.create`를 직접 부르면
   실패해야 한다.
5. `app/actions/controller.test.ts`에 테스트를 추가한다. 비워 둔 제출이 성공하는 것, 범위를
   벗어난 제출이 400이 되는 것, `db.create` 직접 호출이 거부되는 것 세 가지다.

기존 앨범 3개는 별점이 없는 상태로 남아도 된다. 목록과 상세 페이지가 별점 없는 앨범에서도
깨지지 않아야 한다.
