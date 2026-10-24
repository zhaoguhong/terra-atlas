import {useMemo,useRef,useState} from 'react'
import {ArrowLeftRight,X} from 'lucide-react'
import {knowledge,categoryInfo} from '../lib/catalog'
import {climateReference,distanceKm,nearestClimate,numberText,useLocalJson} from '../lib/learning'
import type {ClimatePlace,ClimateSeries,Knowledge} from '../types'
import ClimateChart from './ClimateChart'
import CountryContext from './CountryContext'
import bindings from '../data/feature-bindings.json'

export default function ComparePanel({ids,additionalPlaces,onChange,onClose,onLocate}:{ids:string[];additionalPlaces:Knowledge[];onChange:(ids:string[])=>void;onClose:()=>void;onLocate:(card:Knowledge)=>void}){
  const monthly=useLocalJson<ClimateSeries>('data/learning-climate.json')
  const [queries,setQueries]=useState(['',''])
  const [pickerOpen,setPickerOpen]=useState(false)
  const chooser=useRef<HTMLDetailsElement>(null)
  const options=useMemo(()=>[...new Map([...(monthly.data?.places||[]).map(climateReference),...knowledge,...additionalPlaces].map(card=>[card.id,card])).values()],[monthly.data,additionalPlaces])
  const [a,b]=ids.map(id=>options.find(k=>k.id===id))
  const [ma,mb]=[a,b].map(k=>k?nearestClimate(monthly.data,k.coordinates):null)
  const temperatures=[...(ma?.temperature||[]),...(mb?.temperature||[])],rain=[...(ma?.precipitation||[]),...(mb?.precipitation||[])]
  const scale={lo:Math.floor((Math.min(...temperatures,0)-3)/10)*10,hi:Math.ceil((Math.max(...temperatures,10)+3)/10)*10,maxP:Math.max(100,Math.ceil(Math.max(...rain,0)/100)*100)}
  function annual(place:ClimatePlace){return {temperature:place.temperature.reduce((s,v)=>s+v,0)/12,rain:place.precipitation.reduce((s,v)=>s+v,0),range:Math.max(...place.temperature)-Math.min(...place.temperature)}}
  return <aside className="compare-panel panel" aria-label="两地对比">
    <div className="knowledge-top"><span><ArrowLeftRight size={14}/>两地对比</span><button className="icon-button" aria-label="关闭对比" onClick={onClose}><X size={18}/></button></div>
    <div className="compare-scroll">
      {(!a||!b)&&<p className="data-caption">选择两个地方，对照位置、专属解释和可用月气候。地图可以在两处之间自由切换。</p>}
      <details ref={chooser} className="compare-chooser" open={pickerOpen||!a||!b} onToggle={event=>setPickerOpen(event.currentTarget.open)}><summary>{a&&b?`更换对比地点 · ${a.name} / ${b.name}`:'选择对比地点'}</summary><div className="compare-picker">{[0,1].map(index=><label key={index} className="compare-select">{index?'地点 B':'地点 A'}<input type="search" aria-label={`筛选对比地点 ${index?'B':'A'}`} placeholder="输入名称缩小范围" value={queries[index]} onChange={event=>setQueries(current=>current.map((value,i)=>i===index?event.target.value:value))}/><select aria-label={`对比地点 ${index?'B':'A'}`} value={ids[index]||''} onChange={e=>{const next=[...ids];next[index]=e.target.value;onChange(next);if(next[0]&&next[1]){setPickerOpen(false);requestAnimationFrame(()=>chooser.current?.querySelector('summary')?.focus({preventScroll:true}))}}}><option value="">选择一个地方</option>{options.filter(k=>k.category!=='climate'&&(k.id===ids[index]||!queries[index].trim()||[k.name,k.englishName,...k.aliases].join(' ').toLocaleLowerCase().includes(queries[index].trim().toLocaleLowerCase()))).sort((left,right)=>Number(right.category===([b,a][index]?.category))-Number(left.category===([b,a][index]?.category))).map(k=><option key={k.id} value={k.id}>{k.name}</option>)}</select></label>)}</div></details>
      {(!a||!b)&&<p className="compare-empty" role="status">{a||b?'再选一个地点；同类地点排在前面，方便比较。':'先选两个想了解的地方，可按中文或英文名称筛选。'}</p>}
      {a&&b&&<section className="compare-overview" aria-label="两地差异摘要"><h3>先看关键差异</h3><table><thead><tr><th scope="col">观察项</th><th scope="col">{a.name}</th><th scope="col">{b.name}</th></tr></thead><tbody>
        <tr><th scope="row">定位点纬度</th>{[a,b].map((card,index)=><td key={index}>{Math.abs(card.coordinates[1]).toFixed(1)}°{card.coordinates[1]<0?'S':'N'}</td>)}</tr>
        {a.facts.filter(fact=>b.facts.some(other=>other.label===fact.label&&other.value!==fact.value)).slice(0,4).map(fact=><tr key={fact.label}><th scope="row">{fact.label}</th><td>{fact.value}</td><td>{b.facts.find(other=>other.label===fact.label)!.value}</td></tr>)}
        <tr><th scope="row">月表参考点</th>{[ma,mb].map((place,index)=><td key={index}>{place?.name||(monthly.data?'暂无附近月表':monthly.error?'月表读取失败':'正在读取月表')}</td>)}</tr>
        {(ma||mb)&&<tr><th scope="row">年均温</th>{[ma,mb].map((place,index)=><td key={index}>{place?annual(place).temperature.toFixed(1)+' °C':'—'}</td>)}</tr>}
        {(ma||mb)&&<tr><th scope="row">年降水</th>{[ma,mb].map((place,index)=><td key={index}>{place?numberText(annual(place).rain)+' mm':'—'}</td>)}</tr>}
      </tbody></table><p className="data-caption">气候数值来自定位点150千米内的月表参考点，采用1991–2020长期格网资料；不代表整个国家、山脉或流域。横线表示缺少月表，不是零值。</p></section>}
      {ma&&mb&&<p className="data-caption">两图使用相同的温度与降水刻度，便于比较。</p>}
      <div className="compare-columns">{[a,b].map((card,index)=><section key={index}>
        {card&&<><button className="compare-place" onClick={()=>onLocate(card)}><span style={{color:categoryInfo[card.category].color}}>{categoryInfo[card.category].name}</span><strong>{card.name}</strong><small>{card.coordinates[1].toFixed(1)}°纬度 · 在地图上看</small></button><p>{card.summary}</p>
        {[ma,mb][index]?<><ClimateChart place={[ma,mb][index]!} scale={scale} compact/><p className="data-caption">月表参考点：{[ma,mb][index]!.name}，距地点约 {numberText(distanceKm(card.coordinates,[ma,mb][index]!.coordinates),' km')}。</p></>:monthly.data&&<p className="data-caption">定位点150千米内暂无月气候参考点，可以继续比较位置与已有资料。</p>}
        <details className="compare-details"><summary>位置、基本资料与地区解释</summary><dl className="facts">{card.facts.slice(0,4).map(f=><div key={f.label}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}</dl><p>{card.formation}</p>
        {(card.id.startsWith('country-')||(bindings as Record<string,string[]>)[card.id]?.some(id=>id.startsWith('country-')))&&<CountryContext countryId={card.id.startsWith('country-')?card.id:(bindings as Record<string,string[]>)[card.id].find(id=>id.startsWith('country-'))!}/>}</details></>}
      </section>)}</div>
      {a&&b&&<div className="comparison-insight"><strong>一起观察</strong><p>两处相距约 {numberText(distanceKm(a.coordinates,b.coordinates),' km')}，纬度相差 {Math.abs(a.coordinates[1]-b.coordinates[1]).toFixed(1)}°。结合海陆位置和地形，思考差异来自哪些因素。</p>{ma&&mb&&<p>参考网格年均温约 {annual(ma).temperature.toFixed(1)} / {annual(mb).temperature.toFixed(1)} °C；年降水约 {numberText(annual(ma).rain)} / {numberText(annual(mb).rain)} mm。数值为1991–2020月均资料汇总，比较本身不能证明某个因素的因果作用。</p>}</div>}
      {monthly.error&&<p className="resource-error">{monthly.error}<button onClick={monthly.retry}>重试月表</button></p>}
    </div>
  </aside>
}
