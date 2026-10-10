import * as assert from 'remix/assert'
import { before, beforeEach, describe, it } from 'node:test'

import { Browser } from '../../../test/browser.ts'
import { resetAlbumsForTest } from '../../data/albums.ts'
import { db } from '../../data/database.ts'
import { albums } from '../../data/schema.ts'
import { routes } from '../../routes.ts'

const kindOfBlue = { slug: 'kind-of-blue' }

const editedFields = {
  title: 'Kind of Blue',
  artist: 'Miles Davis',
  year: '1959',
  genre: 'Modal jazz',
  notes: 'Changed by someone who does not own it.',
  revision: '1',
}

// The guest account exists but owns none of the seeded albums.
let guest: Browser

before(async () => {
  guest = await Browser.signedIn('guest@vinyl.test')
})

beforeEach(async () => {
  await resetAlbumsForTest(db)
})

describe('auth: protected album routes', () => {
  it('sends an anonymous visitor to sign in and back', async () => {
    let browser = new Browser()
    let response = await browser.fetch(routes.albums.edit.index.href(kindOfBlue))

    assert.equal(response.status, 303)
    assert.equal(
      response.headers.get('location'),
      routes.login.index.href(undefined, { returnTo: '/albums/kind-of-blue/edit' }),
    )
  })

  it('does not create an album for an anonymous form post', async () => {
    let browser = new Browser()
    let response = await browser.submit(routes.albums.create.href(), {
      title: 'Anonymous',
      artist: 'Nobody',
      year: '2020',
      genre: 'None',
      notes: 'Should never be stored.',
    })

    assert.equal(response.status, 303)
    assert.match(response.headers.get('location') ?? '', /^\/login\?returnTo=/)
    assert.equal(await db.count(albums), 3)
  })

  it('answers the enhanced form with 401 JSON instead of a redirect', async () => {
    let browser = new Browser()
    let response = await browser.submit(
      routes.albums.edit.action.href(kindOfBlue),
      editedFields,
      { Accept: 'application/json' },
    )

    assert.equal(response.status, 401)
    assert.deepEqual(await response.json(), { error: 'Sign in required' })
  })

  it('shows anonymous visitors a sign-in prompt instead of the add form', async () => {
    let html = await (await new Browser().fetch(routes.albums.index.href())).text()

    assert.match(html, /Sign in to add one/)
    assert.equal(html.includes(`action="${routes.albums.create.href()}"`), false)
  })
})

describe('auth: album ownership', () => {
  it('records who added an album', async () => {
    let response = await guest.submit(routes.albums.create.href(), {
      title: 'Blue Train',
      artist: 'John Coltrane',
      year: '1958',
      genre: 'Hard bop',
      notes: 'Added by the guest.',
    })
    assert.equal(response.status, 303)

    let row = await db.findOne(albums, { where: { slug: 'blue-train' } })
    let seeded = await db.findOne(albums, { where: { slug: 'kind-of-blue' } })
    assert.ok(row && seeded)
    assert.notEqual(row.owner_id, seeded.owner_id)
  })

  it('hides edit and delete from someone who does not own the album', async () => {
    let guestView = await (await guest.fetch(routes.albums.show.href(kindOfBlue))).text()
    let owner = await Browser.signedIn()
    let ownerView = await (await owner.fetch(routes.albums.show.href(kindOfBlue))).text()

    assert.equal(guestView.includes('Edit album'), false)
    assert.equal(guestView.includes('Delete album'), false)
    assert.match(ownerView, /Edit album/)
    assert.match(ownerView, /Delete album/)
  })

  it('refuses the edit page to a signed-in non-owner', async () => {
    let response = await guest.fetch(routes.albums.edit.index.href(kindOfBlue))

    assert.equal(response.status, 403)
    assert.match(await response.text(), /Not your album/)
  })

  it('refuses an edit from a non-owner even when the form is posted directly', async () => {
    let response = await guest.submit(routes.albums.edit.action.href(kindOfBlue), editedFields)

    assert.equal(response.status, 403)
    let row = await db.findOne(albums, { where: { slug: 'kind-of-blue' } })
    assert.equal(row?.revision, 1)
    assert.notEqual(row?.notes, editedFields.notes)
  })

  it('checks ownership before reporting field errors', async () => {
    let response = await guest.submit(
      routes.albums.edit.action.href(kindOfBlue),
      { ...editedFields, title: '' },
      { Accept: 'application/json' },
    )

    assert.equal(response.status, 403)
    assert.deepEqual(await response.json(), { error: 'forbidden' })
  })

  it('refuses a delete from a non-owner', async () => {
    let response = await guest.submit(routes.albums.destroy.href(kindOfBlue), {
      _method: 'DELETE',
    })

    assert.equal(response.status, 403)
    assert.ok(await db.findOne(albums, { where: { slug: 'kind-of-blue' } }))
  })
})
