import {useEffect,useState} from 'react'

export const mobileLayoutQuery='(max-width: 759px), (max-width: 1000px) and (max-height: 540px)'
export const landscapeLayoutQuery='(min-width: 560px) and (max-width: 1000px) and (max-height: 540px) and (orientation: landscape)'

/** Phones keep their touch layout when rotated into a wide, short viewport. */
function useLayoutQuery(query:string){
  const [matches,setMatches]=useState(()=>matchMedia(query).matches)
  useEffect(()=>{
    const media=matchMedia(query)
    const update=()=>setMatches(media.matches)
    update();media.addEventListener('change',update)
    return()=>media.removeEventListener('change',update)
  },[query])
  return matches
}

export function useMobileLayout(){return useLayoutQuery(mobileLayoutQuery)}
export function useLandscapeLayout(){return useLayoutQuery(landscapeLayoutQuery)}
