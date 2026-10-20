export const normalize = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[\s\-_'’().]/g, '')

type SearchEntry<T> = { value: T; name: string; terms: string[] }
export type SearchIndex<T> = readonly SearchEntry<T>[]

export function createSearchIndex<T>(values: readonly T[], namesFor: (value: T) => readonly (string | undefined)[]): SearchIndex<T> {
  return values.map(value => {
    const names = namesFor(value)
    return {value, name: normalize(names[0] || ''), terms: [...new Set(names.filter((name): name is string => !!name).map(normalize))]}
  })
}

export function createFeatureCardIndex<T extends {id: string}>(cards: readonly T[], bindings: Record<string, readonly string[]>): Map<string, T> {
  const index = new Map<string, T>()
  for (const card of cards) for (const id of bindings[card.id] || []) {
    // Shared features keep the first curated card, as in the original catalog.
    if (!index.has(id)) index.set(id, card)
  }
  return index
}

/** Curated cards, climate reference points, then unbound map objects; at most ten results. */
export function searchCatalog<C extends {name: string}, G>(query: string, curated: SearchIndex<C>, references: SearchIndex<C>, features: SearchIndex<G>, limit = 10): (C | G)[] {
  const q = normalize(query.trim())
  if (!q || limit <= 0) return []
  const results: (C | G)[] = []
  const append = <T extends C | G>(index: SearchIndex<T>, accept: (entry: SearchEntry<T>) => boolean) => {
    if (results.length >= limit) return
    for (const entry of index) {
      if (accept(entry) && entry.terms.some(term => term.includes(q))) {
        results.push(entry.value)
        if (results.length >= limit) break
      }
    }
  }
  append(curated, entry => entry.name === q)
  append(curated, entry => entry.name !== q)
  const curatedNames = new Set((results as C[]).map(card => card.name))
  append(references, entry => !curatedNames.has(entry.value.name))
  append(features, () => true)
  return results
}
