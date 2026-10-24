/** Bounds may cross the antimeridian or use MapLibre's unwrapped longitudes. */
export function coordinatesInBounds(point:[number,number],bounds:[number,number,number,number]):boolean {
  const [west,south,east,north]=bounds
  if(point[1]<south||point[1]>north)return false
  const span=east-west
  if(Math.abs(span)>=360)return true
  const width=((span%360)+360)%360
  const offset=(((point[0]-west)%360)+360)%360
  return offset<=width
}
