import { createRouter, type RouterContext } from 'remix/router'
import { formData } from 'remix/middleware/form-data'
import { methodOverride } from 'remix/middleware/method-override'
import { staticFiles } from 'remix/middleware/static'

import albumsController from './actions/albums/controller.tsx'
import albumsEditController from './actions/albums/edit/controller.tsx'
import controller from './actions/controller.tsx'
import { loadDatabase } from './middleware/database.ts'
import { requestId } from './middleware/request-id.ts'
import { render } from './middleware/render.tsx'
import { routes } from './routes.ts'

export const router = createRouter({
  middleware: [
    staticFiles('./public', { index: false }),
    requestId(),
    formData(),
    methodOverride(),
    loadDatabase(),
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
