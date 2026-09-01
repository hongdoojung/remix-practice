import { createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'

import { createAlbum, getAlbum, listAlbums } from '../../data/albums.ts'
import { validateCreateAlbum } from '../../data/validation.ts'
import { routes } from '../../routes.ts'
import { AlbumDetailPage, AlbumsPage, NotFoundPage } from '../../ui/vinyl-shelf.tsx'

export default createController(routes.albums, {
  actions: {
    index(context) {
      return context.render(<AlbumsPage albums={listAlbums()} />)
    },
    async create(context) {
      let formData = await context.request.formData()
      let result = validateCreateAlbum(formData)

      if (!result.ok) {
        return context.render(
          <AlbumsPage albums={listAlbums()} errors={result.errors} values={result.values} />,
          { status: 400 },
        )
      }

      let album = createAlbum(result.value)
      return redirect(routes.albums.show.href({ slug: album.slug }), 303)
    },
    show(context) {
      let album = getAlbum(context.params.slug)
      if (!album) {
        return context.render(<NotFoundPage slug={context.params.slug} />, { status: 404 })
      }

      return context.render(<AlbumDetailPage album={album} />)
    },
  },
})
