import { createMixin, on } from 'remix/ui'

export const longPressType = 'shelf:longpress' as const

export class LongPressEvent extends Event {
  constructor() {
    super(longPressType, { bubbles: true })
  }
}

declare global {
  interface HTMLElementEventMap {
    [longPressType]: LongPressEvent
  }
}

/**
 * Most handlers should use `on(...)` with a native event. A custom event mixin
 * earns its place when several components need the same interaction assembled
 * from multiple low-level events. This one keeps the pointer/timer state in its
 * own setup scope and dispatches a single semantic event.
 */
export const longPress = createMixin<HTMLElement>((handle) => {
  let node: HTMLElement | undefined
  let timeout: number | undefined

  handle.addEventListener('insert', (event) => {
    node = event.node
  })
  handle.addEventListener('remove', cancel)

  function cancel() {
    window.clearTimeout(timeout)
  }

  return () => (
    <handle.element
      mix={[
        on('pointerdown', () => {
          cancel()
          timeout = window.setTimeout(() => {
            node?.dispatchEvent(new LongPressEvent())
          }, 600)
        }),
        on('pointerup', cancel),
        on('pointercancel', cancel),
        on('pointerleave', cancel),
      ]}
    />
  )
})
