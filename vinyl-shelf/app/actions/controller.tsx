import { createController } from 'remix/router'

import { assetServer } from '../assets.ts'
import { listAlbums } from '../data/albums.ts'
import { routes } from '../routes.ts'
import { HomePage } from '../ui/vinyl-shelf.tsx'

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
    apiAlbums(context) {
      return new Response(JSON.stringify({ albums: listAlbums(), requestId: context.requestId }), {
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      })
    },
  },
})
