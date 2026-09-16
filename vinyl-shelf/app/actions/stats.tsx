import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'

/**
 * The region the home page streams into. Like the recommendations region it
 * renders without the Document shell because the page already owns it.
 */
export function ShelfStats(
  handle: Handle<{ albumCount: number; genreCount: number; latestYear: number | null }>,
) {
  return () => {
    let { albumCount, genreCount, latestYear } = handle.props

    return (
      <dl aria-label="Shelf stats" mix={statsStyle}>
        <div>
          <dt>Albums</dt>
          <dd>{albumCount}</dd>
        </div>
        <div>
          <dt>Genres</dt>
          <dd>{genreCount}</dd>
        </div>
        <div>
          <dt>Latest year</dt>
          <dd>{latestYear ?? '—'}</dd>
        </div>
      </dl>
    )
  }
}

const statsStyle = css({
  background: 'var(--shelf-surface)',
  border: '1px solid var(--shelf-line)',
  borderRadius: 'var(--shelf-radius)',
  display: 'grid',
  gap: '12px',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  margin: 0,
  padding: '18px',
  '& dt': { color: 'var(--shelf-muted)', fontSize: '0.85rem', fontWeight: 800 },
  '& dd': { fontSize: '1.5rem', fontWeight: 800, margin: 0 },
})
