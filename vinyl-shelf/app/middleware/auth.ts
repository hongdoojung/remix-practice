import type { RequestContext } from 'remix/router'
import { auth, createSessionAuthScheme, requireAuth } from 'remix/middleware/auth'
import { redirect } from 'remix/response/redirect'

import { getUser, type User } from '../data/users.ts'
import { routes } from '../routes.ts'
import { DatabaseContext } from './database.ts'

/** What login writes into the session. Only the id: the user row is re-read per request. */
export interface SessionAuth {
  userId: number
}

export function loadAuth() {
  return auth({
    schemes: [
      createSessionAuthScheme<User, SessionAuth>({
        read(session) {
          let value = session.get('auth') as SessionAuth | undefined
          return typeof value?.userId === 'number' ? value : null
        },
        // A deleted account must stop working on its next request, so the
        // session only stores the id and the row is looked up every time.
        verify(value, context) {
          let db = context.get(DatabaseContext)
          return db ? getUser(db, value.userId) : null
        },
        invalidate(session) {
          session.unset('auth')
        },
      }),
    ],
  })
}

export function requireUser() {
  return requireAuth<User>({
    onFailure(context) {
      if (wantsJson(context)) {
        return Response.json({ error: 'Sign in required' }, { status: 401 })
      }

      let returnTo = context.url.pathname + context.url.search
      return redirect(routes.login.index.href(undefined, { returnTo }), 303)
    },
  })
}

function wantsJson(context: RequestContext) {
  return context.headers.get('Accept')?.includes('application/json') ?? false
}
