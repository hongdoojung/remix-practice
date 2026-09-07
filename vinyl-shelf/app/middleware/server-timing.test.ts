import * as assert from 'remix/assert'
import { describe, it } from 'node:test'

import { router } from '../router.ts'
import { routes } from '../routes.ts'

function request(path: string) {
  return new Request(`http://local.test${path}`)
}

const RESPONSE_TIME = /^\d+(\.\d+)?ms$/

describe('serverTiming middleware', () => {
  it('adds a response time header to HTML page responses', async () => {
    let response = await router.fetch(request(routes.albums.index.href()))

    assert.equal(response.status, 200)
    assert.match(response.headers.get('X-Response-Time') ?? '', RESPONSE_TIME)
  })

  it('adds a response time header to JSON API responses', async () => {
    let response = await router.fetch(request(routes.apiAlbums.href()))

    assert.equal(response.status, 200)
    assert.match(response.headers.get('X-Response-Time') ?? '', RESPONSE_TIME)
  })

  it('measures static files, which requestId() placed after staticFiles() misses', async () => {
    let response = await router.fetch(request('/favicon.svg'))

    assert.equal(response.status, 200)
    assert.match(response.headers.get('X-Response-Time') ?? '', RESPONSE_TIME)
    assert.equal(response.headers.get('X-Request-Id'), null)
  })

  it('exposes the start reading as context.startedAt', async () => {
    let response = await router.fetch(request(routes.apiAlbums.href()))
    let payload = (await response.json()) as { elapsedMs: number }

    assert.ok(payload.elapsedMs >= 0)
  })
})
