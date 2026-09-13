# Data and Validation 원문 한국어 번역

원문: [Data and Validation | Remix Docs](https://guides.remix.run/data-and-validation/)
라이선스: Remix Docs 페이지 하단의 “docs and examples licensed under MIT” 표기를 기준으로 번역 및 정리했다.

프로젝트 적용 실습은 [`practice-guide.ko.md`](./practice-guide.ko.md)에서 다룬다.

이 챕터의 원문 페이지는 2026-09-13 기준으로 절 제목과 각 절이 다룰 내용을 한 단락으로 적은
개요만 있다. 코드 예제도, 실행 예제 frame도 아직 없다. 앞 챕터들의 원문과 달리 옮길 본문이
절마다 한 단락뿐이며, 아래 번역은 그 개요 전체다.

## 개요

신뢰할 수 없는 요청에서 나온 값 하나가 검증된 action payload가 되고, 다시 타입이 붙은
database write가 되기까지를 따라간다. request validation과 table validation은 서로 다른 문제를
풀며, 읽는 사람의 머릿속에서도 따로 남아 있어야 한다.

## 모든 trust boundary를 검증한다 {#validating-trust-boundaries}

route param, query string, form, JSON body, cookie, 외부 서비스 payload를 business logic이
쓰기 전에 parse한다. 잘못된 입력이 `400` 응답이 되어야 하는 action에서는 `parseSafe()`를
선호한다. parse 에러를 throw하는 방식은 정말로 계속 진행할 수 없는 boundary에만 남겨 둔다.

## Schema, parsing, issue {#remix-data-schema}

`remix/data-schema`를 object, primitive, optional/defaulted 값, union과 variant, 그리고
`parse()`와 `parseSafe()`의 차이로 소개한다. issue path, error map, 타입 추론, 그리고 다른
Standard Schema v1 schema와의 호환성을 다루되 전체 API README를 그대로 옮기지는 않는다.

## check, refinement, transform, coercion {#coercion-and-checks}

재사용 가능한 check에는 `.pipe(...)`를, 도메인 술어에는 `.refine(...)`을, 검증된 출력의 모양이
달라질 때는 `.transform(...)`을 쓴다. 문자열로 들어온 입력을 number, boolean, date, bigint로
바꿔야 할 때는 `remix/data-schema/coerce`를 쓴다.

## FormData와 URLSearchParams schema {#form-parsing-with-remix-data-schema-form-data}

브라우저 form과 query string 값에는 `f.object`, `f.field`, `f.fields`를 쓰고, 업로드에는
`f.file`과 `f.files`를 쓴다. form schema는 `formData()` middleware와 함께 쓴다. 그러면 parsing이
한 번만 일어나고, action은 context에서 타입이 붙은 boundary 값을 읽는다.

## table, column, relation 정의하기 {#tables-with-remix-data-table}

`table()`과 column builder로 타입이 붙은 table을 정의하고, `belongsTo`, `hasOne`, `hasMany`,
through relation을 모델링한다. runtime table metadata는 database constraint를 만들지 않는다는
점을 분명히 한다 — DDL은 SQL migration이 소유한다.

## CRUD helper와 query object {#queries-and-crud-helpers}

흔한 작업에는 `find`, `findOne`, `findMany`, `create`, `update`, `delete`를 쓴다. join,
projection, aggregate, relation eager loading, 범위가 정해진 bulk write, 재사용 가능한 query
object가 필요해지면 독립형 `query(...)`와 `db.exec(...)`, 또는 database에 묶인 `db.query(...)`로
옮겨 간다. parameter가 붙는 raw SQL은 탈출구로 남겨 둔다.

## table validation과 lifecycle hook {#table-validation-and-lifecycle-hooks}

`beforeWrite`, table 단위 `validate`, `afterWrite`, `beforeDelete`, `afterDelete`, `afterRead`를
다루고, 이들이 동기로 동작한다는 점과 행 값이 부분적으로만 올 수 있다는 점도 함께 다룬다.
request schema는 외부 입력을 검증하고, table hook은 모든 호출자에 대해 persistence invariant를
강제한다.

## Transaction {#transactions}

읽기와 쓰기 묶음이 전부 commit되거나 전부 rollback되어야 할 때 `db.transaction()`을 쓴다.
lifecycle hook은 transaction을 암묵적으로 만들지 않으며, database 구현에 따라 transaction 전용
option이 있을 수 있다.

## SQLite, PostgreSQL, MySQL database {#sqlite-postgres-and-mysql-adapters}

`createSqliteDatabase()`, `createPostgresDatabase()`, `createMysqlDatabase()` factory를 실제로
보여주고, 이어서 runtime마다 다른 SQLite client, PostgreSQL의 transaction option, MySQL의
`RETURNING` 및 multi-statement 제약을 짚는다 — 그 차이가 앱 코드에 영향을 주는 지점에서만.

## SQL이 먼저인 migration {#migrations}

timestamp가 붙은 migration 디렉터리를 쓰고, `up.sql`은 필수, `down.sql`은 선택이다. 파일시스템
로딩, journaling과 checksum drift, `up`/`down`, 개수를 정한 실행이나 목표 ID, dry-run plan,
migration별 transaction mode를 다룬다.

## 요청 단위 database 접근 {#request-scoped-database-access}

요청을 받기 전에 database를 초기화하고 migration을 돌린 뒤, 앱이 정의한 `databaseContext` key로
노출하고 앱 context 타입을 그 middleware stack에서 끌어낸다. action은 요청 단위 database를
`context.get(databaseContext)`로 읽거나, 앱이 설치한 타입이 붙은 context property로 읽는다.
