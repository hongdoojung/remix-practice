import { createContextKey, type Middleware } from 'remix/router'

export const RequestId = createContextKey<string>()

const requestIdProperty = { property: 'requestId' } as const

export function requestId(): Middleware<{
  key: typeof RequestId
  value: string
  property: 'requestId'
}> {
  return async (context, next) => {
    let id = context.headers.get('X-Request-Id')?.trim() || crypto.randomUUID()
    context.set(RequestId, id, requestIdProperty)

    let response = await next()
    let headers = new Headers(response.headers)
    headers.set('X-Request-Id', id)

    return new Response(response.body, {
      headers,
      status: response.status,
      statusText: response.statusText,
    })
  }
}
