import * as assert from 'remix/assert'
import { beforeEach, describe, it } from 'node:test'

import { Browser } from '../../../test/browser.ts'
import { resetAlbumsForTest } from '../../data/albums.ts'
import { db } from '../../data/database.ts'
import { albums } from '../../data/schema.ts'
import { demoPassword, shelfOwnerEmail } from '../../data/users.ts'
import { router } from '../../router.ts'
import { routes } from '../../routes.ts'

beforeEach(async () => {
  await resetAlbumsForTest(db)
})

describe('auth: sign in', () => {
  it('renders a login form that carries a CSRF token', async () => {
    let browser = new Browser()
    let response = await browser.fetch(routes.login.index.href())
    let html = await response.text()

    assert.equal(response.status, 200)
    assert.match(html, /<form method="post" action="\/login"/)
    assert.match(html, /name="_csrf" value="[0-9a-f]{64}"/)
    assert.match(html, /type="password"/)
  })

  it('rejects a wrong password with one generic message and no echoed password', async () => {
    let browser = new Browser()
    let response = await browser.signIn(shelfOwnerEmail, 'not-the-password')
    let html = await response.text()

    assert.equal(response.status, 400)
    assert.match(html, /Email or password is incorrect/)
    assert.match(html, /value="shelf@vinyl\.test"/)
    assert.equal(html.includes('not-the-password'), false)
  })

  it('answers an unknown email exactly like a wrong password', async () => {
    let browser = new Browser()
    let response = await browser.signIn('nobody@vinyl.test', demoPassword)

    assert.equal(response.status, 400)
    assert.match(await response.text(), /Email or password is incorrect/)
  })

  it('rotates the session id on sign-in and sets a hardened cookie', async () => {
    let browser = new Browser()
    await browser.csrfToken()
    let before = browser.cookieHeader

    let response = await browser.signIn(shelfOwnerEmail, demoPassword)
    let [setCookie = ''] = response.headers.getSetCookie()

    assert.equal(response.status, 303)
    assert.equal(response.headers.get('location'), routes.home.href())
    assert.notEqual(browser.cookieHeader, before)
    assert.match(setCookie, /^vinyl_session=/)
    assert.match(setCookie, /HttpOnly/i)
    assert.match(setCookie, /SameSite=Lax/i)
    assert.match(setCookie, /Path=\//)
  })

  it('shows the sign-in notice once, then drops it', async () => {
    let browser = await Browser.signedIn()

    let first = await (await browser.fetch(routes.home.href())).text()
    let second = await (await browser.fetch(routes.home.href())).text()

    assert.match(first, /Signed in as Shelf Keeper/)
    assert.equal(second.includes('Signed in as Shelf Keeper'), false)
    // The navigation still knows who is signed in after the flash is gone.
    assert.match(second, /Sign out/)
  })

  it('returns to the page that asked for sign-in', async () => {
    let returnTo = routes.albums.edit.index.href({ slug: 'kind-of-blue' })
    let browser = new Browser()
    let response = await browser.signIn(shelfOwnerEmail, demoPassword, returnTo)

    assert.equal(response.status, 303)
    assert.equal(response.headers.get('location'), returnTo)
  })

  it('refuses to send the user to another site after sign-in', async () => {
    for (let returnTo of ['//evil.test/phish', 'https://evil.test', '/\\evil.test']) {
      let browser = new Browser()
      let response = await browser.signIn(shelfOwnerEmail, demoPassword, returnTo)

      assert.equal(response.headers.get('location'), routes.home.href(), returnTo)
    }
  })

  it('sends a signed-in visitor straight past the login page', async () => {
    let browser = await Browser.signedIn()
    let response = await browser.fetch(routes.login.index.href())

    assert.equal(response.status, 303)
  })
})

describe('auth: sign out', () => {
  it('signs out and makes the old cookie worthless', async () => {
    let browser = await Browser.signedIn()
    let stolenCookie = browser.cookieHeader

    let response = await browser.submit(routes.logout.href(), {})
    assert.equal(response.status, 303)
    assert.equal(response.headers.get('location'), routes.home.href())

    let home = await (await browser.fetch(routes.home.href())).text()
    assert.match(home, /Signed out\./)
    assert.match(home, />\s*Sign in\s*</)

    // Replaying the cookie from before sign-out finds no session behind it.
    let replay = await router.fetch(
      new Request(`http://local.test${routes.albums.edit.index.href({ slug: 'kind-of-blue' })}`, {
        headers: { Cookie: stolenCookie },
      }),
    )
    assert.equal(replay.status, 303)
    assert.match(replay.headers.get('location') ?? '', /^\/login\?returnTo=/)
  })
})

describe('security: csrf and cross-origin requests', () => {
  let album = {
    title: 'Forged',
    artist: 'Nobody',
    year: '2020',
    genre: 'None',
    notes: 'Should never be stored.',
  }

  it('rejects a mutation that carries the session cookie but no token', async () => {
    let browser = await Browser.signedIn()
    let response = await browser.fetch(routes.albums.create.href(), {
      method: 'POST',
      body: new URLSearchParams(album),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })

    assert.equal(response.status, 403)
    assert.equal(await db.count(albums), 3)
  })

  it('rejects a token that belongs to another session', async () => {
    let attacker = new Browser()
    let attackerToken = await attacker.csrfToken()
    let victim = await Browser.signedIn()

    let response = await victim.fetch(routes.albums.create.href(), {
      method: 'POST',
      body: new URLSearchParams({ ...album, _csrf: attackerToken }),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })

    assert.equal(response.status, 403)
  })

  it('rejects a cross-site browser POST before it reaches the action', async () => {
    let browser = await Browser.signedIn()
    let response = await browser.submit(routes.albums.create.href(), album, {
      'Sec-Fetch-Site': 'cross-site',
    })

    assert.equal(response.status, 403)
  })

  it('rejects a POST whose Origin is another site', async () => {
    let browser = await Browser.signedIn()
    let response = await browser.submit(routes.albums.create.href(), album, {
      Origin: 'https://evil.test',
    })

    assert.equal(response.status, 403)
  })

  it('accepts a same-origin POST with the right token', async () => {
    let browser = await Browser.signedIn()
    let response = await browser.submit(routes.albums.create.href(), album, {
      'Sec-Fetch-Site': 'same-origin',
      Origin: 'http://local.test',
    })

    assert.equal(response.status, 303)
  })
})
