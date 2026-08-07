import { TypedEventTarget } from 'remix/ui'

export interface QueueEntry {
  slug: string
  title: string
  plays: number
}

/**
 * Application logic lives outside components. The queue owns its entries and
 * the rules for changing them, and announces changes with an event. Components
 * subscribe and keep only their own UI state.
 */
export class ShelfQueue extends TypedEventTarget<{ change: Event }> {
  #entries: QueueEntry[]

  constructor(entries: readonly QueueEntry[] = []) {
    super()
    this.#entries = entries.map((entry) => ({ ...entry }))
  }

  get entries(): QueueEntry[] {
    return this.#entries.map((entry) => ({ ...entry }))
  }

  get playCount(): number {
    return this.#entries.reduce((total, entry) => total + entry.plays, 0)
  }

  add(album: { slug: string; title: string }): void {
    let existing = this.#entries.find((entry) => entry.slug === album.slug)

    this.#entries = existing
      ? this.#entries.map((entry) =>
          entry.slug === album.slug ? { ...entry, plays: entry.plays + 1 } : entry,
        )
      : [...this.#entries, { slug: album.slug, title: album.title, plays: 1 }]

    this.dispatchEvent(new Event('change'))
  }

  remove(slug: string): void {
    let next = this.#entries.filter((entry) => entry.slug !== slug)
    if (next.length === this.#entries.length) return

    this.#entries = next
    this.dispatchEvent(new Event('change'))
  }

  clear(): void {
    if (this.#entries.length === 0) return

    this.#entries = []
    this.dispatchEvent(new Event('change'))
  }
}
