import { getStore } from '@netlify/blobs';
import { timingSafeEqual } from 'node:crypto';
import JSZip from 'jszip';

const denied = () => new Response('Access denied', {status:403,headers:{'cache-control':'no-store'}});
const authorized = (secret, supplied) => {
  if (!secret || !supplied) return false;
  const a=Buffer.from(secret); const b=Buffer.from(supplied);
  return a.length===b.length && timingSafeEqual(a,b);
};
const csvColumns=['id','time_utc','full_name','phone','project_title','idea','project_link','file_key'];
function csvValue(value){let text=String(value??'').replace(/\r\n?/g,'\n');if(/^\s*[=+@-]/.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"'}
async function listAll(store,prefix){const items=[];let cursor;do{const page=await store.list({...{prefix},...(cursor?{cursor}:{})});items.push(...page.blobs);cursor=page.cursor;}while(cursor);return items}
function safeSegment(value){return String(value??'contestant').normalize('NFKD').replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,65)||'contestant'}

export default async function handler(request){
 if(request.method!=='GET')return new Response('Method not allowed',{status:405});
 if(!authorized(process.env.CONTEST_ADMIN_KEY,request.headers.get('x-contest-key')))return denied();
 try{
  const store=getStore('contest-private');
  const blobs=await listAll(store,'entries/');
  const records=(await Promise.all(blobs.map(x=>store.get(x.key,{type:'json'})))).filter(Boolean).sort((a,b)=>String(a.time_utc||'').localeCompare(String(b.time_utc||'')));
  const csv='\ufeff'+[csvColumns.join(','),...records.map(record=>csvColumns.map(k=>csvValue(record[k])).join(','))].join('\r\n')+'\r\n';
  const zip=new JSZip();zip.file('contest_entries.csv',csv);
  const missing=[];let total=0;const limit=40*1024*1024;
  for(const r of records){if(!r.file_key)continue;
   const key=String(r.file_key);
   if(!key.startsWith('uploads/')||key.split('/').some(part=>part==='..'||part==='')){missing.push(key);continue}
   const object=await store.getWithMetadata(key,{type:'arrayBuffer'});
   if(!object){missing.push(key);continue}
   total+=object.data.byteLength;
   if(total>limit)return new Response('Attachments exceed the 40 MB ZIP download limit. Download smaller batches or use Netlify CLI.',{status:413,headers:{'cache-control':'no-store'}});
   const original=String(object.metadata?.filename||key.split('/').pop());
   const filename=safeSegment(original.replace(/\.[^.]+$/,''))+(original.match(/\.[a-zA-Z0-9]{1,8}$/)?.[0]||'');
   const folder=safeSegment(r.full_name)+'_'+safeSegment(r.id);
   zip.file('uploads/'+folder+'/'+filename,object.data);
  }
  if(missing.length)zip.file('missing_attachments.txt',missing.join('\n'));
  const buffer=await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:4}});
  return new Response(buffer,{headers:{'content-type':'application/zip','content-disposition':'attachment; filename="contest_all_files.zip"','cache-control':'no-store'}});
 }catch(error){console.error('ZIP download failed',error);return new Response('Unable to prepare ZIP. Check function logs.',{status:500,headers:{'cache-control':'no-store'}})}
}
