import {
  addEventListeners,
  clientEntry,
  css,
  on,
  type Handle,
  type SerializableProps,
} from 'remix/ui'
import button from 'remix/ui/button'

import { longPress, longPressType } from './long-press.tsx'
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

    // `handle.signal` aborts when this component disconnects, so the
    // subscription cannot outlive the component.
    addEventListeners(queue, handle.signal, {
      change() {
        handle.update()
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
              {queue.playCount} plays
            </button>
          </header>

          {statusOpen ? (
            <p mix={noteStyle}>
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
                {entries.map((entry) => (
                  <li key={entry.slug}>
                    <span>
                      {entry.title} × {entry.plays}
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove ${entry.title}`}
                      mix={[button({ tone: 'ghost' }), on('click', () => queue.remove(entry.slug))]}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ol>
              <button
                type="button"
                mix={[
                  button({ tone: 'ghost' }),
                  longPress(),
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

const emptyStyle = css({ color: 'var(--shelf-muted)', margin: 0 })
