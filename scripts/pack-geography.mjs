import {readdir,readFile,writeFile,unlink} from 'node:fs/promises'
import {gzipSync,gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import assert from 'node:assert/strict'
const root=process.argv[2]||'dist'
const rows=[]
for(const file of await readdir(root+'/data')){
  if(!file.endsWith('.geojson'))continue
  const path=root+'/data/'+file,raw=await readFile(path),packed=gzipSync(raw,{level:9})
  assert.deepEqual(gunzipSync(packed),raw)
  await writeFile(path+'.gz',packed);await unlink(path)
  rows.push({path:'data/'+file+'.gz',encoding:'gzip',bytes:packed.length,decodedBytes:raw.length,sha256:createHash('sha256').update(packed).digest('hex'),decodedSha256:createHash('sha256').update(raw).digest('hex')})
}
await writeFile(root+'/data/packed-geography.json',JSON.stringify({note:'无损 gzip；解压后与源码资料及来源清单的 SHA-256 一致。',files:rows}))
console.log(`Lossless geography: ${rows.reduce((s,r)=>s+r.decodedBytes,0)} → ${rows.reduce((s,r)=>s+r.bytes,0)} bytes`)
