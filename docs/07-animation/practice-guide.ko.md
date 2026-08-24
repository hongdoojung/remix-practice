# Animation

원문: [Animation | Remix Docs](https://guides.remix.run/animation/) ·
전문 번역: [`original-translation.ko.md`](./original-translation.ko.md)

이 문서 하나로 챕터의 개념을 익히고, `vinyl-shelf` 프로젝트 코드로 실습한다. 각 절은 먼저
개념을 설명하고, **vinyl-shelf에서는** 단락에서 이 프로젝트의 실제 코드와 연결한다.

이 문서의 코드와 파일 경로는 `curriculum 07: Animation` 커밋 시점 기준이다. 이 챕터는 새
화면을 만들지 않고, 이미 있는 UI에 motion 도구를 하나씩 얹는다.

## 1. CSS가 이미 소유한 state는 CSS로

브라우저가 이미 그 state를 소유하고 있다면 CSS에서 시작한다. hover, focus, active, checked,
open — render 출력이 그 state에 의존하지 않는 한 JavaScript state가 필요 없다. `css(...)`에
transition과 `&:hover` 같은 selector를 쓰면 끝이고, hydrate되지 않는 서버 전용 component에서도
동작한다.

Remix animation helper가 필요한 것은 **motion이 rendering state에 의존할 때**다 — node가
들어올 때, 나갈 때, keyed 항목이 이동할 때, 이벤트에 중단 가능한 animation이 필요할 때.

### vinyl-shelf에서는

album card의 hover lift가 CSS-first의 실물이다. `app/ui/vinyl-shelf.tsx`의 `cardStyle`:

```ts
transition: 'transform 160ms ease, box-shadow 160ms ease',
'&:hover, &:focus-within': { transform: 'translateY(-2px)', /* ... */ },
'@media (prefers-reduced-motion: reduce)': { transition: 'none', transform: 'none' },
```

component state도, hydration도 없다. 이 판단 기준 — "이 state의 주인이 누구인가" — 이
챕터 전체를 관통한다.

## 2. Entrance와 exit: key가 계약이다

`animateEntrance(...)`는 host node가 삽입될 때 실행되고, `animateExit(...)`는 제거된 node를
exit animation이 끝날 때까지 DOM에 남겨 둔다. 둘 다 `mix`에 넣는 mixin이다.

여기서 `key`는 장식이 아니라 계약이다. 안정된 key가 있어야 runtime이 어느 node가 들어오고
나가고 교체되는지 알고, exit 중에 같은 key가 돌아오면 그 DOM node를 **되찾아** 현재 style을
향해 다시 animate한다 — 중단이 예외가 아니라 기본 경로다.

옵션 요약: 기본 opacity animation만 쓰려면 `true`, mix 배열을 유지한 채 끄려면 `false`,
첫 삽입은 건너뛰려면 `animateEntrance({ initial: false })`.

### vinyl-shelf에서는

queue 안내문(`statusOpen ? <p> : null`)이 조건부 render의 사례다. `key="status-note"`를
고정하고 쌍을 붙였다.

```tsx
<p
  key="status-note"
  mix={[
    noteStyle,
    animateEntrance({ opacity: 0, transform: 'translateY(6px)', ...spring('snappy') }),
    animateExit({ opacity: 0, transform: 'translateY(-6px)', ...spring('snappy') }),
  ]}
>
```

queue 항목 `<li>`에도 같은 쌍이 있고, key는 이미 `entry.slug`였다 — 5장에서 목록에 안정된
key를 쓴 것이 여기서 그대로 값을 한다.

## 3. Layout animation: 이동을 보여주려면 이동이 있어야 한다

`animateLayout(...)`은 render 전후에 host node를 측정해 그 **차이**를 animate한다. 정렬되는
목록, 펼쳐지는 card, layout 변화로 밀려나는 element에 맞는 도구다.

목록에서 이 mixin을 쓸 때 key는 선택이 아니다 — key가 없으면 runtime은 "항목이 이동했다"와
"다른 항목이 자리를 차지했다"를 구분할 수 없다. 그리고 기본으로 크기 변화까지 animate하므로,
위치만 움직여야 하면 `size: false`를 준다.

### vinyl-shelf에서는

기존 queue에는 항목이 움직일 이유가 없어서, model에 이동 규칙을 하나 추가했다 — 5장의
경계를 그대로 지키면서다. 순서 규칙은 `ShelfQueue`가, 움직임은 mixin이 맡는다.

```ts
// app/assets/shelf-queue.ts
promote(slug: string): void {
  let entry = this.#entries.find((item) => item.slug === slug)
  if (!entry || this.#entries[0] === entry) return

  this.#entries = [entry, ...this.#entries.filter((item) => item.slug !== slug)]
  this.dispatchEvent(new Event('change'))
}
```

"↑ Play next" 버튼이 이걸 호출하면 항목들이 자리를 바꾸고, 각 `<li>`의
`animateLayout({ ...spring('bouncy') })`가 이동을 animate한다.

## 4. Spring, tween, easing

`spring()`의 반환값은 세 가지 방법으로 쓴다.

1. **CSS 문자열로** — `spring.transition('transform', 'bouncy')`는
   `"680ms linear(0, 0.0141, ...)"` 같은 순수 CSS transition 값을 반환한다. JavaScript
   runtime 없이 spring 곡선을 얻는다.
2. **Web Animations 옵션에 spread** — `element.animate(keyframes, { ...spring('snappy') })`.
3. **직접 순회** — custom animation loop에서 iterator로.

`tween(...)`은 CSS로 표현할 수 없는 **값**의 animation용이다 — canvas, 숫자 counter처럼
CSS property가 아닌 것. 평범한 UI에는 CSS transition과 animation mixin을 우선한다.

### vinyl-shelf에서는

홈 `AlbumPreview`의 디스크 회전은 easing 문자열만 spring으로 바꿨다.

```ts
// app/assets/album-preview.tsx discStyle
transition: spring.transition('transform', 'bouncy'),
```

테스트가 서버 render 결과에서 `linear(`를 그대로 확인한다 — spring이 JavaScript를 필요로
하지 않는다는 요점이 assertion이 된 셈이다.

tween은 "N plays" 카운트에 썼다. 숫자 텍스트는 CSS로 animate할 수 없으므로
`app/assets/motion.ts`의 `countUp`이 `tween + requestAnimationFrame`으로 굴린다. 원문
예제에 하나를 더했다 — **cancel 함수를 반환**한다. `QueuePanel`이 change 이벤트마다 이전
count-up을 취소하고 새로 시작하므로, 연타해도 counter가 겹쳐 뛰지 않는다.

## 5. 중단 가능한 상호작용

이벤트 핸들러는 abort signal을 받고(5장), animation mixin은 DOM이 다시 바뀌면 진행 중인
작업을 알아서 교체한다. CSS transition도 목표 값이 바뀌면 현재 시각 state에서 새 목표로
이어 간다. 즉 **중단은 edge case가 아니라 기본 경로**다.

직접 만드는 imperative animation만 이 성질을 스스로 챙겨야 한다 — 현재 `Animation`을 setup
scope에 들고 있다가, 다음 것을 시작하기 전에 `cancel()`한다.

### vinyl-shelf에서는

"Hold to clear" 버튼의 press feedback이 그 패턴이다.

```tsx
on('pointerdown', () => {
  if (prefersReducedMotion()) return
  pressAnimation?.cancel()
  pressAnimation = clearButton?.animate(
    [{ transform: 'scale(0.94)' }, { transform: 'scale(1)' }],
    { ...spring('snappy') },
  )
})
```

`clearButton`은 `ref(...)` mixin이 채우고, `spring('snappy')`를 WAAPI 옵션에 spread하는 것이
4절의 두 번째 사용법이다.

## 6. Reduced motion은 두 경계에서

`prefers-reduced-motion`(OS의 "동작 줄이기" 설정을 알려주는 media query)은 두 곳에서
존중한다.

- **CSS 경계** — transition을 쓰는 모든 style에 `@media (prefers-reduced-motion: reduce)`를
  둔다. JavaScript가 로드되기 전에도, 서버 전용 component에도 적용된다.
- **JavaScript 경계** — imperative animation을 시작하기 전에 같은 media query를 확인한다.

reduced motion은 "feedback 없음"이 아니다 — 움직임 대신 더 짧은 fade나 즉각적인 state
변화를 준다.

### vinyl-shelf에서는

CSS 쪽은 transition이 있는 모든 style에 media query를 추가했고, JavaScript 쪽은
`app/assets/motion.ts`의 `prefersReducedMotion()`을 count-up과 press animation 시작 전에
확인한다. 카운트는 animation 없이 즉시 목표 값으로 바뀐다.

## 정독 후 확인 질문

1. card hover lift를 `animateLayout`으로 만들지 않은 이유는 무엇인가?
2. queue 항목의 key를 배열 index로 바꾸면 어떤 animation이 망가지는가? 왜?
3. `spring.transition(...)`의 반환값이 문자열이라는 사실이 서버 렌더링에서 왜 중요한가?
4. `countUp`이 cancel 함수를 반환하지 않으면 어떤 버그가 생기는가?
5. `pressAnimation?.cancel()`을 지우면 연타할 때 무엇이 달라지는가?
6. reduced motion을 CSS와 JavaScript 양쪽에서 확인해야 하는 이유는 무엇인가?

## 스터디 과제

**검색 결과 목록에 motion을 붙인다.** 5장의 `AlbumSearch`가 대상이다.

1. 결과 `<li>`에 `animateEntrance`/`animateExit`를 붙인다. key는 안정된 값(slug)이어야 한다.
2. 검색어가 바뀌어 결과 순서가 달라질 때 항목이 이동하도록 `animateLayout`도 붙인다.
3. reduced motion을 존중한다 — 어느 경계(CSS/JavaScript)에서 처리할지는 직접 정하고, 이유를
   설명할 수 있어야 한다.
4. 빠르게 연속 타이핑하면서 확인한다: 이전 요청이 취소되고(5장), animation이 중간에
   끊겨도 목록이 깨지지 않아야 한다. 어느 쪽도 코드를 더 쓰지 않고 되는 이유를 메모해 온다.

다 만들었으면 OS의 "동작 줄이기"를 켜고 같은 흐름을 반복해 보자.
