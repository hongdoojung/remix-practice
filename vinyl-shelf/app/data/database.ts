import * as fs from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'

import { createDatabase } from 'remix/data-table'
import { createMigrationRunner } from 'remix/data-table/migrations'
import { loadMigrations } from 'remix/data-table/migrations/node'
import { createSqliteDatabaseAdapter } from 'remix/data-table/sqlite'

import { seedAlbumsIfEmpty } from './albums.ts'

const migrationsDir = fileURLToPath(new URL('../../db/migrations', import.meta.url))
const databaseFile = fileURLToPath(new URL('../../db/vinyl-shelf.db', import.meta.url))

// Tests get a throwaway in-memory database; dev and production share a file.
const isTest = process.env.NODE_ENV === 'test'
if (!isTest) fs.mkdirSync(fileURLToPath(new URL('../../db', import.meta.url)), { recursive: true })

const sqlite = new DatabaseSync(isTest ? ':memory:' : databaseFile)
sqlite.exec('pragma foreign_keys = on')

const adapter = createSqliteDatabaseAdapter(sqlite)

export const db = createDatabase(adapter)

// Migrations and seed data run before the router accepts any request: this
// module initializes at import time, and every request path imports it.
const migrations = await loadMigrations(migrationsDir)
const runner = createMigrationRunner(adapter, migrations)
await runner.up()
await seedAlbumsIfEmpty(db)
