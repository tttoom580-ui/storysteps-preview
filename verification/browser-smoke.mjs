// StorySteps browser smoke: desktop + emulated mobile. No real user data or ad requests.
import {chromium, devices} from 'playwright';
import {spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
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
  const passLink=page.locator('.header').getByRole('button',{name:'免費閱讀與通行證',exact:true});
  await passLink.click();
  await page.getByRole('heading',{name:'免費閱讀與通行證',exact:true}).waitFor();
  await page.locator('footer').getByRole('button',{name:'網站與隱私',exact:true}).click();
  await page.getByRole('heading',{name:'閱讀紀錄，怎麼保存？'}).waitFor();
  await page.getByRole('button',{name:'關閉視窗'}).click();
  await page.locator('.header').getByRole('button',{name:'拾頁 StorySteps'}).click();
  const trialShelf=page.getByRole('region',{name:'免費試讀 10 章',exact:true});
  const trialButtons=trialShelf.getByRole('button',{name:/試讀《/});
  if(await trialButtons.count()!==6)throw Error('Homepage must show six trial picks initially');
  await trialShelf.getByRole('button',{name:/展開全部/}).click();
  if(await trialButtons.count()<=6)throw Error('Homepage should expand to show the full trial shelf');
  await trialShelf.getByRole('button',{name:'收起其他試讀書'}).click();
  const freeHome=page.getByRole('region',{name:/12 本小說/});
  await freeHome.waitFor();
  if(await freeHome.getByRole('button',{name:/免費讀《/}).count()!==12)throw Error('Homepage must show all 12 complete free books');
  await freeHome.getByRole('button',{name:'免費讀《雨來之前的鐘聲》第 1 章'}).click();
  await page.locator('[data-paragraph]').first().waitFor();

  if(label==='mobile')await page.locator('.reader-header button').first().click();
  const nav=label==='mobile'?page.locator('.mobile-nav').getByRole('button',{name:'閱讀',exact:true}):page.locator('.desktop-nav').getByRole('button',{name:'閱讀中心'});
  await nav.click();
  await page.getByRole('heading',{name:'我的閱讀'}).waitFor();
  await page.getByRole('button',{name:'選擇頭像',exact:true}).click();
  const avatars=page.getByRole('dialog',{name:'選擇頭像'});
  if(await avatars.locator('.avatar-options button').count()!==4)throw Error('Expected four avatar choices');
  await avatars.getByRole('button',{name:'白兔',exact:true}).click();
  const savedAvatar=await page.evaluate(()=>localStorage.getItem('storysteps-avatar'));
  if(savedAvatar!=='rabbit')throw Error('Avatar preference was not saved');
  await page.getByRole('button',{name:'更換頭像，目前為白兔'}).waitFor();

  await page.locator('.reading-hub-lead').getByText('雨來之前的鐘聲',{exact:true}).waitFor();
  await page.locator('.reading-hub-lead').getByRole('button',{name:'接續閱讀'}).waitFor();
  const passport=page.getByRole('region',{name:'閱讀護照'});
  await passport.getByRole('heading',{name:'最近閱讀足跡'}).waitFor();
  await passport.getByText('完成章末測驗後，閱讀紀錄會顯示在這裡。').waitFor();
  await passport.getByText('完書印章與級距徽章',{exact:true}).click();
  await passport.locator('.passport-badges li').first().waitFor();
  await passport.getByText('完書印章與級距徽章',{exact:true}).click();

  await page.getByText('備份與跨裝置同步',{exact:true}).click();
  await page.getByText('閱讀目標與紀錄',{exact:true}).click();
  await page.getByRole('heading',{name:/跨裝置同步/}).first().waitFor();
  await page.getByRole('heading',{name:'這七天，你讀了多少？'}).waitFor();
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
  await page.getByText('複習與收藏',{exact:true}).click();
  const review=page.getByRole('region',{name:'章末錯題複習'});
  await review.getByRole('heading',{name:'章末錯題複習'}).waitFor();
  await review.getByRole('button',{name:'B. B'}).click();
  await review.getByText('Synthetic test explanation').waitFor();
  await review.getByRole('button',{name:'下一題／完成本輪'}).click();
  await review.getByText('目前沒有到期錯題',{exact:false}).waitFor();
  const libraryNav=label==='mobile'?page.locator('.mobile-nav').getByRole('button',{name:'書庫'}):page.locator('.desktop-nav').getByRole('button',{name:'分級書城'});
  await libraryNav.click();
  const onlyFree=page.getByRole('button',{name:'整本免費',exact:true});
  await onlyFree.click();
  if(await page.locator('.book-card').count()!==12)throw Error('Free-only filter must show 12 books');
  await onlyFree.click();
  await page.locator('#discover-more > summary').click();
  const topics=page.getByRole('group',{name:'故事題材'});
  const allTopics=topics.getByRole('button',{name:'全部題材',exact:true});
  const mystery=topics.getByRole('button',{name:'規則懸疑',exact:true});
  const allBooks=await page.locator('.book-card').count();
  await mystery.click();
  if(await mystery.getAttribute('aria-pressed')!=='true'||await page.locator('.book-card').count()>=allBooks)
   throw Error('Visible topic chips must filter the shelf');
  await allTopics.click();
  if(await page.locator('.book-card').count()!==allBooks)throw Error('All topics must reset only the topic filter');
  await page.getByText('更多篩選',{exact:true}).click();

  await page.getByRole('heading',{name:'三分鐘試讀'}).waitFor();
  // Current release: covers are actual assets and six distinct novels are discoverable.
  const latest=page.locator('#new-releases');
  await latest.getByRole('heading',{name:'新的故事，現在開讀。'}).waitFor();
  if(await latest.locator('.release-item').count()!==6)throw Error('Six latest releases are not visible in library');
  const latestCovers=latest.locator('.release-item img');
  if(await latestCovers.count()!==6)throw Error('Latest releases must all have covers');
  await latestCovers.first().evaluate(async image=>{
    if(!image.complete)await new Promise((resolve,reject)=>{image.addEventListener('load',resolve,{once:true});image.addEventListener('error',reject,{once:true})});
    if(!image.naturalWidth)throw Error('Latest release cover did not load');
  });
  await page.getByRole('combobox',{name:'內容校訂狀態'}).selectOption({label:'校訂完成'});
  await page.getByRole('combobox',{name:'內容校訂狀態'}).selectOption({label:'全部校訂狀態'});
  // Read a real compressed story chapter, expand translation and verify reader viewport.
  await page.goto(base+'?book=tomorrow&chapter=tomorrow-1',{waitUntil:'domcontentloaded'});
  await page.locator('[data-paragraph]').first().waitFor({timeout:20000});
  const firstParagraph=page.locator('[data-paragraph]').first();
  const firstWord=firstParagraph.getByRole('button',{name:'查詢 The',exact:true}).first();
  await firstWord.click();
  const lookup=page.getByRole('dialog',{name:'單字中文翻譯'});
  await lookup.getByText('這個；那個（定冠詞）',{exact:true}).waitFor();
  if(await lookup.getAttribute('aria-modal')==='true')throw Error('Lookup blocks reading');
  await lookup.getByRole('button',{name:'收藏單字'}).click();
  await lookup.getByRole('button',{name:'已收藏 · 移除'}).waitFor();
  await page.keyboard.press('Escape');
  await lookup.waitFor({state:'hidden'});
  if(label==='mobile')await page.locator('.reader-header button').first().click();
  const wordsNav=label==='mobile'?page.locator('.mobile-nav').getByRole('button',{name:'單字',exact:true}):page.locator('.desktop-nav').getByRole('button',{name:'單字口袋'});
  await wordsNav.click();
  await page.getByRole('heading',{name:'我的收藏'}).waitFor();
  await page.getByRole('button',{name:'朗讀 the',exact:true}).waitFor();
  const wordSearch=page.getByRole('searchbox',{name:'搜尋收藏單字'});
  await wordSearch.fill('no matching entry');
  await page.getByText('找不到符合的單字。',{exact:true}).waitFor();
  await wordSearch.fill('the');
  await page.getByRole('button',{name:'朗讀 the',exact:true}).waitFor();
  await page.goto(base+'?book=tomorrow&chapter=tomorrow-1',{waitUntil:'domcontentloaded'});
  await page.locator('[data-paragraph]').first().waitFor();

  const tocToggle=page.getByRole('button',{name:'章節目錄'});
  if(await page.locator('#chapter-toc').isVisible())throw Error('Chapter list surrounds reading text before it is requested');
  await tocToggle.click();
  await page.locator('#chapter-toc').waitFor();
  await tocToggle.click();
  await page.getByRole('button',{name:'測驗與複習',exact:true}).click();
  const quiz=page.locator('.reader-extras details').first();
  if(await quiz.locator('fieldset').first().isVisible())throw Error('Quiz should load collapsed');
  await quiz.locator('summary').click();
  await quiz.locator('fieldset').first().waitFor();
  await quiz.locator('summary').click();
  await page.locator('.paragraph-tools > summary').first().click();
  await page.locator('.paragraph-translate').first().click();
  await page.locator('[data-paragraph] .translation').first().waitFor();
  if(label==='mobile'){
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+3);
   if(overflow)throw Error('Mobile reader overflows screen horizontally');
  }
  // The curated free tier is complete: the last chapter requires no local grant.
  await page.goto(base+'?purchase=1',{waitUntil:'domcontentloaded'});
  await page.getByRole('heading',{name:/12 本完整免費小說/}).first().waitFor();
  const purchaseButton=page.getByRole('button',{name:'付款尚未開通'});
  if(!(await purchaseButton.isDisabled()))throw Error('Unconfigured checkout must never accept money');
  await page.goto(base+'?book=import-rain-bell&chapter=import-rain-bell-25',{waitUntil:'domcontentloaded'});
  await page.locator('[data-paragraph]').first().waitFor({timeout:20000});
  await page.goto(base+'?book=tomorrow&chapter=tomorrow-10',{waitUntil:'domcontentloaded'});
  await page.locator('[data-paragraph]').first().waitFor({timeout:20000});
  await page.getByRole('region',{name:'下一本整本免費小說'}).getByRole('button',{name:'免費讀第 1 章'}).waitFor();
  await page.getByRole('button',{name:'繼續讀第 11 章'}).click();
  await page.locator('.offer-premium').getByText(/繼續讀《.+》第 11 章/).waitFor();
  await page.goto(base+'?book=tomorrow&chapter=tomorrow-11',{waitUntil:'domcontentloaded'});
  await page.getByRole('heading',{name:'前 10 章免費試讀'}).last().waitFor();
  if(await page.locator('[data-paragraph]').count())throw Error('Chapter 11 bypassed the preview limit');
  // Stage 2 editorial transparency: every book is shown, none falsely certified.
  await page.goto(base+'editorial-progress.html',{waitUntil:'domcontentloaded'});
  const editorialRows=page.locator('#books tbody tr');
  const expectedBooks=JSON.parse(readFileSync('public/catalog.js','utf8').split('=',2)[1].replace(/;\s*$/,'')).length;
  if(await editorialRows.count()!==expectedBooks)throw Error('Editorial tracker must list all '+expectedBooks+' published books');
  await page.locator('#search').fill('萬味渡口');
  if(await editorialRows.filter({visible:true}).count()!==1)throw Error('Editorial filter did not isolate one book');
  const auditContent=await editorialRows.filter({visible:true}).first().innerText();
  const certificate=JSON.parse(readFileSync('verification/editorial-approvals.json','utf8')).certifiedBooks['ss-r10-l5-b'];
  if(!auditContent.includes(certificate?'校訂完成':'校訂中'))throw Error('Editorial label must match full review evidence');
  // New batch: open a genuinely imported first chapter, not merely catalog metadata.
  await page.goto(base+'?book=ss-r11-l1-a&chapter=ss-r11-l1-a-1',{waitUntil:'domcontentloaded'});
  await page.locator('[data-paragraph]').first().waitFor({timeout:20000});
  const newBookHeading=await page.locator('body').innerText();
  if(!newBookHeading.includes('雨後的綠色箱子'))throw Error('Newly imported story not readable');
  const batch15=['ss-r15-l1-b','ss-r15-l2-b','ss-r15-l3-b','ss-r15-l4-b','ss-r15-l5-b','ss-r15-l6-a'];
  for(const id of batch15){
   await page.goto(base+'?book='+id+'&chapter='+id+'-1',{waitUntil:'domcontentloaded'});
   await page.locator('[data-paragraph]').first().waitFor({timeout:10000});
  }
  if(errors.length)throw Error(label+' JS errors: '+errors.join('; '));
  console.log(JSON.stringify({device:label,ok:true,sync:true,theme:true}));
 }finally{await context.close()}
}
let failed=false;
try{
 await ready();browser=await chromium.launch({headless:true,executablePath:process.env.STORYSTEPS_CHROMIUM||undefined});
 await run('desktop',{viewport:{width:1365,height:900}});
 await run('mobile',{...devices['iPhone 13'],isMobile:true,hasTouch:true});
}catch(error){failed=true;console.error(error)}
finally{if(browser)await browser.close();child.kill('SIGTERM');await Promise.race([new Promise(resolve=>child.once('exit',resolve)),delay(1200)]);if(child.exitCode===null)child.kill('SIGKILL')}
if(failed)process.exitCode=1;
