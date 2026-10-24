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

/** Exact place names precede substring matches; curated entries win equal matches. */
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
  const curatedNames = new Set(curated.filter(entry=>entry.terms.some(term=>term.includes(q))).map(entry=>entry.value.name))
  // Real map objects with an exact name precede unrelated curated case cards
  // and climate sample points. Do not infer new geometry from a partial name.
  for (const exact of [true, false]) {
    append(curated, entry => (entry.name === q) === exact)
    append(features, entry => (entry.name === q) === exact)
    append(references, entry => !curatedNames.has(entry.value.name) && (entry.name === q) === exact)
  }
  return results
}
