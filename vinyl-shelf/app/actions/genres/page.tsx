import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'

import type { Album } from '../../data/albums.ts'
import { routes } from '../../routes.ts'
import { Document } from '../../ui/document.tsx'

export function GenresPage(handle: Handle<{ genres: string[] }>) {
  return () => (
    <Document title="Genres | Vinyl Shelf">
      <main mix={pageStyle}>
        <section mix={panelStyle}>
          <p mix={eyebrowStyle}>Route composition</p>
          <h1>Genres</h1>
          <ul mix={listStyle}>
            {handle.props.genres.map((genre) => (
              <li key={genre}>
                <a href={routes.genres.show.href({ genre })}>{genre}</a>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </Document>
  )
}

export function GenreDetailPage(handle: Handle<{ genre: string; albums: Album[] }>) {
  return () => {
    let { genre, albums } = handle.props

    return (
      <Document title={`${genre} | Vinyl Shelf`}>
        <main mix={pageStyle}>
          <section mix={panelStyle}>
            <p mix={eyebrowStyle}>Route params</p>
            <h1>{genre}</h1>
            <ul mix={listStyle}>
              {albums.map((album) => (
                <li key={album.slug}>
                  <a href={routes.albums.show.href({ slug: album.slug })}>{album.title}</a> —{' '}
                  {album.artist} ({album.year})
                </li>
              ))}
            </ul>
            <a href={routes.genres.index.href()}>Back to genres</a>
          </section>
        </main>
      </Document>
    )
  }
}

export function GenreNotFoundPage(handle: Handle<{ genre: string }>) {
  return () => (
    <Document title="Genre not found | Vinyl Shelf">
      <main mix={pageStyle}>
        <section mix={panelStyle}>
          <p mix={eyebrowStyle}>404 response</p>
          <h1>Genre not found</h1>
          <p>No album uses the genre "{handle.props.genre}".</p>
          <a href={routes.genres.index.href()}>Back to genres</a>
        </section>
      </main>
    </Document>
  )
}

const pageStyle = css({
  background: '#f4f1eb',
  color: '#1f2933',
  fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
  minHeight: '100vh',
  padding: '32px 24px',
})

const panelStyle = css({
  background: '#ffffff',
  border: '1px solid #d8d0c3',
  borderRadius: '8px',
  display: 'grid',
  gap: '16px',
  margin: '0 auto',
  maxWidth: '720px',
  padding: '24px',
  '& a': { color: '#295b70', fontWeight: 800, textDecoration: 'none' },
})

const eyebrowStyle = css({
  color: '#1f6f54',
  fontSize: '0.78rem',
  fontWeight: 800,
  letterSpacing: '0.04em',
  margin: 0,
  textTransform: 'uppercase',
})

const listStyle = css({
  display: 'grid',
  gap: '10px',
  listStyle: 'none',
  margin: 0,
  padding: 0,
})
