import { getStore } from '@netlify/blobs';
import { randomUUID } from 'node:crypto';

const allowed = new Set(['pdf','doc','docx','ppt','pptx','xls','xlsx','png','jpg','jpeg','zip']);
const maxBytes = 3 * 1024 * 1024;
const clean = (s) => String(s).normalize('NFKD').replace(/[^a-zA-Z0-9 _-]/g,'').trim().replace(/\s+/g,'_').slice(0,65) || 'contestant';
const safeCell = (value) => {
  let str = String(value ?? '').replace(/\r\n?/g,'\n');
  // Prevent spreadsheet formula execution when CSV is opened in Excel.
  if (/^[\s]*[=+@-]/.test(str)) str = "'" + str;
  return '"' + str.replace(/"/g,'""') + '"';
};
const headings = ['id','time_utc','full_name','phone','project_title','idea','project_link','file_key'];
const row = (entry) => headings.map(k => safeCell(entry[k])).join(',');
const headers = {'content-type':'application/json; charset=utf-8', 'cache-control':'no-store'};
const reply = (value, status=200) => new Response(JSON.stringify(value), {status, headers});

export default async (request) => {
  if (request.method !== 'POST') return reply({error:'Method not allowed'},405);
  try {
    const form = await request.formData();
    if (form.get('bot-field')) return reply({ok:true,id:randomUUID()});
    const full_name = String(form.get('full-name')||'').trim();
    const phone = String(form.get('phone')||'').trim();
    const project_title = String(form.get('project-title')||'').trim();
    const idea = String(form.get('description')||'').trim();
    const project_link = String(form.get('project-link')||'').trim();
    if (!full_name || full_name.length>150 || phone.length>200 || !project_title || project_title.length>120 || idea.length>2000 || form.get('consent')!=='yes') {
      return reply({error:'Please enter your name, idea title and answer, and agree to the privacy notice.'},400);
    }
    if (project_link.length>2000) return reply({error:'The link is too long.'},400);
    const file = form.get('project-file');
    let file_key = '';
    const id = randomUUID();
    const store = getStore('contest-private');
    if (file && typeof file.arrayBuffer==='function' && file.size>0) {
      const ext = String(file.name).split('.').pop().toLowerCase();
      if (!allowed.has(ext) || file.size > maxBytes) return reply({error:'File type not allowed or file larger than 3 MB.'},400);
      // Each entry has its own path even when two contestants share a name.
      file_key = `uploads/${clean(full_name)}/${id}/${clean(file.name.replace(/\.[^.]+$/, ''))}.${ext}`;
      await store.set(file_key, await file.arrayBuffer(), { metadata:{filename:file.name,type:file.type||'application/octet-stream'} });
    }
    const entry = { id, time_utc:new Date().toISOString(), full_name, phone, project_title, idea, project_link, file_key };
    await store.setJSON(`entries/${id}.json`, entry);
    // Convenience CSV snapshot. Admin export below always rebuilds the complete CSV
    // from individual entries, avoiding lost rows during concurrent uploads.
    try {
      const listing = await store.list({prefix:'entries/'});
      const values = await Promise.all(listing.blobs.map(x=>store.get(x.key,{type:'json'})));
      const csv = [headings.join(','),...values.filter(Boolean).sort((a,b)=>a.time_utc.localeCompare(b.time_utc)).map(row)].join('\r\n')+'\r\n';
      await store.set('exports/entries.csv',csv);
    } catch (e) { console.error('CSV snapshot failed; entries remain in persistent storage',e); }
    return reply({ok:true,id});
  } catch(e) {
    console.error(e);
    return reply({error:'Unable to record the entry. Please try again.'},500);
  }
};
