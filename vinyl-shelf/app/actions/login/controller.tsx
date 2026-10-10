import { completeAuth, createCredentialsAuthProvider, verifyCredentials } from 'remix/auth'
import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'
import { createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'

import { verifyPassword } from '../../data/users.ts'
import type { SessionAuth } from '../../middleware/auth.ts'
import { DatabaseContext } from '../../middleware/database.ts'
import { flashNotice } from '../../middleware/session.ts'
import { routes } from '../../routes.ts'
import { LoginPage } from './page.tsx'

const loginFormSchema = f.object({
  email: f.field(s.defaulted(s.string(), '').transform((value) => value.trim())),
  password: f.field(s.defaulted(s.string(), '')),
})

const passwordProvider = createCredentialsAuthProvider({
  parse(context) {
    let result = s.parseSafe(loginFormSchema, context.get(FormData) ?? new FormData())
    return result.success ? result.value : { email: '', password: '' }
  },
  async verify({ email, password }, context) {
    let db = context.get(DatabaseContext)
    if (!db || email === '' || password === '') return null
    return verifyPassword(db, email, password)
  },
})

export default createController(routes.login, {
  actions: {
    index(context) {
      let returnTo = safeReturnTo(context.url.searchParams.get('returnTo'))
      if (context.auth.ok) return redirect(returnTo, 303)

      return context.render(<LoginPage returnTo={returnTo} />)
    },
    async action(context) {
      let returnTo = safeReturnTo(context.formData.get('returnTo'))
      let user = await verifyCredentials(passwordProvider, context)

      if (!user) {
        let email = context.formData.get('email')
        // One message for both a wrong password and an unknown email, so the
        // form does not reveal which addresses have accounts.
        return context.render(
          <LoginPage
            returnTo={returnTo}
            email={typeof email === 'string' ? email.trim() : ''}
            error="Email or password is incorrect."
          />,
          { status: 400 },
        )
      }

      // New session id before the auth record is written: an id someone
      // planted before login must not become a signed-in session.
      let session = completeAuth(context)
      session.set('auth', { userId: user.id } satisfies SessionAuth)
      flashNotice(session, `Signed in as ${user.name}.`)

      return redirect(returnTo, 303)
    },
  },
})

/**
 * `returnTo` comes from the URL, so anyone can write a link that sets it. Only
 * same-site paths are followed; `//evil.test` would be a different host.
 */
function safeReturnTo(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') return routes.home.href()
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return routes.home.href()
  }
  return value
}
