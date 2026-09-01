import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'

import type { Album } from '../../../data/albums.ts'
import type { AlbumFieldErrors, AlbumFormValues } from '../../../data/validation.ts'
import { routes } from '../../../routes.ts'
import { Document } from '../../../ui/document.tsx'

export function AlbumEditPage(
  handle: Handle<{
    album: Album
    errors?: AlbumFieldErrors
    values?: AlbumFormValues
  }>,
) {
  return () => {
    let { album, errors = {}, values } = handle.props
    let formValues: AlbumFormValues = values ?? {
      title: album.title,
      artist: album.artist,
      year: String(album.year),
      genre: album.genre,
      notes: album.notes,
    }

    return (
      <Document title={`Edit ${album.title} | Vinyl Shelf`}>
        <main mix={pageStyle}>
          <nav mix={crumbStyle}>
            <a href={routes.albums.index.href()}>Albums</a>
            <span>/</span>
            <a href={routes.albums.show.href({ slug: album.slug })}>{album.title}</a>
          </nav>

          <section mix={panelStyle}>
            <p mix={eyebrowStyle}>Routing and Controllers</p>
            <h1>Edit album</h1>
            <p mix={leadStyle}>
              This page is rendered by a route-owned controller mapped to the nested edit route.
              The GET and POST URLs come from the same form route builder.
            </p>

            <form method="post" action={routes.albums.edit.action.href({ slug: album.slug })} mix={formStyle}>
              <TextField name="title" label="Title" value={formValues.title} error={errors.title} />
              <TextField name="artist" label="Artist" value={formValues.artist} error={errors.artist} />
              <TextField name="year" label="Year" value={formValues.year} error={errors.year} />
              <TextField name="genre" label="Genre" value={formValues.genre} error={errors.genre} />
              <label mix={fieldStyle}>
                <span>Notes</span>
                <textarea name="notes" rows={5} defaultValue={formValues.notes} />
                {errors.notes ? <small mix={errorStyle}>{errors.notes}</small> : null}
              </label>
              <button type="submit" mix={buttonStyle}>
                Save changes
              </button>
            </form>
          </section>
        </main>
      </Document>
    )
  }
}

function TextField(
  handle: Handle<{
    name: keyof AlbumFormValues
    label: string
    value: string
    error?: string
  }>,
) {
  return () => {
    let { name, label, value, error } = handle.props

    return (
      <label mix={fieldStyle}>
        <span>{label}</span>
        <input name={name} defaultValue={value} />
        {error ? <small mix={errorStyle}>{error}</small> : null}
      </label>
    )
  }
}

const pageStyle = css({
  background: '#f4f1eb',
  color: '#1f2933',
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  minHeight: '100vh',
  padding: '32px 24px',
})

const crumbStyle = css({
  display: 'flex',
  gap: '8px',
  margin: '0 auto 18px',
  maxWidth: '720px',
  '& a': { color: '#295b70', fontWeight: 800, textDecoration: 'none' },
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
})

const eyebrowStyle = css({
  color: '#1f6f54',
  fontSize: '0.78rem',
  fontWeight: 800,
  letterSpacing: '0.04em',
  margin: 0,
  textTransform: 'uppercase',
})

const leadStyle = css({ color: '#52616f', lineHeight: 1.7, margin: 0 })

const formStyle = css({
  display: 'grid',
  gap: '14px',
})

const fieldStyle = css({
  display: 'grid',
  gap: '6px',
  '& span': { fontWeight: 800 },
  '& input, & textarea': {
    border: '1px solid #b9c2ca',
    borderRadius: '6px',
    font: 'inherit',
    padding: '10px 12px',
  },
})

const buttonStyle = css({
  background: '#172126',
  border: 0,
  borderRadius: '8px',
  color: '#ffffff',
  cursor: 'pointer',
  font: 'inherit',
  fontWeight: 800,
  padding: '11px 14px',
})

const errorStyle = css({ color: '#a11d28', fontWeight: 700 })
