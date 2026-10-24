import bindings from '../data/feature-bindings.json' with {type:'json'}
import type {GeoProperties, Knowledge} from '../types'

/** Only explicit feature IDs/loaded geometry determine a result's representation. */
export function mapRepresentation(place:Knowledge|GeoProperties):'area'|'line'|'point'|'concept' {
  if('summary' in place && place.mapRole==='concept')return 'concept'
  const ids='summary' in place ? (bindings as Record<string,string[]>)[place.id]||[] : [place.id]
  const geometryType='geometryType' in place ? place.geometryType : undefined
  if(geometryType==='Polygon'||geometryType==='MultiPolygon')return 'area'
  if(geometryType==='LineString'||geometryType==='MultiLineString')return 'line'
  if(ids.some(id=>/^(region|country|province|lake|language-area|basin-hybas)-/.test(id)))return 'area'
  if(ids.some(id=>/^(river|plate-usgs)-/.test(id)))return 'line'
  return 'point'
}
export const representationLabels={area:'区域范围',line:'线状要素',point:'定位点',concept:'概念解读'}
