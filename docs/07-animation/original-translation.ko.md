# Animation 원문 한국어 번역

원문: [Animation | Remix Docs](https://guides.remix.run/animation/)
라이선스: Remix Docs 페이지 하단의 “docs and examples licensed under MIT” 표기를 기준으로 번역 및 정리했다.

프로젝트 적용 실습은 [`practice-guide.ko.md`](./practice-guide.ko.md)에서 다룬다.

원문 곳곳에는 예제를 실행해 볼 수 있는 embedded frame(`::frame{src="/examples/07-animation/..."}`)이
있다. 파일을 복제하지 않고 위치만 남긴다.

## CSS-first visual state {#css-first-visual-states}

Browser가 이미 그 state를 소유하고 있다면 CSS에서 시작하라. Hover, focus, active, checked, open,
selected, reduced-motion state는 render 출력이 그 state에 의존하지 않는 한 JavaScript state가
필요 없다.

`app/ui/pressable-card.tsx`

```tsx
import { css } from "remix/ui";
import type { Handle, RemixNode } from "remix/ui";

export function PressableCard(handle: Handle<{ children: RemixNode }>) {
  return () => (
    <button mix={cardStyle} type="button">
      {handle.props.children}
    </button>
  );
}

const cardStyle = css({
  border: "1px solid #d6d6d6",
  borderRadius: "16px",
  background: "white",
  cursor: "pointer",
  font: "inherit",
  padding: "1rem",
  transition: "transform 160ms ease, box-shadow 160ms ease",
  "&:hover, &:focus-visible": {
    boxShadow: "0 12px 32px rgba(15, 17, 21, 0.14)",
    transform: "translateY(-2px)",
  },
  "&:active": {
    transform: "translateY(0)",
  },
  "@media (prefers-reduced-motion: reduce)": {
    transition: "none",
  },
});
```

Motion이 rendering state에 의존할 때 Remix animation helper를 써라. Node가 들어올 때, node가
나갈 때, keyed item이 이동할 때, event에 중단 가능한 animation이 필요할 때다.

> 원문 위치: press-state 예제 frame

## Entrance와 exit animation {#entrance-and-exit-animations}

`animateEntrance(...)`는 host node가 삽입될 때 실행된다. `animateExit(...)`는 제거된 node를 exit
animation이 끝날 때까지 DOM에 남겨 둔다.

`app/ui/public/notice.tsx`

```tsx
import { clientEntry, css, on } from "remix/ui";
import { animateEntrance, animateExit, spring } from "remix/ui/animation";
import type { Handle } from "remix/ui";

export const Notice = clientEntry(import.meta.url, function Notice(handle: Handle) {
  let visible = true;

  return () => (
    <div>
      <button
        mix={[
          on("click", () => {
            visible = !visible;
            handle.update();
          }),
        ]}
        type="button"
      >
        Toggle notice
      </button>
      {visible && (
        <p
          key="notice"
          mix={[
            noticeStyle,
            animateEntrance({
              opacity: 0,
              transform: "translateY(8px)",
              ...spring("snappy"),
            }),
            animateExit({
              opacity: 0,
              transform: "translateY(-8px)",
              ...spring("snappy"),
            }),
          ]}
        >
          Settings saved.
        </p>
      )}
    </div>
  );
});

const noticeStyle = css({
  borderRadius: "12px",
  background: "#ecfdf5",
  color: "#065f46",
  padding: "0.75rem 1rem",
});
```

연관된 element 사이를 toggle할 때는 key를 안정적으로 유지하라. 안정적인 key가 어느 node가
들어오고, 나가고, 교체되는지 Remix에게 알려준다.

기본 opacity animation을 쓰려면 `true`를, 주변 `mix` 배열을 바꾸지 않고 mixin을 끄려면 `false`를
넘겨라. `animateEntrance({ initial: false })`는 그 key의 첫 삽입은 건너뛰지만 이후 삽입은
animate한다. 같은 keyed element가 exit이 끝나기 전에 돌아오면, Remix는 그 DOM node를 되찾아 render된
style을 향해 다시 animate한다.

> 원문 위치: notice-presence 예제 frame

## Layout animation {#layout-animations}

`animateLayout(...)`은 render 전후에 host node를 측정해서 시각적 차이를 animate한다. 정렬되는
목록, 펼쳐지는 card, layout 변화 때문에 움직이는 element에 맞는 도구다.

`app/ui/public/reorder-list.tsx`

```tsx
import { clientEntry, css, on } from "remix/ui";
import { animateLayout, spring } from "remix/ui/animation";
import type { Handle } from "remix/ui";

const initialItems = ["Design", "Build", "Review"];

export const ReorderList = clientEntry(import.meta.url, function ReorderList(handle: Handle) {
  let items = initialItems;

  return () => (
    <div>
      <button
        mix={[
          on("click", () => {
            items = [...items].reverse();
            handle.update();
          }),
        ]}
        type="button"
      >
        Reverse
      </button>
      <ul mix={listStyle}>
        {items.map((item) => (
          <li key={item} mix={[itemStyle, animateLayout({ ...spring("bouncy") })]}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
});

const listStyle = css({
  display: "grid",
  gap: "0.5rem",
  listStyle: "none",
  padding: 0,
});

const itemStyle = css({
  border: "1px solid #d6d6d6",
  borderRadius: "10px",
  padding: "0.7rem 1rem",
});
```

목록의 layout animation에서 `key`는 선택이 아니다. 안정적인 key가 없으면 runtime은 item이
이동했는지, 다른 item이 자리를 대신했는지 알 수 없다.

Layout animation은 기본적으로 size projection을 포함한다. 위치만 animate해야 하고 element 내용을
scale하면 이상해 보일 때는 `size: false`를 넘겨라.

> 원문 위치: reordering 예제 frame

## Spring, tween, easing {#springs-tweens-and-easing}

`spring()`은 CSS transition과 Web Animations를 위해 장식된 iterator를 반환한다. CSS에서
문자열로 만들거나, animation option에 spread하거나, custom JavaScript animation을 위해 순회하라.

`app/ui/public/bouncy-switch.tsx`

```tsx
import { clientEntry, css, on } from "remix/ui";
import { spring } from "remix/ui/animation";
import type { Handle } from "remix/ui";

export const BouncySwitch = clientEntry(import.meta.url, function BouncySwitch(handle: Handle) {
  let enabled = true;

  return () => (
    <button
      aria-pressed={enabled}
      mix={[
        switchStyle,
        on("click", () => {
          enabled = !enabled;
          handle.update();
        }),
      ]}
      type="button"
    >
      <span
        mix={thumbStyle}
        style={{
          transform: enabled ? "translateX(2.25rem)" : "translateX(0)",
        }}
      />
    </button>
  );
});

const switchStyle = css({
  border: 0,
  borderRadius: "999px",
  background: "#ff6b35",
  cursor: "pointer",
  padding: "0.25rem",
  width: "5rem",
});

const thumbStyle = css({
  display: "block",
  width: "2rem",
  height: "2rem",
  borderRadius: "50%",
  background: "white",
  transition: spring.transition("transform", "bouncy"),
});
```

CSS나 WAAPI timing이 아니라 시간 기반 값 loop가 필요할 때 `tween(...)`을 써라.

`app/ui/public/count-up.ts`

```ts
import { easings, tween } from "remix/ui/animation";

export function countUp(from: number, to: number, onValue: (value: number) => void) {
  let animation = tween({ from, to, duration: 300, curve: easings.easeOut });
  animation.next();

  function tick(timestamp: number) {
    let result = animation.next(timestamp);
    onValue(result.value);

    if (!result.done) {
      requestAnimationFrame(tick);
    }
  }

  requestAnimationFrame(tick);
}
```

평범한 UI에는 CSS transition과 animation mixin을 우선하라. `tween`은 canvas, custom counter, CSS
property가 아닌 값에 쓰는 것이다.

> 원문 위치: spring-drag-release, bouncy-switch 예제 frame

UI package는 더 작은 motion 실험들의 gallery도 유지한다. 이런 폭넓은 demo는 주변 guide page를
잠식하지 않도록 경계가 있는 frame 안에 두라.

> 원문 위치: animation-gallery 예제 frame

## 중단 가능한 상호작용 {#interruptible-interactions}

Event handler는 abort signal을 받고, animation mixin은 DOM이 다시 바뀌면 진행 중인 작업을
취소하거나 교체한다. 그래서 중단은 edge case가 아니라 기본 경로다.

Custom imperative animation에서는 현재 animation을 setup scope에 두고, 다음 것을 시작하기 전에
취소하라.

`app/ui/public/ripple-button.tsx`

```tsx
import { clientEntry, css, on, ref } from "remix/ui";
import { spring } from "remix/ui/animation";
import type { Handle } from "remix/ui";

export const RippleButton = clientEntry(import.meta.url, function RippleButton(_handle: Handle) {
  let node: HTMLButtonElement;
  let currentAnimation: Animation | undefined;

  return () => (
    <button
      mix={[
        ref((element) => (node = element)),
        buttonStyle,
        on("pointerdown", () => {
          currentAnimation?.cancel();
          currentAnimation = node.animate(
            [{ transform: "scale(0.96)" }, { transform: "scale(1)" }],
            { ...spring("snappy") },
          );
        }),
      ]}
      type="button"
    >
      Press me
    </button>
  );
});

const buttonStyle = css({
  border: 0,
  borderRadius: "999px",
  background: "#9911ff",
  color: "white",
  cursor: "pointer",
  font: "inherit",
  fontWeight: "700",
  padding: "0.8rem 1.1rem",
});
```

CSS transition도 중단 가능하다. Transition이 진행되는 동안 목표 값을 바꾸면 browser는 현재 시각적
state에서 새 목표를 향해 animate한다.

## Reduced-motion 동작 {#reduced-motion-behavior}

`prefers-reduced-motion`은 먼저 CSS 경계에서 존중하라. JavaScript가 로드되기 전에 동작하고,
server-rendered frame에 적용되고, 정적 transition을 포함한다.

`app/ui/motion-safe-panel.tsx`

```tsx
import { css } from "remix/ui";
import type { Handle, RemixNode } from "remix/ui";

export function MotionSafePanel(handle: Handle<{ children: RemixNode }>) {
  return () => <section mix={panelStyle}>{handle.props.children}</section>;
}

const panelStyle = css({
  opacity: 1,
  transform: "translateY(0)",
  transition: "opacity 180ms ease, transform 180ms ease",
  "@media (prefers-reduced-motion: reduce)": {
    transition: "none",
    transform: "none",
  },
});
```

JavaScript가 주도하는 motion에서는 작업을 시작하기 전에 같은 media query를 확인하라.

`app/ui/public/motion.ts`

```ts
export function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
```

Reduced motion이 feedback 없음을 뜻할 필요는 없다. 움직임이 필수가 아니라면 더 짧은 fade, 즉각적인
layout 변화, motion이 아닌 state 변화를 우선하라.
