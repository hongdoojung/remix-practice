import { easings, tween } from 'remix/ui/animation'

export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * A time-based value loop for numbers that are not CSS properties. Returns a
 * cancel function so the caller can interrupt an in-flight count before
 * starting the next one.
 */
export function countUp(from: number, to: number, onValue: (value: number) => void) {
  let animation = tween({ from, to, duration: 300, curve: easings.easeOut })
  animation.next()

  let frame: number

  function tick(timestamp: number) {
    let result = animation.next(timestamp)
    onValue(result.value)

    if (!result.done) {
      frame = requestAnimationFrame(tick)
    }
  }

  frame = requestAnimationFrame(tick)

  return () => cancelAnimationFrame(frame)
}
