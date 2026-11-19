/** Production geometry is stored losslessly compressed; development uses source JSON.
 * Some hosts decode .gz automatically, so accept both decoded and gzip responses.
 */
export const packedPath=(path:string)=>import.meta.env.PROD&&path.endsWith('.geojson')?path+'.gz':path
export async function unpackJson(response:Response):Promise<any>{
  const bytes=new Uint8Array(await response.arrayBuffer())
  if(bytes[0]===0x1f&&bytes[1]===0x8b){
    const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
    return new Response(stream).json()
  }
  return JSON.parse(new TextDecoder().decode(bytes))
}
