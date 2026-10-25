import { getStore } from '@netlify/blobs';

async function listEntries(store) {
  const records = [];
  let cursor;
  do {
    const page = await store.list({ prefix: 'entries/', ...(cursor ? { cursor } : {}) });
    records.push(...page.blobs);
    cursor = page.cursor;
  } while (cursor);
  return records;
}

export default async function handler(request) {
  if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });
  try {
    const store = getStore('contest-private');
    const objects = await listEntries(store);
    const entries = await Promise.all(objects.map(({ key }) => store.get(key, { type: 'json' })));
    const names = entries
      .filter(e => e && typeof e.full_name === 'string')
      .map(e => e.full_name.trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
    return new Response(JSON.stringify({ names, count: names.length }), {
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }
    });
  } catch (error) {
    console.error('Cannot load participant names', error);
    return new Response(JSON.stringify({ error: 'Participant list is currently unavailable.' }), {
      status: 500,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
    });
  }
}
