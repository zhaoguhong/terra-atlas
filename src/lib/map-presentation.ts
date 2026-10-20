import type {ThematicState} from '../types'

export const climateGroups = [
  {id:'A',name:'热带',color:'#1f9c83',note:'全年温暖'},
  {id:'B',name:'干旱',color:'#d6a25a',note:'水分不足'},
  {id:'C',name:'温和',color:'#91b556',note:'冬季较温和'},
  {id:'D',name:'寒冷',color:'#8a85ba',note:'冬季寒冷'},
  {id:'E',name:'极地与高寒',color:'#7f9aa9',note:'暖季仍寒冷'},
] as const

export const languageFamilies = [
  {id:'indo1319',name:'印欧语系',color:'#c18a31'},
  {id:'sino1245',name:'汉藏语系',color:'#5878b5'},
  {id:'atla1278',name:'大西洋—刚果语系',color:'#cb7042'},
  {id:'aust1307',name:'南岛语系',color:'#258b80'},
  {id:'afro1255',name:'亚非语系',color:'#a35e99'},
  {id:'aust1305',name:'南亚语系',color:'#8c69af'},
  {id:'taik1256',name:'壮侗语系',color:'#ca8590'},
  {id:'drav1251',name:'达罗毗荼语系',color:'#79923e'},
  {id:'turk1311',name:'突厥语系',color:'#aa5354'},
  {id:'ural1272',name:'乌拉尔语系',color:'#479fb4'},
] as const
export const otherLanguageColor = '#8c9692'
export const otherLanguageLabel = '其他语系与分类（可筛选）'

// Colours encode a small, named set of categories. Unlisted categories share
// the explicit “other” category instead of silently recycling the palette.
export const majorLanguages = [
  {id:'mand1415',name:'官话（汉语）',color:'#5878b5'},
  {id:'stan1293',name:'英语',color:'#c18a31'},
  {id:'stan1288',name:'西班牙语',color:'#cb7042'},
  {id:'stan1290',name:'法语',color:'#258b80'},
  {id:'port1283',name:'葡萄牙语',color:'#8c69af'},
  {id:'russ1263',name:'俄语',color:'#aa5354'},
  {id:'stan1295',name:'德语',color:'#79923e'},
  {id:'hind1269',name:'印地语',color:'#ca8590'},
  {id:'beng1280',name:'孟加拉语',color:'#479fb4'},
  {id:'nucl1643',name:'日语',color:'#a35e99'},
] as const

export interface LanguageAreaMeta {
  note:string; period:string; sourceId:string;
  languages:{id:string;name:string;nameEn:string;familyId:string;count:number}[];
  families?:{id:string;name:string;nameEn:string;count:number}[];
  [key:string]:unknown;
}

export function familyColor(id:string):string {
  return languageFamilies.find(family=>family.id===id)?.color||otherLanguageColor
}
export function languageColor(id:string):string {
  return majorLanguages.find(language=>language.id===id)?.color||otherLanguageColor
}
export function thematicModes(value:Partial<ThematicState>|undefined) {
  return {
    climateMode:value?.climateMode==='types'?'types' as const:'groups' as const,
    languageMode:value?.languageMode==='points'?'points' as const:value?.languageMode==='families'?'families' as const:'areas' as const,
    languageId:typeof value?.languageId==='string'?value.languageId:'all',
  }
}
