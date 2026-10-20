export type Coordinate = [number, number]
const radians = Math.PI / 180
const earthRadiusKm = 6371.0088

export function greatCircleDistance(a: Coordinate, b: Coordinate): number {
  const latitude = (b[1] - a[1]) * radians, longitude = (b[0] - a[0]) * radians
  const h = Math.sin(latitude / 2) ** 2 + Math.cos(a[1] * radians) * Math.cos(b[1] * radians) * Math.sin(longitude / 2) ** 2
  return earthRadiusKm * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))))
}
export function routeDistance(points: Coordinate[]): number {
  return points.slice(1).reduce((distance, point, index) => distance + greatCircleDistance(points[index], point), 0)
}

/** Intermediate points follow the same great circle used for the displayed distance. */
export function greatCircleRoute(points: Coordinate[]): Coordinate[][] {
  const lines: Coordinate[][] = []
  for (let index = 1; index < points.length; index++) {
    const a = points[index - 1], b = points[index]
    const vector = ([longitude, latitude]: Coordinate) => [Math.cos(latitude * radians) * Math.cos(longitude * radians), Math.cos(latitude * radians) * Math.sin(longitude * radians), Math.sin(latitude * radians)]
    const va = vector(a), vb = vector(b)
    const angle = Math.acos(Math.min(1, Math.max(-1, va.reduce((sum, v, i) => sum + v * vb[i], 0))))
    // Antipodal points have no unique shortest route; choose a stable meridian arc.
    const nearAntipodal = Math.abs(Math.PI - angle) < 1e-7
    const steps = Math.max(1, Math.ceil(angle / (.75 * radians)))
    let line: Coordinate[] = [a]
    for (let step = 1; step <= steps; step++) {
      const t = step / steps
      let coordinate: Coordinate
      if (angle < 1e-9) coordinate = b
      else if (nearAntipodal) {
        const basis = Math.abs(va[2]) < .9 ? [0, 0, 1] : [1, 0, 0]
        const dot = basis.reduce((sum, v, i) => sum + v * va[i], 0)
        const perpendicular = basis.map((v, i) => v - dot * va[i])
        const length = Math.hypot(...perpendicular)
        const v = va.map((v, i) => v * Math.cos(angle * t) + perpendicular[i] / length * Math.sin(angle * t))
        coordinate = [Math.atan2(v[1], v[0]) / radians, Math.atan2(v[2], Math.hypot(v[0], v[1])) / radians]
      } else {
        const first = Math.sin((1 - t) * angle) / Math.sin(angle), second = Math.sin(t * angle) / Math.sin(angle)
        const v = va.map((v, i) => v * first + vb[i] * second)
        coordinate = [Math.atan2(v[1], v[0]) / radians, Math.atan2(v[2], Math.hypot(v[0], v[1])) / radians]
      }
      // Split the antimeridian rather than drawing a line across the whole world.
      const previous = line[line.length - 1]
      if (Math.abs(coordinate[0] - previous[0]) > 180) {
        const unwrapped = coordinate[0] + (coordinate[0] < previous[0] ? 360 : -360)
        const edge = previous[0] > 0 ? 180 : -180
        const ratio = (edge - previous[0]) / (unwrapped - previous[0])
        const latitude = previous[1] + (coordinate[1] - previous[1]) * ratio
        line.push([edge, latitude]); lines.push(line); line = [[-edge, latitude]]
      }
      line.push(step === steps ? b : coordinate)
    }
    lines.push(line)
  }
  return lines
}
