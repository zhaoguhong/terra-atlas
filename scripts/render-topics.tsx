import {renderToString} from 'react-dom/server'
import TopicReader from '../src/components/TopicReader'
import {topics} from '../src/lib/topics'
import type {TopicArticle} from '../src/types'
const noop=()=>{}
export function renderArticle(id:string,article:TopicArticle){
  const topic=topics.find(item=>item.id===id)!
  return renderToString(<TopicReader topic={topic} initialArticle={article} visible saved={false} onProgress={noop} onBack={noop} onLibrary={noop} onMap={noop} onRead={noop} onSave={noop} onShare={noop}/> )
}
