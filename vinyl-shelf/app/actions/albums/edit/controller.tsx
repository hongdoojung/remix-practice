import { createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'

import { getAlbum, updateAlbum } from '../../../data/albums.ts'
import { validateCreateAlbum } from '../../../data/validation.ts'
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
      let result = validateCreateAlbum(context.formData)

      if (!result.ok) {
        // The enhanced form asks for JSON so it can show inline errors without
        // replacing the page. A plain browser submission still gets HTML.
        if (wantsJson(context.request)) {
          return new Response(JSON.stringify({ errors: result.errors, values: result.values }), {
            status: 400,
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
          })
        }

        let album = await getAlbum(context.db, context.params.slug)
        if (!album) {
          return context.render(<NotFoundPage slug={context.params.slug} />, { status: 404 })
        }

        return context.render(<AlbumEditPage album={album} errors={result.errors} values={result.values} />, {
          status: 400,
        })
      }

      let album = await updateAlbum(context.db, context.params.slug, result.value)
      if (!album) {
        return context.render(<NotFoundPage slug={context.params.slug} />, { status: 404 })
      }

      return redirect(routes.albums.show.href({ slug: album.slug }), 303)
    },
  },
})

function wantsJson(request: Request) {
  return request.headers.get('Accept')?.includes('application/json') ?? false
}
