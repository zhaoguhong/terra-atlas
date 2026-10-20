import { numberText,useLocalJson, type CountryIndicators,type CountryLanguages,type HumanData } from '../lib/learning'

export default function CountryContext({countryId}:{countryId:string}){
  const indicators=useLocalJson<CountryIndicators>('data/learning-country-indicators.json')
  const languages=useLocalJson<CountryLanguages>('data/learning-country-languages.json')
  const human=useLocalJson<HumanData>('data/learning-human.json')
  const stat=indicators.data?.countries.find(c=>c.countryId===countryId)
  const lang=languages.data?.countries.find(c=>c.countryId===countryId)
  const religion=human.data?.religion.countries.find(c=>c.countryId===countryId)
  const error=indicators.error||languages.error||human.error
  return <div className="country-context" data-testid="country-context">
    {stat&&<section className="reading-section"><h3>人口与城镇 · {stat.year}</h3><dl className="facts"><div><dt>总人口</dt><dd>{numberText(stat.population,'人')}</dd></div><div><dt>城镇人口占比</dt><dd>{numberText(stat.urbanPercent,'%')}</dd></div></dl><p className="data-caption">世界银行 WDI。城镇定义因国家而异；人口年度与2020空间人口图不同。</p></section>}
    {religion&&<section className="reading-section religion-profile"><h3>宗教构成 · {religion.period||'原资料未注明时期'}</h3>
      {religion.scope!=='population'&&<p className="scope-note">统计口径：{religion.scope==='affiliated'?'有宗教关联者':religion.scope==='practicing'?'实践者估计':religion.scope==='citizens'?'本国公民':religion.scope==='age-limited'?'限定年龄组':'混合或不明确口径'}，不按全体居民比例与其他国家比较。</p>}
      <div className="share-bars">{human.data!.religion.categories.map(c=>{const value=religion.shares[c.id];return value==null?null:<div key={c.id}><span>{c.name}</span><div><i style={{width:`${Math.min(100,value)}%`,background:c.color}}/></div><strong>{numberText(value,'%')}</strong></div>})}</div>
      <p className="data-caption">未列出的类别为缺失，不能视为0%。多重宗教认同或统计口径可造成比例不能相加。</p>
      <details><summary>原资料与口径说明</summary><p className="source-excerpt">{religion.sourceText}</p>{Array.isArray(religion.notes)?religion.notes.map((n,i)=><p key={i}>{n}</p>):religion.notes&&<p>{religion.notes}</p>}<a href={import.meta.env.BASE_URL+'data/learning-data-sources.json'} target="_blank" rel="noopener noreferrer">历史国家资料的来源与处理 ↗</a></details>
    </section>}
    {lang&&<section className="reading-section"><h3>国家语言概览</h3><div className="tag-list">{lang.languages.map(l=><span key={l.id}>{l.name}</span>)}</div><p className="data-caption">{lang.period}。标签仅列已整理的主要语言；资料所列语言不代表法定地位或所有居民的语言；未列出的语种也可能在此使用。</p><details><summary>查看历史资料说明</summary><p className="source-excerpt">{lang.sourceText}</p><a href={lang.sourceUrl} target="_blank" rel="noopener noreferrer">固定资料快照 ↗</a></details></section>}
    {!stat&&!lang&&!religion&&!error&&<p className="data-caption">正在读取区域统计资料…</p>}
    {error&&<p className="resource-error">{error}<button onClick={()=>{indicators.retry();languages.retry();human.retry()}}>重新读取</button></p>}
  </div>
}
