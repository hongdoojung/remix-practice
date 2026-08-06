import { html } from 'remix/html-template'
import { createHtmlResponse } from 'remix/response/html'

import type { Album } from '../data/albums.ts'
import { routes } from '../routes.ts'

/**
 * Not every HTML response needs a component tree. `remix/html-template` escapes
 * interpolated strings and composes nested `SafeHtml` fragments, which is
 * enough for feeds, mail bodies, and other string-oriented output.
 */
export function renderAlbumFeed(albums: Album[]) {
  let items = albums.map((album) => {
    let href = routes.albums.show.href({ slug: album.slug })

    return html`<li>
      <a href="${href}">${album.title}</a> — ${album.artist} (${String(album.year)})
    </li>`
  })

  return createHtmlResponse(html`
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>Vinyl Shelf feed</title>
      </head>
      <body>
        <h1>Vinyl Shelf feed</h1>
        <ul>
          ${items}
        </ul>
      </body>
    </html>
  `)
}
