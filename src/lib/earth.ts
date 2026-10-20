/** Ideal spherical Earth; solar centre on a flat horizon, without refraction. */
export function daylightHours(latitude:number,declination:number):number {
  const radians=Math.PI/180
  const hourAngle=-Math.tan(latitude*radians)*Math.tan(declination*radians)
  return 24*Math.acos(Math.max(-1,Math.min(1,hourAngle)))/Math.PI
}
export function solarTimeOffsetMinutes(longitude:number):number {return longitude*4}
export function scaleDistanceKm(centimetres:number,denominator:number):number {return centimetres*denominator/100000}
