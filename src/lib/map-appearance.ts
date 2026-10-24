import type {Map as GLMap, AllPaintProperties} from 'maplibre-gl'
import type {ResolvedAppearance} from '../types'

// Only the basemap and label contrast change. Thematic data colors stay intact.
const nightPaint:Record<string,Record<string,unknown>>={
  ocean:{'background-color':'#111f2a'},
  'land-fill':{'fill-color':'#283a30'},
  relief:{'raster-brightness-max':.34,'raster-saturation':-.35},
  'country-borders':{'line-color':'#b0bcaa'},
  'province-lines':{'line-color':'#8eae98'},
  'online-detail-landcover':{'fill-color':['match',['get','class'],'wood','#365640','grass','#4c6042','sand','#6b6247','ice','#79918b','#4c5743']},
  'online-detail-urban':{'fill-color':'#5a584b'},
  'online-detail-water':{'fill-color':'#203d4b'},
  'online-detail-roads':{'line-color':['match',['get','class'],['motorway','trunk'],'#c88b55',['primary','secondary'],'#a89068','#829083']},
  'online-terrain-hillshade':{'hillshade-shadow-color':'#0b1712','hillshade-highlight-color':'#738476','hillshade-accent-color':'#3a5041'},
}
for(const id of ['city-labels','grid-labels','province-labels','language-labels','place-labels','relation-member-labels','measurement-label','online-place-labels']){
  nightPaint[id]={'text-color':'#e1e8d7','text-halo-color':'#17251e'}
}
const originals=new WeakMap<GLMap,Map<string,Record<string,unknown>>>()
export function applyMapAppearance(map:GLMap,appearance:ResolvedAppearance){
  let saved=originals.get(map)
  if(!saved){saved=new Map();originals.set(map,saved)}
  for(const [id,paint] of Object.entries(nightPaint)){
    if(!map.getLayer(id))continue
    if(!saved.has(id))saved.set(id,Object.fromEntries(Object.keys(paint).map(key=>[key,id==='ocean'?'#eff4f4':map.getPaintProperty(id,key as keyof AllPaintProperties)??null])))
    for(const [key,value] of Object.entries(appearance==='dark'?paint:saved.get(id)!)){
      map.setPaintProperty(id,`${key}-transition` as keyof AllPaintProperties,{duration:0,delay:0})
      map.setPaintProperty(id,key as keyof AllPaintProperties,value as never)
    }
  }
}
