import { createContextKey, type Middleware } from 'remix/router'
import type { Database } from 'remix/data-table'

import { db } from '../data/database.ts'

export const DatabaseContext = createContextKey<Database>()

const databaseProperty = { property: 'db' } as const

/**
 * Actions read the request-scoped database from context instead of importing
 * the singleton, so tests or future deployments can swap what gets injected
 * without touching any controller.
 */
export function loadDatabase(): Middleware<{
  key: typeof DatabaseContext
  value: Database
  property: 'db'
}> {
  return async (context, next) => {
    context.set(DatabaseContext, db, databaseProperty)
    return next()
  }
}
