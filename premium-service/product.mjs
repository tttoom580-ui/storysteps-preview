import books from './product-books.mjs';

const events=new Set(['visit','book_impression','book_open','chapter_start','chapter_end','chapter_complete','quiz_complete','next_chapter','pass_view','offer_click','trial_survey','trial_view']);
const uuid=value=>typeof value==='string'&&/^[a-f0-9-]{36}$/i.test(value);
const q=(env,sql,...params)=>env.DB.prepare(sql).bind(...params);
export async function isProductAdmin(env,account){
 return Boolean(account&&await q(env,'SELECT account FROM product_admins WHERE account=?',account).first());
}
export async function productRequest(env,action,data,session){
 const since=Date.now()-30*86400000;
 if(action==='stats'||action==='admin'){
  if(action==='admin'&&!await isProductAdmin(env,session?.account))return [{error:'此頁僅供網站管理者使用。'},403];
  const {results}=await q(env,`SELECT book,kind,count(*) AS events,count(DISTINCT client) AS readers
   FROM product_events WHERE created>=? GROUP BY book,kind`,since).all();
  if(action==='stats')return [{days:30,rows:results.filter(r=>['book_open','chapter_start','chapter_complete'].includes(r.kind))},200];
  const feedback=await q(env,'SELECT book,chapter,kind,message,created FROM product_feedback ORDER BY created DESC LIMIT 100').all();
  const experiments=await q(env,`SELECT variant,kind,count(DISTINCT client) AS readers FROM product_events
   WHERE created>=? AND variant<>'' GROUP BY variant,kind`,since).all();
  const sources=await q(env,'SELECT source,kind,count(DISTINCT client) AS readers FROM product_events WHERE created>=? GROUP BY source,kind',since).all();
  const paid=await q(env,'SELECT count(*) AS orders FROM premium_orders WHERE paid_at>=? AND revoked_at IS NULL',since).first();
  // Count the same browser only after it actually opened the same first chapter.
  // A completion without an earlier start in the reporting window is excluded.
  const firstChapters=await q(env,`SELECT s.book,
   count(DISTINCT s.client) AS started,
   count(DISTINCT CASE WHEN EXISTS (
    SELECT 1 FROM product_events c WHERE c.client=s.client AND c.book=s.book
     AND c.chapter=s.book||'-1' AND c.kind='chapter_complete'
     AND c.created>=s.created AND c.created>=?
   ) THEN s.client END) AS completed,
   count(DISTINCT CASE WHEN EXISTS (
    SELECT 1 FROM product_events n WHERE n.client=s.client AND n.book=s.book
     AND n.chapter=s.book||'-2' AND n.kind='chapter_start'
     AND n.created>=s.created AND n.created>=?
   ) THEN s.client END) AS continued
   FROM product_events s WHERE s.kind='chapter_start' AND s.chapter=s.book||'-1'
    AND s.created>=? GROUP BY s.book`,since,since,since).all();
  const audience=await q(env,`SELECT count(DISTINCT client) AS browsers,
   count(DISTINCT CASE WHEN kind='visit' THEN client END) AS visits,
   count(DISTINCT CASE WHEN kind='visit' AND EXISTS (
    SELECT 1 FROM product_events v WHERE v.client=product_events.client AND v.kind='visit'
     AND v.created>=? AND date(v.created/1000,'unixepoch','+8 hours')
       <> date(product_events.created/1000,'unixepoch','+8 hours')
   ) THEN client END) AS returningBrowsers
   FROM product_events WHERE created>=?`,since,since).first();
  return [{days:30,windowStart:since,windowEnd:Date.now(),rows:results,
   firstChapters:firstChapters.results,audience,feedback:feedback.results,
   experiments:experiments.results,sources:sources.results,paidOrders:paid.orders},200];
 }
 if(!data||!uuid(data.id)||!uuid(data.client))return [{error:'資料格式不符。'},400];
 const book=data.book||'',chapter=data.chapter||'';
 if((book&&!books[book])||(chapter&&(!book||!books[book].includes(chapter))))return [{error:'找不到書籍或章節。'},400];
 const now=Date.now(),day=now-86400000;
 if(action==='event'){
  if(!events.has(data.kind)||!['','curiosity','progress'].includes(data.variant||'')||!['direct','instagram','threads','facebook','youtube'].includes(data.source||'direct'))return [{error:'事件格式不符。'},400];
  const result=await q(env,`INSERT OR IGNORE INTO product_events SELECT ?,?,?,?,?,?,?,?
   WHERE (SELECT count(*) FROM product_events WHERE client=? AND created>=?)<250`,
   data.id,data.client,data.kind,book,chapter,data.variant||'',data.source||'direct',now,data.client,day).run();
  return [{ok:result.meta.changes>0},result.meta.changes?200:429];
 }
 if(action==='feedback'){
  if(!['使用體驗','查詞','內容勘誤','登入同步','想看的題材','功能建議','試讀感受'].includes(data.kind)||
    typeof data.message!=='string'||data.message.trim().length<3||data.message.length>1000)return [{error:'請填寫 3～1000 字的回饋。'},400];
  const r=await q(env,`INSERT OR IGNORE INTO product_feedback SELECT ?,?,?,?,?,?,?
   WHERE (SELECT count(*) FROM product_feedback WHERE client=? AND created>=?)<10`,data.id,data.client,book,chapter,data.kind,data.message.trim(),now,data.client,day).run();
  return [{ok:r.meta.changes>0},r.meta.changes?200:429];
 }
 return [{error:'找不到功能。'},404];
}
