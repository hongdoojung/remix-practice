import * as assert from 'remix/assert'
import { describe, it } from 'node:test'

import { router } from '../../router.ts'
import { routes } from '../../routes.ts'

function request(path: string) {
  return new Request(`http://local.test${path}`)
}

describe('genre routes', () => {
  it('renders the genre list with links built from href()', async () => {
    let response = await router.fetch(request(routes.genres.index.href()))
    let html = await response.text()

    assert.equal(response.status, 200)
    assert.match(html, /Modal jazz/)
    assert.match(html, new RegExp(routes.genres.show.href({ genre: 'Rock' })))
  })

  it('returns a 404 response for a genre no album uses', async () => {
    let response = await router.fetch(request(routes.genres.show.href({ genre: 'Vaporwave' })))
    let html = await response.text()

    assert.equal(response.status, 404)
    assert.match(html, /Genre not found/)
  })
})
