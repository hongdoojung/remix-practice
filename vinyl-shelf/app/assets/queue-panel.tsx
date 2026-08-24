import {
  addEventListeners,
  clientEntry,
  css,
  on,
  ref,
  type Handle,
  type SerializableProps,
} from 'remix/ui'
import { animateEntrance, animateExit, animateLayout, spring } from 'remix/ui/animation'
import button from 'remix/ui/button'

import { longPress, longPressType } from './long-press.tsx'
import { countUp, prefersReducedMotion } from './motion.ts'
import { ShelfQueue } from './shelf-queue.ts'

// A type alias, not an interface: client entry props must satisfy the
// serializable index signature, and interfaces have no implicit index type.
type QueueAlbum = {
  slug: string
  title: string
}

interface QueuePanelProps extends SerializableProps {
  albums: QueueAlbum[]
}

export const QueuePanel = clientEntry(
  import.meta.url,
  function QueuePanel(handle: Handle<QueuePanelProps>) {
    // The model owns the data. The component owns only UI state.
    let queue = new ShelfQueue()
    let statusOpen = false

    // The rendered play count trails the model so it can count up. tween is
    // for numbers like this one that are not CSS properties.
    let shownPlays = 0
    let cancelCount: (() => void) | undefined
    let clearButton: HTMLButtonElement | undefined
    let pressAnimation: Animation | undefined

    // `handle.signal` aborts when this component disconnects, so the
    // subscription cannot outlive the component.
    addEventListeners(queue, handle.signal, {
      change() {
        let target = queue.playCount
        cancelCount?.()

        if (target === shownPlays || prefersReducedMotion()) {
          shownPlays = target
          handle.update()
          return
        }

        cancelCount = countUp(shownPlays, target, (value) => {
          shownPlays = Math.round(value)
          handle.update()
        })
      },
    })

    return () => {
      let entries = queue.entries

      return (
        <section mix={panelStyle}>
          <header mix={headerStyle}>
            <h2 mix={headingStyle}>Listening queue</h2>
            <button
              type="button"
              aria-expanded={statusOpen}
              mix={[
                button({ tone: 'ghost' }),
                on('click', () => {
                  statusOpen = !statusOpen
                  handle.update()
                }),
              ]}
            >
              {shownPlays} plays
            </button>
          </header>

          {statusOpen ? (
            // The stable key tells the runtime this exact node is entering and
            // exiting, so animateExit can hold it in the DOM until it fades.
            <p
              key="status-note"
              mix={[
                noteStyle,
                animateEntrance({ opacity: 0, transform: 'translateY(6px)', ...spring('snappy') }),
                animateExit({ opacity: 0, transform: 'translateY(-6px)', ...spring('snappy') }),
              ]}
            >
              This panel is the only hydrated part of the page. The queue itself is plain
              TypeScript in <code>shelf-queue.ts</code>.
            </p>
          ) : null}

          <ul mix={listStyle}>
            {handle.props.albums.map((album) => (
              <li key={album.slug}>
                <span>{album.title}</span>
                <button
                  type="button"
                  mix={[button(), on('click', () => queue.add(album))]}
                >
                  Queue
                </button>
              </li>
            ))}
          </ul>

          {entries.length === 0 ? (
            <p mix={emptyStyle}>Nothing queued yet.</p>
          ) : (
            <>
              <ol mix={queuedStyle}>
                {entries.map((entry, index) => (
                  // The slug key is what lets animateLayout tell "this entry
                  // moved" apart from "a different entry replaced it".
                  <li
                    key={entry.slug}
                    mix={[
                      animateEntrance({ opacity: 0, transform: 'translateX(-8px)', ...spring('snappy') }),
                      animateExit({ opacity: 0, transform: 'translateX(8px)', ...spring('snappy') }),
                      animateLayout({ ...spring('bouncy') }),
                    ]}
                  >
                    <span>
                      {entry.title} × {entry.plays}
                    </span>
                    <span mix={entryActionsStyle}>
                      {index > 0 ? (
                        <button
                          type="button"
                          aria-label={`Play ${entry.title} next`}
                          mix={[button({ tone: 'ghost' }), on('click', () => queue.promote(entry.slug))]}
                        >
                          ↑
                        </button>
                      ) : null}
                      <button
                        type="button"
                        aria-label={`Remove ${entry.title}`}
                        mix={[button({ tone: 'ghost' }), on('click', () => queue.remove(entry.slug))]}
                      >
                        ✕
                      </button>
                    </span>
                  </li>
                ))}
              </ol>
              <button
                type="button"
                mix={[
                  button({ tone: 'ghost' }),
                  ref((element) => (clearButton = element)),
                  longPress(),
                  // Interruptible imperative animation: cancel the in-flight
                  // press before starting the next one.
                  on('pointerdown', () => {
                    if (prefersReducedMotion()) return
                    pressAnimation?.cancel()
                    pressAnimation = clearButton?.animate(
                      [{ transform: 'scale(0.94)' }, { transform: 'scale(1)' }],
                      { ...spring('snappy') },
                    )
                  }),
                  on(longPressType, () => queue.clear()),
                ]}
              >
                Hold to clear
              </button>
            </>
          )}
        </section>
      )
    }
  },
)

const panelStyle = css({
  background: 'var(--shelf-surface)',
  border: '1px solid var(--shelf-line)',
  borderRadius: 'var(--shelf-radius)',
  display: 'grid',
  gap: '12px',
  padding: '20px',
})

const headerStyle = css({
  alignItems: 'center',
  display: 'flex',
  gap: '12px',
  justifyContent: 'space-between',
})

const headingStyle = css({ fontSize: '1.25rem', margin: 0 })

const noteStyle = css({
  color: 'var(--shelf-muted)',
  lineHeight: 1.6,
  margin: 0,
  '& code': { fontSize: '0.9em' },
})

const listStyle = css({
  display: 'grid',
  gap: '8px',
  listStyle: 'none',
  margin: 0,
  padding: 0,
  '& li': {
    alignItems: 'center',
    display: 'flex',
    gap: '10px',
    justifyContent: 'space-between',
  },
})

const queuedStyle = css({
  borderTop: '1px solid var(--shelf-line)',
  display: 'grid',
  gap: '8px',
  listStyle: 'none',
  margin: 0,
  padding: '12px 0 0',
  '& li': {
    alignItems: 'center',
    display: 'flex',
    gap: '10px',
    justifyContent: 'space-between',
  },
})

const entryActionsStyle = css({ display: 'inline-flex', gap: '4px' })

const emptyStyle = css({ color: 'var(--shelf-muted)', margin: 0 })
