import {useEffect,useState} from 'react'

export const topicLibraryLayouts=[
  {id:'cards',label:'图文卡片'},
  {id:'list',label:'紧凑列表'},
  {id:'directory',label:'分类目录'},
] as const
export type TopicLibraryLayout=typeof topicLibraryLayouts[number]['id']
const storageKey='terra-atlas-topic-layout'
const validLayout=(value:string|null):value is TopicLibraryLayout=>topicLibraryLayouts.some(layout=>layout.id===value)

function readLayout():TopicLibraryLayout {
  try {
    const saved=localStorage.getItem(storageKey)
    return validLayout(saved)?saved:'cards'
  } catch {return 'cards'}
}

/** The catalogue layout is a browser preference, independent of reading history. */
export function useTopicLibraryLayout() {
  const [layout,setLayout]=useState<TopicLibraryLayout>(readLayout)
  useEffect(()=>{
    const update=(event:StorageEvent)=>{if(event.key===storageKey||event.key===null)setLayout(readLayout())}
    window.addEventListener('storage',update)
    return()=>window.removeEventListener('storage',update)
  },[])
  function chooseLayout(next:TopicLibraryLayout){
    setLayout(next)
    try {localStorage.setItem(storageKey,next)} catch {/* This visit remains usable without browser storage. */}
  }
  return [layout,chooseLayout] as const
}
