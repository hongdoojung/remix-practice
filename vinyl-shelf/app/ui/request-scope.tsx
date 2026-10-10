import type { Handle, RemixNode } from 'remix/ui'

import type { User } from '../data/users.ts'

interface RequestScopeContext {
  user: User | null
  csrfToken: string
}

/**
 * Request facts every page needs — who is signed in and the form token — set
 * once by the renderer instead of threaded through each page's props.
 * Hydrated client entries cannot read this; pass them what they need as props.
 */
export function RequestScope(
  handle: Handle<{ user: User | null; csrfToken: string; children?: RemixNode }, RequestScopeContext>,
) {
  handle.context.set({ user: handle.props.user, csrfToken: handle.props.csrfToken })
  return () => handle.props.children
}

export function CsrfField(handle: Handle) {
  let scope = handle.context.get(RequestScope)
  return () => <input type="hidden" name="_csrf" value={scope.csrfToken} />
}
