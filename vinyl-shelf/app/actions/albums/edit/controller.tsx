import { createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'

import { getAlbum, updateAlbum } from '../../../data/albums.ts'
import { validateEditAlbum } from '../../../data/validation.ts'
import { routes } from '../../../routes.ts'
import { NotFoundPage } from '../../../ui/vinyl-shelf.tsx'
import { AlbumEditPage } from './page.tsx'

export default createController(routes.albums.edit, {
  actions: {
    async index(context) {
      let album = await getAlbum(context.db, context.params.slug)
      if (!album) {
        return context.render(<NotFoundPage slug={context.params.slug} />, { status: 404 })
      }

      return context.render(<AlbumEditPage album={album} />)
    },
    async action(context) {
      let result = validateEditAlbum(context.formData)
      // The enhanced form asks for JSON so it can stay on the page. A plain
      // browser submission gets HTML for every one of these outcomes.
      let asJson = wantsJson(context.request)

      if (!result.ok) {
        if (asJson) {
          return json({ errors: result.errors, values: result.values }, 400)
        }

        let album = await getAlbum(context.db, context.params.slug)
        if (!album) {
          return context.render(<NotFoundPage slug={context.params.slug} />, { status: 404 })
        }

        return context.render(
          <AlbumEditPage album={album} errors={result.errors} values={result.values} />,
          { status: 400 },
        )
      }

      let outcome = await updateAlbum(
        context.db,
        context.params.slug,
        result.revision,
        result.value,
      )

      if (!outcome.ok && outcome.reason === 'not-found') {
        if (asJson) return new Response('Album not found', { status: 404 })
        return context.render(<NotFoundPage slug={context.params.slug} />, { status: 404 })
      }

      if (!outcome.ok) {
        // Someone else saved first. 409 says the request was well-formed but no
        // longer applies, so the form comes back with the newer revision and
        // the values this user typed.
        if (asJson) {
          return json({ conflict: true, revision: outcome.album.revision }, 409)
        }

        return context.render(
          <AlbumEditPage album={outcome.album} values={result.values} notice="conflict" />,
          { status: 409 },
        )
      }

      if (result.intent === 'save-and-continue') {
        if (asJson) {
          return json({ saved: true, revision: outcome.album.revision }, 200)
        }

        return context.render(<AlbumEditPage album={outcome.album} notice="saved" />)
      }

      return redirect(routes.albums.show.href({ slug: outcome.album.slug }), 303)
    },
  },
})

function wantsJson(request: Request) {
  return request.headers.get('Accept')?.includes('application/json') ?? false
}

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}
