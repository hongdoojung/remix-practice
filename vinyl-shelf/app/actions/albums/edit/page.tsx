import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import button from 'remix/ui/button'
import input from 'remix/ui/input'

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
      <Document
        title={`Edit ${album.title} | Vinyl Shelf`}
        description={`Edit the shelf entry for ${album.title}.`}
      >
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
              <TextArea name="notes" label="Notes" value={formValues.notes} error={errors.notes} />
              <button type="submit" class="shelf-cta" mix={button({ tone: 'primary', size: 'lg' })}>
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
    let errorId = `${handle.id}-error`

    return (
      <div mix={fieldStyle}>
        <label htmlFor={handle.id}>{label}</label>
        <input
          id={handle.id}
          name={name}
          defaultValue={value}
          aria-describedby={error ? errorId : undefined}
          aria-invalid={error ? 'true' : undefined}
          mix={input({ size: 'lg' })}
        />
        {error ? (
          <small id={errorId} mix={errorStyle}>
            {error}
          </small>
        ) : null}
      </div>
    )
  }
}

function TextArea(
  handle: Handle<{
    name: keyof AlbumFormValues
    label: string
    value: string
    error?: string
  }>,
) {
  return () => {
    let { name, label, value, error } = handle.props
    let errorId = `${handle.id}-error`

    return (
      <div mix={fieldStyle}>
        <label htmlFor={handle.id}>{label}</label>
        <textarea
          id={handle.id}
          name={name}
          rows={5}
          defaultValue={value}
          aria-describedby={error ? errorId : undefined}
          aria-invalid={error ? 'true' : undefined}
        />
        {error ? (
          <small id={errorId} mix={errorStyle}>
            {error}
          </small>
        ) : null}
      </div>
    )
  }
}

const pageStyle = css({
  background: 'var(--shelf-bg)',
  color: 'var(--shelf-ink)',
  fontFamily: 'var(--shelf-font)',
  minHeight: '100vh',
  padding: 'calc(var(--shelf-page) * 2) var(--shelf-page)',
})

const crumbStyle = css({
  display: 'flex',
  gap: '8px',
  margin: '0 auto 18px',
  maxWidth: '720px',
  '& a': { color: 'var(--shelf-link)', fontWeight: 800, textDecoration: 'none' },
})

const panelStyle = css({
  background: 'var(--shelf-surface)',
  border: '1px solid var(--shelf-line)',
  borderRadius: 'var(--shelf-radius)',
  display: 'grid',
  gap: '16px',
  margin: '0 auto',
  maxWidth: '720px',
  padding: '24px',
})

const eyebrowStyle = css({
  color: 'var(--shelf-accent)',
  fontSize: '0.78rem',
  fontWeight: 800,
  letterSpacing: '0.04em',
  margin: 0,
  textTransform: 'uppercase',
})

const leadStyle = css({ color: 'var(--shelf-muted)', lineHeight: 1.7, margin: 0 })

const formStyle = css({
  display: 'grid',
  gap: '14px',
})

const fieldStyle = css({
  display: 'grid',
  gap: '6px',
  '& label': { fontWeight: 800 },
  '& textarea': {
    border: '1px solid var(--shelf-field-line)',
    borderRadius: 'var(--shelf-radius-sm)',
    font: 'inherit',
    padding: '10px 12px',
  },
})

const errorStyle = css({ color: 'var(--shelf-danger)', fontWeight: 700 })
