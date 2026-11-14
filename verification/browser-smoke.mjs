// StorySteps browser smoke: desktop + emulated mobile. No real user data or ad requests.
import {chromium, devices} from 'playwright';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {resolve} from 'node:path';

const child=spawn(process.execPath,[resolve('node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port','4173','--strictPort'],{stdio:'ignore'});
const base='http://127.0.0.1:4173/';
const remote='https://storysteps-sync.tttoom580-storysteps.workers.dev';
const fakeKey='ss1_'+'A'.repeat(43);
const fake={snapshot:{version:1,records:{}},revision:0};
let browser;
async function ready(){for(let i=0;i<60;i++){if(child.exitCode!==null)throw Error('Preview server exited early');try{if((await fetch(base,{signal:AbortSignal.timeout(1500)})).ok)return}catch{}await delay(200)}throw Error('Preview server not ready')}
async function run(label,options){
 const context=await browser.newContext(options);
 const page=await context.newPage();page.setDefaultTimeout(9000);page.setDefaultNavigationTimeout(18000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route(remote+'/**',async route=>{
  const req=route.request(),url=new URL(req.url());
  const headers={'access-control-allow-origin':'*','access-control-allow-headers':'authorization,content-type','access-control-allow-methods':'GET,POST,PUT,DELETE,OPTIONS','content-type':'application/json'};
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers,body:''});
  if(url.pathname==='/api/register'&&req.method()==='POST')return route.fulfill({status:201,headers,body:JSON.stringify({key:fakeKey,revision:0})});
  if(url.pathname==='/api/snapshot'&&req.headers()['authorization']!=='Bearer '+fakeKey)return route.fulfill({status:401,headers,body:JSON.stringify({error:'invalid key'})});
  if(url.pathname==='/api/snapshot'&&req.method()==='GET')return route.fulfill({status:200,headers,body:JSON.stringify(fake)});
  if(url.pathname==='/api/snapshot'&&req.method()==='PUT'){
   const body=req.postDataJSON();
   if(body.revision!==fake.revision)return route.fulfill({status:409,headers,body:JSON.stringify({conflict:true,error:'revision conflict'})});
   fake.snapshot=body.snapshot;fake.revision++;
   return route.fulfill({status:200,headers,body:JSON.stringify({saved:true,revision:fake.revision})});
  }
  if(url.pathname==='/api/account'&&req.method()==='DELETE')return route.fulfill({status:200,headers,body:'{"deleted":true}'});
  return route.fulfill({status:404,headers,body:'{}'});
 });
 try{
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.locator('.header').waitFor();
  const nav=label==='mobile'?page.locator('.mobile-nav').getByRole('button',{name:'閱讀',exact:true}):page.locator('.desktop-nav').getByRole('button',{name:'閱讀中心'});
  await nav.click();
  await page.getByRole('heading',{name:/跨裝置同步/}).first().waitFor();
  if(label==='desktop'){
   await page.getByRole('button',{name:'建立我的同步空間'}).first().click();
   await page.getByRole('button',{name:'立即合併同步'}).first().waitFor();
   await page.evaluate(()=>{localStorage.setItem('storysteps-reading-days-v1',JSON.stringify(['2026-11-13']));window.dispatchEvent(new Event('storysteps-days-changed'))});
   await page.getByRole('button',{name:'立即合併同步'}).first().click();
   await page.getByText('已與雲端合併同步',{exact:false}).first().waitFor();
   if(!fake.snapshot.records['storysteps-reading-days-v1']?.includes('2026-11-13'))throw Error('Desktop snapshot did not sync');
  }else{
   await page.getByPlaceholder(/ss1_/).fill(fakeKey);
   await page.getByRole('button',{name:'連接並合併紀錄'}).click();
   await page.getByText('已與雲端合併同步',{exact:false}).first().waitFor();
   const days=await page.evaluate(()=>JSON.parse(localStorage.getItem('storysteps-reading-days-v1')||'[]'));
   if(!days.includes('2026-11-13'))throw Error('Mobile failed to restore the desktop progress');
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+3);
   if(overflow)throw Error('Mobile horizontal page overflow');
  }
  const toggle=page.getByRole('button',{name:/切換黑暗模式|切換淺色模式/}).first();
  const before=await toggle.getAttribute('aria-pressed');await toggle.click();if((await toggle.getAttribute('aria-pressed'))===before)throw Error('Theme did not change');
  await toggle.click();
  // Test stage 3 review UI with disposable, synthetic wrong-answer data.
  await page.evaluate(()=>{
    localStorage.setItem('storysteps-review-mistakes-v1',JSON.stringify([{id:'tomorrow-1:0',chapter:'tomorrow-1',index:0,question:'Stage 3 test: which option is correct?',options:['A','B','C'],answer:1,explanation:'Synthetic test explanation',stage:0,due:0,attempts:1,updated:Date.now()}]));
    window.dispatchEvent(new Event('storysteps-mistakes-changed'));
  });
  const review=page.getByRole('region',{name:'章末錯題複習'});
  await review.getByRole('heading',{name:'章末錯題複習'}).waitFor();
  await review.getByRole('button',{name:'B. B'}).click();
  await review.getByText('Synthetic test explanation').waitFor();
  await review.getByRole('button',{name:'下一題／完成本輪'}).click();
  await review.getByText('目前沒有到期錯題',{exact:false}).waitFor();
  const libraryNav=label==='mobile'?page.locator('.mobile-nav').getByRole('button',{name:'書庫'}):page.locator('.desktop-nav').getByRole('button',{name:'分級書城'});
  await libraryNav.click();
  await page.getByRole('heading',{name:'三分鐘試讀'}).waitFor();
  await page.getByRole('combobox',{name:'內容校訂狀態'}).selectOption({label:'仍需校訂'});
  await page.getByRole('combobox',{name:'內容校訂狀態'}).selectOption({label:'全部校訂狀態'});
  // Read a real compressed story chapter, expand translation and verify reader viewport.
  await page.goto(base+'?book=tomorrow&chapter=tomorrow-1',{waitUntil:'domcontentloaded'});
  await page.locator('[data-paragraph]').first().waitFor({timeout:20000});
  await page.locator('.paragraph-tools > summary').first().click();
  await page.locator('.paragraph-translate').first().click();
  await page.locator('[data-paragraph] .translation').first().waitFor();
  if(label==='mobile'){
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+3);
   if(overflow)throw Error('Mobile reader overflows screen horizontally');
  }
  // The curated free tier is complete: the last chapter requires no local grant.
  await page.goto(base+'?purchase=1',{waitUntil:'domcontentloaded'});
  await page.getByRole('heading',{name:/10 本完整免費/}).first().waitFor();
  const purchaseButton=page.getByRole('button',{name:'付款尚未開通'});
  if(!(await purchaseButton.isDisabled()))throw Error('Unconfigured checkout must never accept money');
  await page.goto(base+'?book=tomorrow&chapter=tomorrow-25',{waitUntil:'domcontentloaded'});
  await page.locator('[data-paragraph]').first().waitFor({timeout:20000});
  // Rewarded ads are disabled. Other books retain their old free access until
  // payment is actually verified by the server and premium manuscripts private.
  const adRequests=[];
  page.on('request',request=>{if(/googlesyndication|doubleclick|googletag/.test(request.url()))adRequests.push(request.url())});
  await page.goto(base+'?book=import-rain-bell&chapter=import-rain-bell-6',{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:/免廣告免費解鎖 4 章/}).first().waitFor({timeout:20000});
  await page.getByRole('button',{name:/免廣告免費解鎖 4 章/}).first().click();
  await page.locator('[data-paragraph]').first().waitFor({timeout:20000});
  const grants=await page.evaluate(()=>JSON.parse(localStorage.getItem('storysteps-free-access-v1')||'[]').filter(x=>x.story==='import-rain-bell'&&x.start===6));
  if(grants.length!==1||grants[0].source!=='launch-gift')throw Error('No-ad unlock was not saved exactly once');
  await page.goto(base+'?book=import-rain-bell&chapter=import-rain-bell-7',{waitUntil:'domcontentloaded'});
  await page.locator('[data-paragraph]').first().waitFor({timeout:20000});
  if(adRequests.length)throw Error('Google ad scripts unexpectedly requested without consent: '+adRequests.join(','));
  // Stage 2 editorial transparency: every book is shown, none falsely certified.
  await page.goto(base+'editorial-progress.html',{waitUntil:'domcontentloaded'});
  const editorialRows=page.locator('#books tbody tr');
  if(await editorialRows.count()!==88)throw Error('Editorial tracker must list all 88 published books');
  await page.locator('#search').fill('萬味渡口');
  if(await editorialRows.filter({visible:true}).count()!==1)throw Error('Editorial filter did not isolate one book');
  const auditContent=await editorialRows.filter({visible:true}).first().innerText();
  if(!auditContent.includes('逐段英中、情節、角色與答案審閱未完成'))throw Error('Editorial review is incorrectly marked complete');
  // New batch: open a genuinely imported first chapter, not merely catalog metadata.
  await page.goto(base+'?book=ss-r11-l1-a&chapter=ss-r11-l1-a-1',{waitUntil:'domcontentloaded'});
  await page.locator('[data-paragraph]').first().waitFor({timeout:20000});
  const newBookHeading=await page.locator('body').innerText();
  if(!newBookHeading.includes('雨後的綠色箱子'))throw Error('Newly imported story not readable');
  if(errors.length)throw Error(label+' JS errors: '+errors.join('; '));
  console.log(JSON.stringify({device:label,ok:true,sync:true,theme:true}));
 }finally{await context.close()}
}
let failed=false;
try{
 await ready();browser=await chromium.launch({headless:true});
 await run('desktop',{viewport:{width:1365,height:900}});
 await run('mobile',{...devices['iPhone 13'],isMobile:true,hasTouch:true});
}catch(error){failed=true;console.error(error)}
finally{if(browser)await browser.close();child.kill('SIGTERM');await Promise.race([new Promise(resolve=>child.once('exit',resolve)),delay(1200)]);if(child.exitCode===null)child.kill('SIGKILL')}
if(failed)process.exitCode=1;
