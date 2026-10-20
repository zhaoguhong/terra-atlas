import type { Feature, Geometry, Position } from 'geojson'

export type Bounds = [number, number, number, number]

/** Keep camera state in one canonical world without clipping at the dateline. */
export function wrapLongitude(longitude: number): number {
  return ((longitude + 180) % 360 + 360) % 360 - 180
}

/** The smallest longitude interval containing the supplied real geometry. */
export function geometryBounds(features: Feature[]): Bounds | null {
  const coordinates: Position[] = []
  const collect = (geometry: Geometry) => {
    if (geometry.type === 'GeometryCollection') return geometry.geometries.forEach(collect)
    const walk = (value: unknown): void => {
      if (!Array.isArray(value)) return
      if (typeof value[0] === 'number' && typeof value[1] === 'number') {
        if (Number.isFinite(value[0]) && Number.isFinite(value[1])) coordinates.push(value as Position)
      } else value.forEach(walk)
    }
    walk(geometry.coordinates)
  }
  features.forEach(feature => { if (feature.geometry) collect(feature.geometry) })
  if (!coordinates.length) return null
  const longitudes = coordinates.map(p => ((p[0] % 360) + 360) % 360).sort((a, b) => a - b)
  let largestGap = -1, start = 0
  for (let i = 0; i < longitudes.length; i++) {
    const gap = (i === longitudes.length - 1 ? longitudes[0] + 360 : longitudes[i + 1]) - longitudes[i]
    if (gap > largestGap) { largestGap = gap; start = (i + 1) % longitudes.length }
  }
  let west = longitudes[start], east = west + 360 - largestGap
  // The whole interval must use the world copy containing its midpoint. Testing
  // only the western edge leaves countries such as the USA centred beyond 180°.
  const worldOffset = 360 * Math.ceil(((west + east) / 2 - 180) / 360)
  west -= worldOffset; east -= worldOffset
  let south = 90, north = -90
  coordinates.forEach(p => { south = Math.min(south, p[1]); north = Math.max(north, p[1]) })
  return [west, Math.max(-85, south), east, Math.min(85, north)]
}

/** Avoid visible HTML panels; measurements are relative to the map, not the window. */
export function mapPadding(container: HTMLElement) {
  const rect = container.getBoundingClientRect()
  const padding = { top: 22, bottom: 30, left: 22, right: 22 }
  const mobile = matchMedia('(max-width: 759px), (max-width: 1000px) and (max-height: 540px)').matches
  for (const selector of ['.explorer', '.knowledge-panel:not(.embedded)', '.probe-panel', '.compare-panel', ...(mobile?['.map-legend']:[])]) {
    for (const element of document.querySelectorAll<HTMLElement>(selector)) {
      const style = getComputedStyle(element), panel = element.getBoundingClientRect()
      if (style.display === 'none' || style.visibility === 'hidden' || !panel.width || !panel.height) continue
      if (panel.right <= rect.left || panel.left >= rect.right || panel.bottom <= rect.top || panel.top >= rect.bottom) continue
      // The legend sits at the bottom even when a collapsed landscape reader
      // leaves a wide map; its width must not turn it into a left sidebar.
      if (mobile && (selector === '.map-legend' || panel.width > rect.width * .65)) {
        if (panel.top > rect.top + rect.height * .2) padding.bottom = Math.max(padding.bottom, rect.bottom - panel.top + 18)
      } else if (panel.left + panel.width / 2 < rect.left + rect.width / 2) {
        padding.left = Math.max(padding.left, panel.right - rect.left + 18)
      } else padding.right = Math.max(padding.right, rect.right - panel.left + 18)
    }
  }
  // A transient full-screen sheet must not yield an impossible camera.
  const horizontal = padding.left + padding.right, vertical = padding.top + padding.bottom
  if (horizontal > rect.width - 80) { const scale = Math.max(0, rect.width - 80) / horizontal; padding.left *= scale; padding.right *= scale }
  if (vertical > rect.height - 100) { const scale = Math.max(0, rect.height - 100) / vertical; padding.top *= scale; padding.bottom *= scale }
  return padding
}
