import { clientEntry, css, on, type Handle, type SerializableProps } from 'remix/ui'
import button from 'remix/ui/button'

interface RecommendationsRefresherProps extends SerializableProps {
  /** The name of the frame this button reloads, owned by the page markup. */
  frameName: string
}

/**
 * The mutation-free half of the chapter's coordination pattern: the frame
 * keeps rendering on the server, and this island only asks it to reload.
 */
export const RecommendationsRefresher = clientEntry(
  import.meta.url,
  function RecommendationsRefresher(handle: Handle<RecommendationsRefresherProps>) {
    let pending = false
    let reloads = 0

    return () => (
      <span mix={rowStyle}>
        <button
          type="button"
          disabled={pending}
          mix={[
            button({ tone: 'ghost' }),
            on('click', async (_event, signal) => {
              let frame = handle.frames.get(handle.props.frameName)
              if (!frame) return

              pending = true
              handle.update()

              await frame.reload()
              if (signal.aborted) return

              pending = false
              reloads++
              handle.update()
            }),
          ]}
        >
          {pending ? 'Refreshing…' : 'Refresh recommendations'}
        </button>
        {reloads > 0 ? <small mix={countStyle}>reloaded ×{reloads}</small> : null}
      </span>
    )
  },
)

const rowStyle = css({ alignItems: 'center', display: 'inline-flex', gap: '10px' })
const countStyle = css({ color: 'var(--shelf-muted)', fontWeight: 700 })
