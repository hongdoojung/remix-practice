import { createController } from 'remix/router'

import { assetServer } from '../assets.ts'
import { listAlbums } from '../data/albums.ts'
import { routes } from '../routes.ts'
import { HomePage } from '../ui/vinyl-shelf.tsx'
import { renderAlbumFeed } from './feed.ts'
import { ShelfStats } from './stats.tsx'

export default createController(routes, {
  actions: {
    async assets(context) {
      return (
        (await assetServer.fetch(context.request)) ?? new Response('Not Found', { status: 404 })
      )
    },
    home(context) {
      return context.render(<HomePage albums={listAlbums()} />)
    },
    stats(context) {
      let albums = listAlbums()

      return context.render(
        <ShelfStats
          albumCount={albums.length}
          genreCount={new Set(albums.map((album) => album.genre)).size}
          latestYear={albums.length ? Math.max(...albums.map((album) => album.year)) : null}
        />,
      )
    },
    feed() {
      return renderAlbumFeed(listAlbums())
    },
    apiAlbums(context) {
      let query = context.url.searchParams.get('query')?.trim().toLowerCase() ?? ''
      let albums = listAlbums()
        .filter(
          (album) =>
            query === '' ||
            album.title.toLowerCase().includes(query) ||
            album.artist.toLowerCase().includes(query) ||
            album.genre.toLowerCase().includes(query),
        )
        // The server owns URL construction, so browser code never rebuilds it.
        .map((album) => ({ ...album, href: routes.albums.show.href({ slug: album.slug }) }))

      return new Response(JSON.stringify({ albums, query, requestId: context.requestId }), {
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      })
    },
  },
})
