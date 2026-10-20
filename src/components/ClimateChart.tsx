import type { ClimatePlace } from '../types'

export default function ClimateChart({place,compact=false,scale}:{place:ClimatePlace;compact?:boolean;scale?:{lo:number;hi:number;maxP:number}}){
  const {temperature:t,precipitation:p}=place
  if(t.length!==12||p.length!==12||![...t,...p].every(Number.isFinite))return <p>这处月气候资料不完整。</p>
  const w=340,h=190,left=36,right=38,top=20,bottom=30,pw=w-left-right,ph=h-top-bottom
  const lo=scale?.lo??Math.floor((Math.min(...t,0)-3)/10)*10,hi=scale?.hi??Math.ceil((Math.max(...t,10)+3)/10)*10
  const maxP=scale?.maxP??Math.max(100,Math.ceil(Math.max(...p)/100)*100)
  const x=(i:number)=>left+(i+.5)*pw/12
  const y=(v:number)=>top+ph-(v-lo)/(hi-lo)*ph
  const line=t.map((v,i)=>`${i?'L':'M'}${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(' ')
  return <figure className={`climate-chart ${compact?'compact':''}`}>
    <figcaption><strong>{place.name}</strong><span><i className="temperature-key"/>月均温 °C <i className="rain-key"/>月降水 mm</span></figcaption>
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${place.name}十二个月平均气温与降水图`}>
      {[0,1,2,3,4].map(i=>{const yy=top+ph*i/4;return <g key={i}><line x1={left} x2={w-right} y1={yy} y2={yy} stroke="#d9ded3"/><text x={left-6} y={yy+4} textAnchor="end">{Math.round(hi-(hi-lo)*i/4)}</text><text x={w-right+6} y={yy+4}>{Math.round(maxP*(1-i/4))}</text></g>})}
      {p.map((v,i)=><rect key={i} x={x(i)-6} y={top+ph-v/maxP*ph} width={12} height={v/maxP*ph} rx={2} fill="#7caabb"><title>{i+1}月降水 {v.toFixed(1)} 毫米</title></rect>)}
      <path d={line} fill="none" stroke="#b36d4c" strokeWidth={2.5}/>
      {t.map((v,i)=><g key={i}><circle cx={x(i)} cy={y(v)} r={2.5} fill="#b36d4c"><title>{i+1}月气温 {v.toFixed(1)} °C</title></circle><text x={x(i)} y={h-10} textAnchor="middle">{i+1}</text></g>)}
    </svg>
    <p className="data-caption">1991–2020 长期格网平均 · 0.5°取样 · Beck V3</p>
    {!compact&&<details><summary>查看十二个月数据</summary><div className="monthly-table"><table><thead><tr><th>月份</th><th>均温 °C</th><th>降水 mm</th></tr></thead><tbody>{t.map((v,i)=><tr key={i}><td>{i+1}月</td><td>{v.toFixed(1)}</td><td>{p[i].toFixed(1)}</td></tr>)}</tbody></table></div><p className="data-caption">取样网格中心 {place.sampleCoordinates?.[1].toFixed(2)}°，{place.sampleCoordinates?.[0].toFixed(2)}°。资料为长期气候格网估计，不能视为城市气象站观测。</p></details>}
  </figure>
}
