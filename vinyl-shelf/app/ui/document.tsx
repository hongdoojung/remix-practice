import type { Handle, RemixNode } from 'remix/ui'

import { entryHref, stylesheetHref } from '../assets.ts'

export interface DocumentProps {
  children?: RemixNode
  description?: string
  head?: RemixNode
  title?: string
}

const DEFAULT_TITLE = readAppDisplayName('Vinyl%20Shelf')

export function Document(handle: Handle<DocumentProps>) {
  return () => {
    let { children, description, head, title = DEFAULT_TITLE } = handle.props

    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
          <title>{title}</title>
          {description ? <meta name="description" content={description} /> : null}
          <link rel="stylesheet" href={stylesheetHref} />
          {head}
          <script type="module" src={entryHref}></script>
        </head>
        <body>{children}</body>
      </html>
    )
  }
}

function readAppDisplayName(value: string): string {
  return value.startsWith('%%') ? 'Remix App' : decodeURIComponent(value)
}
