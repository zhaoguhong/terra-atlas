import {useLayoutEffect,useState} from 'react'
import type {Appearance,ResolvedAppearance} from '../types'

export function useAppearance(initial:Appearance){
  const [appearance,setAppearance]=useState(initial)
  const [systemDark,setSystemDark]=useState(()=>matchMedia('(prefers-color-scheme: dark)').matches)
  useLayoutEffect(()=>{
    const media=matchMedia('(prefers-color-scheme: dark)')
    const update=()=>setSystemDark(media.matches)
    update();media.addEventListener('change',update)
    return()=>media.removeEventListener('change',update)
  },[])
  const resolved:ResolvedAppearance=appearance==='system'?(systemDark?'dark':'light'):appearance
  useLayoutEffect(()=>{
    document.documentElement.dataset.theme=resolved
    document.documentElement.style.colorScheme=resolved
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content',resolved==='dark'?'#111a17':'#f7f6ef')
  },[resolved])
  return [appearance,setAppearance,resolved] as const
}
