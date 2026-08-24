# Remix 3 Practice

Remix 3 beta를 `vinyl-shelf`라는 작은 토이 프로젝트로 학습하는 저장소다. 목표는 공식 가이드의
각 챕터를 한국어 문서로 읽고, 같은 개념을 실제 코드로 확인하면서 커밋 단위로 따라갈 수 있게
만드는 것이다.

## 프로젝트 구성

```text
.
├── docs/          # 커리큘럼 문서
└── vinyl-shelf/   # Remix 3 beta 실습 앱
```

## Vinyl Shelf

`vinyl-shelf`는 작은 음반 컬렉션 앱이다. 사용자는 앨범을 둘러보고, 상세 페이지를 열고, 새 앨범을
추가하고, 나중에는 로그인한 사용자만 컬렉션을 관리하도록 확장한다.

커리큘럼이 진행되면서 다음 기능을 단계적으로 구현한다.

- 앨범 목록, 상세 페이지, 생성/수정/삭제 form
- route contract와 controller 분리
- request handling, redirects, 404/400 response, cancellation
- server-rendered UI와 필요한 부분만 hydrate하는 interactivity
- form validation과 persistent data layer
- auth, session, security boundary
- 앨범 커버 이미지와 asset/file handling
- route/controller/component 테스트
- production 실행, 환경변수, 배포 준비

## 학습 방식

커리큘럼은 번호가 붙은 문서 폴더와 커밋으로 관리한다.

```text
docs/
├── 00-remix-3-beta-preview/
└── 01-start-here-guide/
```

각 가이드 챕터 폴더에는 보통 두 문서가 있다.

- `original-translation.ko.md`: 원문 전체 번역 및 정리
- `practice-guide.ko.md`: 현재 프로젝트에 적용해서 실습하는 문서

0번 커리큘럼처럼 이론 중심인 경우에는 코드 변경 없이 `overview.ko.md`만 둘 수 있다.

추천 학습 방식은 각 챕터 폴더의 `practice-guide.ko.md`를 보고 직접 따라가는 것이다. 필요할 때
`original-translation.ko.md`를 열어 원문 흐름을 확인하고, 이론 중심 챕터는 `overview.ko.md`를 먼저
읽는다. 문서가 계속 추가되므로 고정된 읽는 순서는 README에 두지 않고, `docs/`의 번호가 붙은 폴더를
순서대로 보면 된다.

문서화와 커밋 규칙은 [docs/README.md](./docs/README.md)에 정리되어 있다.

## 앱 실행

```sh
cd vinyl-shelf
corepack pnpm install
corepack pnpm run dev
```

검증:

```sh
cd vinyl-shelf
corepack pnpm test
corepack pnpm run typecheck
```

## 커밋으로 학습하기

커리큘럼 커밋은 다음 제목 규칙을 따른다.

```text
curriculum 00: Remix 3 beta preview
curriculum 01: Start Here
curriculum 02: Routing and Controllers
curriculum 03: Request Handling
curriculum 04: Rendering UI
curriculum 05: Interactivity
curriculum 06: Streaming UI with Frames
```

특정 챕터 상태로 이동해서 보고 싶다면 해당 커밋을 checkout하면 된다.

```sh
git log --oneline
git checkout <commit>
```

다시 최신 상태로 돌아오려면:

```sh
git checkout main
```
