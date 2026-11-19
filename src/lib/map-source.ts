export function sourceForId(id: string): string | undefined {
  if(id.startsWith('region-cn-zhang2025-'))return 'landform-regions'
  if(id.startsWith('region-marine-ne-'))return 'marine-regions'
  if(id.startsWith('region-cn-jiang2023-'))return 'study-regions'
  if(id.startsWith('city-ne-'))return 'cities'
  if(id.startsWith('basin-hybas-'))return 'basins'
  if(id.startsWith('plate-usgs-'))return 'plates'
  if (id.startsWith('country-')) return 'countries'
  if (id.startsWith('province-')) return 'provinces'
  if (id.startsWith('language-area-')) return 'language-areas'
  if (id.startsWith('language-')) return 'languages'
  if (id.startsWith('river-')) return 'rivers'
  if (id.startsWith('lake-')) return 'lakes'
  if (id.startsWith('peak-wikidata-')) return 'summits'
  if (id.startsWith('peak-')) return 'peaks'
  if (id.startsWith('region-')) return 'regions'
  if (id.startsWith('climate-')) return 'climate'
  return undefined
}
