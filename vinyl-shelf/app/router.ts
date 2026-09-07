import { createRouter, type RouterContext } from 'remix/router'
import { formData } from 'remix/middleware/form-data'
import { methodOverride } from 'remix/middleware/method-override'
import { staticFiles } from 'remix/middleware/static'

import albumsController from './actions/albums/controller.tsx'
import albumsEditController from './actions/albums/edit/controller.tsx'
import controller from './actions/controller.tsx'
import { requestId } from './middleware/request-id.ts'
import { render } from './middleware/render.tsx'
import { serverTiming } from './middleware/server-timing.ts'
import { routes } from './routes.ts'

export const router = createRouter({
  middleware: [
    serverTiming(),
    staticFiles('./public', { index: false }),
    requestId(),
    formData(),
    methodOverride(),
    render(),
  ],
})

type AppContext = RouterContext<typeof router>

declare module 'remix/router' {
  interface RouterTypes {
    context: AppContext
  }
}

router.map(routes, controller)
router.map(routes.albums, albumsController)
router.map(routes.albums.edit, albumsEditController)
