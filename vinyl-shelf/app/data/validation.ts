import type { CreateAlbumInput } from './albums.ts'

export type AlbumFieldErrors = Partial<Record<'title' | 'artist' | 'year' | 'genre' | 'notes', string>>

export type AlbumFormValues = Record<'title' | 'artist' | 'year' | 'genre' | 'notes', string>

export type CreateAlbumResult =
  | { ok: true; value: CreateAlbumInput }
  | { ok: false; errors: AlbumFieldErrors; values: AlbumFormValues }

export function validateCreateAlbum(formData: FormData): CreateAlbumResult {
  let values: AlbumFormValues = {
    title: readField(formData, 'title'),
    artist: readField(formData, 'artist'),
    year: readField(formData, 'year'),
    genre: readField(formData, 'genre'),
    notes: readField(formData, 'notes'),
  }

  let errors: AlbumFieldErrors = {}
  let year = Number(values.year)

  if (!values.title) errors.title = 'Title is required'
  if (!values.artist) errors.artist = 'Artist is required'
  if (!values.genre) errors.genre = 'Genre is required'
  if (!values.notes) errors.notes = 'Notes are required'
  if (!Number.isInteger(year) || year < 1900 || year > 2100) {
    errors.year = 'Year must be a number between 1900 and 2100'
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors, values }

  return {
    ok: true,
    value: {
      title: values.title,
      artist: values.artist,
      year,
      genre: values.genre,
      notes: values.notes,
    },
  }
}

function readField(formData: FormData, key: string) {
  let value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}
