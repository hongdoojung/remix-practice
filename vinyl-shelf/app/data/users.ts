import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

import type { Database } from 'remix/data-table'

import { users, type UserRow } from './schema.ts'

/** The identity the rest of the app sees. The password hash never leaves this module. */
export type User = Omit<UserRow, 'password_hash'>

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>

const keyLength = 64

export const demoPassword = 'vinyl-shelf-demo'

const demoUsers = [
  { email: 'shelf@vinyl.test', name: 'Shelf Keeper' },
  { email: 'guest@vinyl.test', name: 'Guest Listener' },
]

export const shelfOwnerEmail = demoUsers[0]!.email

export async function hashPassword(password: string) {
  let salt = randomBytes(16)
  let hash = await scryptAsync(password, salt, keyLength)
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`
}

async function passwordMatches(password: string, stored: string) {
  let [scheme, salt, hash] = stored.split('$')
  if (scheme !== 'scrypt' || !salt || !hash) return false

  let expected = Buffer.from(hash, 'base64')
  let actual = await scryptAsync(password, Buffer.from(salt, 'base64'), expected.length)
  return timingSafeEqual(actual, expected)
}

// Hashed once at startup. An unknown email still pays for one scrypt run, so
// response time does not reveal which emails have accounts.
const decoyHash = await hashPassword('decoy-password')

export async function verifyPassword(db: Database, email: string, password: string) {
  let row = await db.findOne(users, { where: { email: email.trim().toLowerCase() } })
  if (!row) {
    await passwordMatches(password, decoyHash)
    return null
  }

  return (await passwordMatches(password, row.password_hash)) ? toUser(row) : null
}

export async function getUser(db: Database, id: number) {
  let row = await db.find(users, id)
  return row ? toUser(row) : null
}

export function findUserByEmail(db: Database, email: string) {
  return db.findOne(users, { where: { email } })
}

/**
 * Two accounts so ownership has something to say: the first owns the seeded
 * albums, the second owns nothing. Production never gets accounts with a
 * password printed in the docs.
 */
export async function seedUsersIfEmpty(db: Database) {
  if (process.env.NODE_ENV === 'production') return
  if ((await db.count(users)) > 0) return

  for (let user of demoUsers) {
    await db.create(users, { ...user, password_hash: await hashPassword(demoPassword) })
  }
}

function toUser({ password_hash: _, ...user }: UserRow): User {
  return user
}
