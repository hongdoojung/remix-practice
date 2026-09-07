import { createContextKey, type Middleware } from 'remix/router'

export const StartedAt = createContextKey<number>()

const startedAtProperty = { property: 'startedAt' } as const

export function serverTiming(): Middleware<{
  key: typeof StartedAt
  value: number
  property: 'startedAt'
}> {
  return async (context, next) => {
    let startedAt = performance.now()
    context.set(StartedAt, startedAt, startedAtProperty)

    let response = await next()
    let headers = new Headers(response.headers)
    headers.set('X-Response-Time', `${(performance.now() - startedAt).toFixed(1)}ms`)

    return new Response(response.body, {
      headers,
      status: response.status,
      statusText: response.statusText,
    })
  }
}
