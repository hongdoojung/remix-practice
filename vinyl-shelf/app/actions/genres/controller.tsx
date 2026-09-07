import { createController } from 'remix/router'

import { listAlbums } from '../../data/albums.ts'
import { routes } from '../../routes.ts'
import { GenreDetailPage, GenreNotFoundPage, GenresPage } from './page.tsx'

export default createController(routes.genres, {
  actions: {
    index(context) {
      let genres = [...new Set(listAlbums().map((album) => album.genre))]
      return context.render(<GenresPage genres={genres} />)
    },
    show(context) {
      let albums = listAlbums().filter((album) => album.genre === context.params.genre)
      if (albums.length === 0) {
        return context.render(<GenreNotFoundPage genre={context.params.genre} />, { status: 404 })
      }

      return context.render(<GenreDetailPage genre={context.params.genre} albums={albums} />)
    },
  },
})
