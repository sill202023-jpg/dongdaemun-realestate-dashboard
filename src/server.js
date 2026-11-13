const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, max-age=300'}});
const memory=new Map();
export function parseItems(xml){
 const decode=s=>s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');
 return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m=>Object.fromEntries([...m[1].matchAll(/<([\w]+)>([\s\S]*?)<\/\1>/g)].map(x=>[x[1],decode(x[2]).trim()])));
}
export function normalize(r,type){
 const n=v=>Number(String(v||0).replace(/,/g,''));
 return {name:r.aptNm,dong:r.umdNm?.trim(),area:n(r.excluUseAr),floor:n(r.floor),date:`${r.dealYear}-${String(r.dealMonth).padStart(2,'0')}-${String(r.dealDay).padStart(2,'0')}`,price:n(type==='sale'?r.dealAmount:r.deposit),rent:n(r.monthlyRent),type:type==='sale'?'sale':n(r.monthlyRent)>0?'rent':'lease',address:`서울 동대문구 ${r.umdNm||''} ${r.jibun||''}`.trim(),cancelled:r.cdealType==='O'||!!r.cdealDay,buildYear:n(r.buildYear)};
}
async function cached(key,fn){const old=memory.get(key);if(old&&Date.now()-old.time<900000)return old.value;const value=await fn();if(memory.size>120)memory.clear();memory.set(key,{value,time:Date.now()});return value;}
async function monthly(month,type,key){return cached(`${month}:${type}`,async()=>{
 const service=type==='sale'?'RTMSDataSvcAptTradeDev':'RTMSDataSvcAptRent';const operation=type==='sale'?'getRTMSDataSvcAptTradeDev':'getRTMSDataSvcAptRent';let items=[];
 for(let page=1;page<=20;page++){
 const u=new URL(`https://apis.data.go.kr/1613000/${service}/${operation}`);u.search=new URLSearchParams({serviceKey:key,LAWD_CD:'11230',DEAL_YMD:month,pageNo:String(page),numOfRows:'1000'});
 const res=await fetch(u,{signal:AbortSignal.timeout(18000)});if(!res.ok)throw new Error('공공데이터포털 응답 오류');const xml=await res.text();const code=xml.match(/<resultCode>(.*?)<\/resultCode>/)?.[1];if(code!=='000'&&code!=='00')throw new Error('API 인증 또는 활용신청 상태 확인 필요');
 const rows=parseItems(xml);items.push(...rows.map(r=>normalize(r,type)).filter(r=>r.name&&!r.cancelled));const total=Number(xml.match(/<totalCount>(.*?)<\/totalCount>/)?.[1]||rows.length);if(page*1000>=total) return items;
 }throw new Error('응답 건수가 조회 한도를 초과했습니다');
 });}
export async function fetchHandler(request,env,ctx){
 const u=new URL(request.url);
 if(u.pathname==='/api/places')return json(typeof PLACES!=='undefined'?PLACES:(env.OSM_PLACES||{source:'snapshot unavailable',places:[]}));
 if(u.pathname==='/api/transactions'){
 const start=u.searchParams.get('start'),end=u.searchParams.get('end'),type=u.searchParams.get('type')||'sale';
 if(!/^\d{4}-\d{2}-\d{2}$/.test(start||'')||!/^\d{4}-\d{2}-\d{2}$/.test(end||'')||!['sale','lease','rent'].includes(type)||start>end)return json({error:'날짜와 거래 유형을 확인해주세요.'},400);
 const a=new Date(start+'T00:00:00Z'),b=new Date(end+'T00:00:00Z');if(!Number.isFinite(+a)||!Number.isFinite(+b)||b-a>366*86400000)return json({error:'조회 기간은 최대 1년입니다.'},400);
 if(!env.MOLIT_API_KEY)return json({error:'실거래 API 키가 서버에 설정되지 않았습니다.',source:'unavailable'},503);
 try{let months=[];const d=new Date(Date.UTC(a.getUTCFullYear(),a.getUTCMonth(),1));while(d<=b){months.push(`${d.getUTCFullYear()}${String(d.getUTCMonth()+1).padStart(2,'0')}`);d.setUTCMonth(d.getUTCMonth()+1);}let rows=[];for(let i=0;i<months.length;i+=3){const part=await Promise.all(months.slice(i,i+3).map(m=>monthly(m,type==='sale'?'sale':'rental',env.MOLIT_API_KEY)));rows.push(...part.flat());}return json({source:'국토교통부 실거래가 공개자료',fetchedAt:new Date().toISOString(),rows:rows.filter(r=>r.date>=start&&r.date<=end&&r.type===type),start,end});}catch{return json({error:'공공데이터 조회 실패: 활용신청 승인·인증키·제공기관 상태를 확인해주세요.',source:'unavailable'},502);}
 }
 if(u.pathname==='/api/reb'){
 if(!env.REB_API_KEY)return json({error:'한국부동산원 서버 키 미설정'},503);
 try{const action=u.searchParams.get('action')||'tables';const allowed={tables:'SttsApiTbl',items:'SttsApiTblItm',data:'SttsApiTblData'};if(!allowed[action])return json({error:'잘못된 요청'},400);const params={KEY:env.REB_API_KEY,Type:'json',pIndex:'1',pSize:'1000'};
 for(const k of ['STATBL_ID','DTACYCLE_CD','CLS_ID','ITM_ID','START_WRTTIME','END_WRTTIME']){const v=u.searchParams.get(k);if(v&&/^[\w-]{1,40}$/.test(v))params[k]=v;}
 if(action!=='tables'&&!params.STATBL_ID)return json({error:'통계표를 선택해주세요.'},400);
 const result=await cached('reb:'+JSON.stringify({...params,KEY:undefined}),async()=>{const res=await fetch('https://www.reb.or.kr/r-one/openapi/'+allowed[action]+'.do?'+new URLSearchParams(params),{signal:AbortSignal.timeout(18000)});if(!res.ok)throw Error();return res.json();});return json(result);
 }catch{return json({error:'한국부동산원 응답을 확인할 수 없습니다.'},502);}
 }
 if(u.pathname.startsWith('/api/'))return json({error:'Not found'},404);
 const asset=typeof ASSETS!=='undefined'?ASSETS[u.pathname]:undefined;return asset?new Response(asset.body,{headers:{'Content-Type':asset.type,'X-Content-Type-Options':'nosniff'}}):new Response('Not found',{status:404});
}
export async function publicFetch(request,env,ctx){
 const isApi=new URL(request.url).pathname.startsWith('/api/');
 const origin=request.headers.get('Origin');
 const pagesOrigin='https://sill202023-jpg.github.io';
 const cors=origin===pagesOrigin?{'Access-Control-Allow-Origin':pagesOrigin,'Access-Control-Allow-Methods':'GET, OPTIONS','Vary':'Origin'}:{'Vary':'Origin'};
 if(isApi&&request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(isApi&&request.method!=='GET')return json({error:'읽기 전용 API입니다.'},405);
 const response=await fetchHandler(request,env,ctx);
 if(!isApi)return response;
 const headers=new Headers(response.headers);
 for(const [key,value]of Object.entries(cors))headers.set(key,value);
 headers.set('X-Content-Type-Options','nosniff');
 return new Response(response.body,{status:response.status,headers});
}
export default {fetch:publicFetch};
