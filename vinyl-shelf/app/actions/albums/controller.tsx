import { createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'

import { createAlbum, deleteAlbum, getAlbum, getRecommendations, listAlbums } from '../../data/albums.ts'
import { validateCreateAlbum } from '../../data/validation.ts'
import { routes } from '../../routes.ts'
import { AlbumDetailPage, AlbumsPage, NotFoundPage } from '../../ui/vinyl-shelf.tsx'
import { AlbumRecommendations } from './recommendations.tsx'

export default createController(routes.albums, {
  actions: {
    index(context) {
      return context.render(<AlbumsPage albums={listAlbums()} />)
    },
    create(context) {
      let result = validateCreateAlbum(context.formData)

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
    recommendations(context) {
      let album = getAlbum(context.params.slug)
      if (!album) {
        // The region response stays small: the frame resolver turns it into
        // bounded HTML instead of replacing the surrounding page.
        return new Response('Album not found', { status: 404 })
      }

      return context.render(
        <AlbumRecommendations album={album} recommendations={getRecommendations(album)} />,
      )
    },
    destroy(context) {
      let deleted = deleteAlbum(context.params.slug)
      if (!deleted) {
        return context.render(<NotFoundPage slug={context.params.slug} />, { status: 404 })
      }

      return redirect(routes.albums.index.href(), 303)
    },
  },
})
