import { fileURLToPath } from 'node:url'

import { createCookie } from 'remix/cookie'
import { session } from 'remix/middleware/session'
import type { Session } from 'remix/session'
import { createFsSessionStorage } from 'remix/session-storage/fs'
import { createMemorySessionStorage } from 'remix/session-storage/memory'

const env = process.env.NODE_ENV
const isProduction = env === 'production'
const isTest = env === 'test'

export const sessionCookie = createCookie('vinyl_session', {
  secrets: readSessionSecrets(),
  httpOnly: true,
  // Lax still sends the cookie on top-level navigations from other sites, so a
  // link into the app keeps the user signed in. Cross-site POSTs go without it.
  sameSite: 'Lax',
  secure: isProduction,
  path: '/',
  maxAge: 60 * 60 * 24 * 14,
})

const sessionStorage = isTest
  ? createMemorySessionStorage()
  : createFsSessionStorage(fileURLToPath(new URL('../../tmp/sessions', import.meta.url)))

export function loadSession() {
  return session(sessionCookie, sessionStorage)
}

/** A one-time message for the page the next redirect lands on. */
export function flashNotice(session: Session, message: string) {
  session.flash('notice', message)
}

/**
 * Reading a flash value removes it, so only page actions call this — never the
 * renderer, which also runs for frame requests that would swallow the message.
 */
export function takeNotice(session: Session) {
  let notice = session.get('notice')
  return typeof notice === 'string' ? notice : undefined
}

/**
 * Newest secret first: the cookie is signed with the first one and still
 * accepted with the rest, which is how a secret is rotated without signing
 * everyone out.
 */
function readSessionSecrets() {
  let raw = process.env.SESSION_SECRETS ?? process.env.SESSION_SECRET
  let secrets = raw
    ?.split(',')
    .map((secret) => secret.trim())
    .filter(Boolean)

  if (secrets && secrets.length > 0) return secrets

  if (isProduction) {
    throw new Error('SESSION_SECRETS must be set in production')
  }

  // Local-only fallback so `npm run dev` and the tests start without setup.
  // Production refuses to boot without a real secret (above).
  return ['vinyl-shelf-local-dev-secret-not-for-production']
}
