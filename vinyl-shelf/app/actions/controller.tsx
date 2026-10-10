import { createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'

import { assetServer } from '../assets.ts'
import { listAlbums } from '../data/albums.ts'
import { flashNotice, takeNotice } from '../middleware/session.ts'
import { routes } from '../routes.ts'
import { HomePage } from '../ui/vinyl-shelf.tsx'
import { renderAlbumFeed } from './feed.ts'

export default createController(routes, {
  actions: {
    async assets(context) {
      return (
        (await assetServer.fetch(context.request)) ?? new Response('Not Found', { status: 404 })
      )
    },
    async home(context) {
      return context.render(
        <HomePage albums={await listAlbums(context.db)} notice={takeNotice(context.session)} />,
      )
    },
    logout(context) {
      let { session } = context
      session.unset('auth')
      // The old id is deleted from storage, so a copied cookie stops working
      // even if someone kept it.
      session.regenerateId(true)
      flashNotice(session, 'Signed out.')
      return redirect(routes.home.href(), 303)
    },
    async feed(context) {
      return renderAlbumFeed(await listAlbums(context.db))
    },
    async apiAlbums(context) {
      let query = context.url.searchParams.get('query')?.trim().toLowerCase() ?? ''
      let albums = (await listAlbums(context.db))
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
