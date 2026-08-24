import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'

import type { Album } from '../../data/albums.ts'
import { routes } from '../../routes.ts'

/**
 * The region a frame streams into. It renders without the Document shell
 * because the surrounding page already owns <html>, <head>, and the nav.
 */
export function AlbumRecommendations(handle: Handle<{ album: Album; recommendations: Album[] }>) {
  return () => {
    let { album, recommendations } = handle.props

    return (
      <section aria-label="Recommendations" mix={regionStyle}>
        <p mix={eyebrowStyle}>Because you opened {album.title}</p>
        {recommendations.length === 0 ? (
          <p mix={emptyStyle}>The shelf has no other albums to recommend yet.</p>
        ) : (
          <ul mix={listStyle}>
            {recommendations.map((pick) => (
              <li key={pick.slug}>
                {/*
                 * Before the runtime starts this is a plain link to the album.
                 * Afterwards `rmx-src`/`rmx-target` load the picked album's own
                 * recommendations into this same frame instead.
                 */}
                <a
                  href={routes.albums.show.href({ slug: pick.slug })}
                  rmx-src={routes.albums.recommendations.href({ slug: pick.slug })}
                  rmx-target="album-recommendations"
                  rmx-reset-scroll="false"
                >
                  {pick.title}
                </a>
                <span>
                  {pick.artist} · {pick.genre} · {pick.year}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    )
  }
}

const regionStyle = css({
  background: 'var(--shelf-surface)',
  border: '1px solid var(--shelf-line)',
  borderRadius: 'var(--shelf-radius)',
  display: 'grid',
  gap: '12px',
  padding: '18px',
})

const eyebrowStyle = css({
  color: 'var(--shelf-accent)',
  fontSize: '0.78rem',
  fontWeight: 800,
  letterSpacing: '0.04em',
  margin: 0,
  textTransform: 'uppercase',
})

const emptyStyle = css({ color: 'var(--shelf-muted)', margin: 0 })

const listStyle = css({
  display: 'grid',
  gap: '10px',
  listStyle: 'none',
  margin: 0,
  padding: 0,
  '& li': { display: 'grid', gap: '2px' },
  '& a': { color: 'var(--shelf-link)', fontWeight: 800, textDecoration: 'none' },
  '& span': { color: 'var(--shelf-muted)' },
})
