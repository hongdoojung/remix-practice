import { run } from 'remix/ui'

run({
  async loadModule(moduleUrl, exportName) {
    let mod = await import(moduleUrl)
    return mod[exportName]
  },
  async resolveFrame(src, signal, target) {
    let headers = new Headers({ Accept: 'text/html' })
    if (target) headers.set('X-Remix-Target', target)

    // A removed or superseded frame aborts this signal, so a stale reload can
    // never keep loading in the background.
    let response = await fetch(src, { credentials: 'same-origin', headers, signal })
    if (!response.ok) {
      return `<pre>Frame error: ${response.status} ${response.statusText}</pre>`
    }

    if (response.body) return response.body
    return await response.text()
  },
})
