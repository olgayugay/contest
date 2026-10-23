import { getStore } from '@netlify/blobs';
import { timingSafeEqual } from 'node:crypto';

const headings = ['id','time_utc','full_name','phone','project_title','idea','project_link','file_key'];
const safeCell = value => {
  let str = String(value ?? '').replace(/\r\n?/g,'\n');
  if (/^[\s]*[=+@-]/.test(str)) str = "'" + str;
  return '"' + str.replace(/"/g,'""') + '"';
};
const equal = (a,b) => {const x=Buffer.from(a);const y=Buffer.from(b);return x.length===y.length && timingSafeEqual(x,y)};
const deny = () => new Response('Access denied',{status:403,headers:{'cache-control':'no-store'}});
export default async (request) => {
  const secret=process.env.CONTEST_ADMIN_KEY;
  const given=request.headers.get('x-contest-key')||'';
  if (!secret || !equal(secret,given)) return deny();
  const store=getStore('contest-private');
  const url=new URL(request.url);
  if(url.searchParams.get('file')) {
    const key=url.searchParams.get('file');
    if(!key.startsWith('uploads/')) return deny();
    const entry=await store.getWithMetadata(key,{type:'arrayBuffer'});
    if(!entry) return new Response('Not found',{status:404});
    const filename=String(entry.metadata?.filename||'attachment').replace(/["\r\n]/g,'_');
    return new Response(entry.data,{headers:{'content-type':'application/octet-stream','content-disposition':`attachment; filename="${filename}"`,'cache-control':'no-store'}});
  }
  const listing=await store.list({prefix:'entries/'});
  const entries=(await Promise.all(listing.blobs.map(x=>store.get(x.key,{type:'json'})))).filter(Boolean);
  entries.sort((a,b)=>a.time_utc.localeCompare(b.time_utc));
  const csv=[headings.join(','),...entries.map(e=>headings.map(k=>safeCell(e[k])).join(','))].join('\r\n')+'\r\n';
  return new Response('\ufeff'+csv,{headers:{'content-type':'text/csv; charset=utf-8','content-disposition':'attachment; filename="contest_entries.csv"','cache-control':'no-store'}});
};
