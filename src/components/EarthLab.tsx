import {useState} from 'react'
import {daylightHours,scaleDistanceKm,solarTimeOffsetMinutes} from '../lib/earth'
import './EarthLab.css'

export default function EarthLab({topicId}:{topicId:string}){
  const [latitude,setLatitude]=useState(40),[season,setSeason]=useState('june'),[longitude,setLongitude]=useState(120)
  const [scale,setScale]=useState(50000),[distance,setDistance]=useState(4)
  if(topicId==='earth-seasons'){
    const declination=season==='june'?23.44:season==='december'?-23.44:0
    const hours=daylightHours(latitude,declination)
    const offset=solarTimeOffsetMinutes(longitude)
    return <section className="earth-lab" aria-label="昼夜与经度实验">
      <span className="eyebrow">动手观察</span><h2>同一个季节，不同的昼长</h2>
      <p>改变纬度和季节，观察一天中白昼所占的比例。试试南北纬 40°，再到极圈以内看看。</p>
      <label>季节位置<select aria-label="季节位置" value={season} onChange={event=>setSeason(event.target.value)}><option value="march">三月分点</option><option value="june">六月至日</option><option value="september">九月分点</option><option value="december">十二月至日</option></select></label>
      <label htmlFor="lab-latitude">观察纬度 <strong>{latitude===0?'赤道':`${Math.abs(latitude)}°${latitude>0?'N':'S'}`}</strong></label>
      <input id="lab-latitude" aria-label="观察纬度" type="range" min="-80" max="80" step="1" value={latitude} onChange={event=>setLatitude(Number(event.target.value))}/>
      <div className="daylight-bar" role="img" aria-label={`白昼约${hours.toFixed(1)}小时，黑夜约${(24-hours).toFixed(1)}小时`}><span style={{width:`${hours/24*100}%`}}/></div>
      <div className="lab-result" aria-live="polite"><strong>白昼 {hours.toFixed(1)} 小时</strong><span>黑夜 {(24-hours).toFixed(1)} 小时</span></div>
      <p className="data-caption">理想球面示意：太阳赤纬取 0° 或 ±23.44°，不计折射、太阳视半径和地形遮挡。结果用于理解昼长变化，不是当地日出日落预报。</p>
      <h3>经度怎样对应地方时</h3><label htmlFor="lab-longitude">相对本初子午线 <strong>{longitude===0?'0°':`${Math.abs(longitude)}°${longitude>0?'E':'W'}`}</strong></label>
      <input id="lab-longitude" aria-label="经度时差" type="range" min="-180" max="180" step="15" value={longitude} onChange={event=>setLongitude(Number(event.target.value))}/>
      <output data-testid="solar-offset">{offset===0?'地方时相同':`地方时${offset>0?'快':'慢'} ${Math.abs(offset)/60} 小时`}</output>
      <p className="data-caption">按 15° 对应 1 小时计算经度地方时差。民用时区由各地规定，边界并不沿整齐经线；这里不显示各国当前钟表时间。</p>
    </section>
  }
  if(topicId==='earth-map-reading')return <section className="earth-lab" aria-label="比例尺实验">
    <span className="eyebrow">动手观察</span><h2>图上距离和实地距离</h2><p>保持图上距离不变，换一个比例尺；想想哪张图表示的范围更大、细节通常更多。</p>
    <label>纸图比例尺<select aria-label="纸图比例尺" value={scale} onChange={event=>setScale(Number(event.target.value))}>{[10000,50000,100000,1000000].map(value=><option key={value} value={value}>1∶{value.toLocaleString('zh-CN')}</option>)}</select></label>
    <label htmlFor="lab-distance">图上距离 <strong>{distance} 厘米</strong></label><input id="lab-distance" aria-label="图上距离" type="range" min="1" max="10" step="1" value={distance} onChange={event=>setDistance(Number(event.target.value))}/>
    <output data-testid="scale-result">对应实地 {scaleDistanceKm(distance,scale).toLocaleString('zh-CN')} 千米</output>
    <p className="data-caption">这是比例尺换算练习，图上厘米不是当前屏幕上的距离。电子地图会随缩放、投影和屏幕大小变化；在地图上比较距离请用测距工具。</p>
  </section>
  return null
}
