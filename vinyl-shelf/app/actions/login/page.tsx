import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import button from 'remix/ui/button'
import input from 'remix/ui/input'

import { routes } from '../../routes.ts'
import { CsrfField } from '../../ui/request-scope.tsx'
import { AppShell } from '../../ui/vinyl-shelf.tsx'

export function LoginPage(
  handle: Handle<{ returnTo: string; email?: string; error?: string }>,
) {
  return () => {
    let { returnTo, email = '', error } = handle.props

    return (
      <AppShell title="Sign in | Vinyl Shelf" activePath="/login">
        <form method="post" action={routes.login.action.href()} mix={panelStyle}>
          <p mix={eyebrowStyle}>Auth and sessions</p>
          <h1 mix={titleStyle}>Sign in</h1>
          <p mix={hintStyle}>
            Demo accounts: <code>shelf@vinyl.test</code> owns the seeded albums,{' '}
            <code>guest@vinyl.test</code> owns none. Both use the password{' '}
            <code>vinyl-shelf-demo</code>.
          </p>

          {error ? (
            <p role="alert" mix={alertStyle}>
              {error}
            </p>
          ) : null}

          <CsrfField />
          <input type="hidden" name="returnTo" value={returnTo} />

          <div mix={fieldStyle}>
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="username"
              defaultValue={email}
              required
              mix={input({ size: 'lg' })}
            />
          </div>

          <div mix={fieldStyle}>
            {/* Never refilled after a failed attempt: the password is not echoed back into HTML. */}
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              mix={input({ size: 'lg' })}
            />
          </div>

          <button type="submit" class="shelf-cta" mix={button({ tone: 'primary', size: 'lg' })}>
            Sign in
          </button>
        </form>
      </AppShell>
    )
  }
}

const panelStyle = css({
  background: 'var(--shelf-surface)',
  border: '1px solid var(--shelf-line)',
  borderRadius: 'var(--shelf-radius)',
  display: 'grid',
  gap: '14px',
  margin: '0 auto',
  maxWidth: '440px',
  padding: '24px',
  width: '100%',
})

const eyebrowStyle = css({
  color: 'var(--shelf-accent)',
  fontSize: '0.78rem',
  fontWeight: 800,
  letterSpacing: '0.04em',
  margin: 0,
  textTransform: 'uppercase',
})

const titleStyle = css({ fontSize: '2rem', margin: 0 })

const hintStyle = css({ color: 'var(--shelf-muted)', lineHeight: 1.6, margin: 0 })

const fieldStyle = css({ display: 'grid', gap: '6px', '& label': { fontWeight: 800 } })

const alertStyle = css({
  background: '#fdeced',
  border: '1px solid var(--shelf-danger)',
  borderRadius: 'var(--shelf-radius-sm)',
  color: 'var(--shelf-danger)',
  fontWeight: 700,
  margin: 0,
  padding: '10px 12px',
})
