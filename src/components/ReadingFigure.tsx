import {useEffect,useRef,useState} from 'react'
import {Expand,X} from 'lucide-react'
import {mediaById} from '../lib/reading'

export default function ReadingFigure({id,compact=false}:{id:string;compact?:boolean}){
  const item=mediaById.get(id)
  const dialog=useRef<HTMLDialogElement>(null)
  const [failed,setFailed]=useState(false)
  const [enlarged,setEnlarged]=useState(false)
  useEffect(()=>{setFailed(false)},[id])
  if(!item)return null
  const src=import.meta.env.BASE_URL+item.path
  return <figure className={`reading-figure${compact?' compact':''}`}>
    {failed?<div className="reading-image-error"><p>{item.alt}</p><button onClick={()=>setFailed(false)}>重新加载图片</button></div>:<button className="reading-image-button" aria-label={`放大图片：${item.title}`} onClick={()=>{setEnlarged(true);dialog.current?.showModal()}}><img src={src} width={item.width} height={item.height} alt={item.alt} loading="lazy" decoding="async" onError={()=>setFailed(true)}/><span><Expand size={14}/>查看大图</span></button>}
    <figcaption><span>{item.caption}</span><small>{item.author} · <a href={item.licenseUrl} target="_blank" rel="noopener noreferrer">{item.license}</a> · <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">{item.kind==='photo'?'图片来源':'参考资料'}</a></small></figcaption>
    <dialog ref={dialog} className="reading-image-dialog" aria-label={item.title} onClose={()=>setEnlarged(false)} onClick={event=>{if(event.target===dialog.current)dialog.current.close()}}><button className="icon-button" aria-label="关闭大图" onClick={()=>dialog.current?.close()}><X size={20}/></button>{enlarged&&<img src={src} alt={item.alt}/>}<p>{item.caption}</p><small>{item.author} · <a href={item.licenseUrl} target="_blank" rel="noopener noreferrer">{item.license}</a> · <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">来源</a></small></dialog>
  </figure>
}
