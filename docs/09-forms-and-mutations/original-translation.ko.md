# Forms and Mutations 원문 한국어 번역

원문: [Forms and Mutations | Remix Docs](https://guides.remix.run/forms-and-mutations/)
라이선스: Remix Docs 페이지 하단의 “docs and examples licensed under MIT” 표기를 기준으로 번역 및 정리했다.

프로젝트 적용 실습은 [`practice-guide.ko.md`](./practice-guide.ko.md)에서 다룬다.

이 챕터의 원문 페이지도 챕터 8과 마찬가지로 2026-09-13 기준 개요만 있다. 절 제목 10개와 각 절이
다룰 내용을 한 단락씩 적어 두었고, 코드 예제는 없다. 아래 번역은 그 개요 전체다.

## 개요

mutation(데이터를 바꾸는 요청)을 먼저 HTML form과 controller action으로 만든다. JavaScript 없는
요청이 올바른 응답을 돌려주게 된 뒤에, 같은 form에 pending 상태나 fetch 제출, 또는 지정한 frame만
다시 불러오는 동작을 얹을 수 있다.

## HTML이 먼저인 form 작업 흐름 {#html-first-form-workflows}

진짜 `<form method="POST">`, `name`이 붙은 기본 control, submit 버튼을 쓴다. action URL은
`routes.<name>.href(...)`에서 오고, controller는 예상되는 모든 결과마다 명시적인 `Response`를
돌려준다.

## form route와 controller 소유 {#form-routes}

`form(path)`는 기본으로 `index` GET leaf와 `action` POST leaf를 만든다. 두 직접 leaf를 그 form
route map에 연결된 controller 안에 두고, URL 계약에 이득이 있을 때만 action 이름이나 method를
직접 지정한다.

## FormData를 한 번 parse하고, 그다음 검증한다 {#parse-and-validate-form-data}

form 필드에 의존하는 middleware보다 앞에 `formData()`를 설치하고, `context.get(FormData)`로 읽고,
`remix/data-schema/form-data` schema로 parse한다. 없는 필드, 반복된 필드, 체크박스, 파일,
coercion을 action 안의 임시 확인이 아니라 boundary에서 처리할 일로 다룬다.

## 검증 실패를 form과 함께 돌려준다 {#validation-failures}

`parseSafe()`를 쓰고, issue path와 제출된 값, `400` 상태를 함께 담아 form을 다시 렌더링한다.
입력한 값과 에러의 소유를 필드 가까이에 두되, password나 파일 값을 다시 채워 보내는 것은 피한다.

## mutation이 성공하면 redirect한다 {#post-redirect-get}

create, update, delete가 끝나면 결과 페이지로 `303` redirect를 돌려준다. 이렇게 하면 새로고침으로
실수로 다시 제출되는 일이 없고, 다음 GET이 안정된 URL을 갖는다. session flash 데이터로 요청 한
번만 사는 성공 메시지를 실어 보낼 수 있다.

## 여러 submit intent와 mutation 응답 {#mutation-intents-and-responses}

form 하나가 서로 관련된 동작을 몇 가지 가질 때는 `name`이 붙은 submit 버튼을 쓴다. 호출하는 쪽에
맞는 응답을 고른다 — 그 자리에서 실패를 보여줄 때는 렌더링된 HTML, 보통의 브라우저 성공에는
redirect, 정말로 데이터로 소비되는 endpoint에는 JSON.

## HTML form에서 PUT, PATCH, DELETE 쓰기 {#method-override-for-put-patch-and-delete}

HTML form은 GET이나 POST로만 제출한다. route 계약이 PUT, PATCH, DELETE를 쓴다면 숨은 `_method`
필드를 넣고 `formData()` 뒤에 `methodOverride()`를 돌린다. bookstore 예제의 RESTful form wrapper가
그렇게 한다.

## action을 바꾸지 않고 제출을 개선한다 {#enhanced-form-submissions}

hydrate된 컴포넌트가 submit을 가로채서 `new FormData(form)`을 event의 abort signal과 함께 보내고,
그다음 이동하거나 frame을 다시 불러올 수 있다. JavaScript가 로드되지 않거나 이 개선을 없애도 서버
action은 여전히 올바르게 동작해야 한다.

## pending, optimistic, 그리고 충돌하는 mutation {#optimistic-ui}

시도한 작업을 setup scope에 들고 있으면서 중복 control을 비활성화하고 pending이나 optimistic 상태를
렌더링한다. 돌아온 응답과 맞춰 보고, 실패는 되돌리며, 동시 쓰기가 충돌할 수 있으면 앱이 소유하는
revision이나 precondition을 쓴다.

## JSON을 돌려줄 때 {#resource-routes-and-json-endpoints}

autocomplete, polling, 독립된 widget, API, 서비스 간 호출에는 JSON을 쓴다. 쓸모 있는 HTML 응답과
redirect 경로가 이미 있는 form에 JSON mutation 계층을 따로 만들지 않는다.
