import type {TopicVisual} from '../types'
import './TopicVisuals.css'

const motions=[
  {id:'divergent',title:'分离',arrows:'←　→',result:'地壳拉伸，形成裂谷或洋中脊。',example:'冰岛、东非裂谷'},
  {id:'collision',title:'大陆碰撞',arrows:'→　←',result:'地壳挤压、增厚，形成高大山系。',example:'喜马拉雅'},
  {id:'subduction',title:'俯冲',arrows:'→　↙',result:'一侧板块下沉，常伴海沟、地震与火山。',example:'安第斯、日本'},
  {id:'transform',title:'水平错动',arrows:'↑　↓',result:'两侧沿边界错动，容易发生地震。',example:'圣安德烈亚斯断层'},
]

export default function TopicVisuals({visuals,onPick}:{visuals?:TopicVisual[];onPick:(id:string)=>void}){
  return <>{visuals?.map((visual,index)=><figure className="topic-visual" key={index} aria-label={visual.title}>
    <figcaption>{visual.title}</figcaption>
    {visual.kind==='bars'&&<>
      <p className="visual-unit">单位：{visual.unit} · 从零开始，同一比例</p>
      <div className="topic-bars">{visual.rows.map(row=>{
        const width=100*row.value/Math.max(...visual.rows.map(item=>item.value))
        const contents=<><span className="bar-label">{row.label}</span><span className="bar-track" aria-hidden="true"><i style={{width:width+'%'}}/></span><span className="bar-value">{row.value.toLocaleString('zh-CN',{maximumFractionDigits:2})}</span></>
        return row.place?<button type="button" className="topic-bar" key={row.label} aria-label={`${row.label}，${row.value}${visual.unit}，查看介绍`} onClick={()=>onPick(row.place!)}>{contents}</button>:<div className="topic-bar" key={row.label}>{contents}</div>
      })}</div>
      <p className="visual-note">{visual.note}</p>
      <div className="visual-sources">{visual.sources.map(source=><a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{source.title} ↗</a>)}</div>
    </>}
    {visual.kind==='comparison'&&<><div className="topic-table-scroll" tabIndex={0} role="region" aria-label={visual.title+'对照表'}><table><thead><tr>{visual.columns.map(column=><th scope="col" key={column}>{column}</th>)}</tr></thead><tbody>{visual.rows.map((row,i)=><tr key={i}>{row.map((cell,j)=>j===0?<th key={j} scope="row">{cell}</th>:<td key={j}>{cell}</td>)}</tr>)}</tbody></table></div>{visual.note&&<p className="visual-note">{visual.note}</p>}</>}
    {visual.kind==='plates'&&<><div className="plate-processes">{motions.map(motion=><div className="plate-process" key={motion.id}><strong>{motion.title}</strong><span className={'plate-motion '+motion.id} aria-label={'相对运动：'+motion.title}>{motion.arrows}</span><p>{motion.result}</p><small>{motion.example}</small></div>)}</div><p className="visual-note">{visual.note}</p></>}
  </figure>)}</>
}
