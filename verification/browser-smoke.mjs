// Browser smoke test. Mobile viewport emulation is not a physical-device test.
import {chromium,devices} from 'playwright';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';

const child=spawn('npm',['run','preview','--','--host','127.0.0.1','--port','4173','--strictPort'],{stdio:'pipe'});
const base='http://127.0.0.1:4173/';
async function ready(){for(let i=0;i<80;i++){try{const response=await fetch(base);if(response.ok)return}catch{}await delay(250)}throw Error('Preview server failed to start')}
const browser=await chromium.launch({headless:true});
let failed=false;
try{
 await ready();
 for(const [label,options] of [
   ['desktop',{viewport:{width:1365,height:900}}],
   ['mobile',{...devices['iPhone 13'],isMobile:true,hasTouch:true}]
 ]){
  const context=await browser.newContext(options);
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.getByRole('heading',{name:/今天想走進哪個世界|先愛上故事|故事/}).first().waitFor({timeout:20000}).catch(()=>{});
  const links=page.getByRole('button',{name:'閱讀中心'});
  await links.first().click();
  await page.getByRole('heading',{name:/跨裝置同步/}).first().waitFor({timeout:12000});
  await page.getByRole('button',{name:'建立我的同步空間'}).first().waitFor();
  await page.getByRole('button',{name:/切換黑暗模式|切換淺色模式/}).first().click();
  await page.getByRole('button',{name:/切換黑暗模式|切換淺色模式/}).first().click();
  if(errors.length)throw Error(label+' page errors: '+errors.join('; '));
  console.log(JSON.stringify({device:label,ok:true,syncVisible:true,themeToggle:true}));
  await context.close();
 }
} catch(e){failed=true;console.error(e)}finally{await browser.close();child.kill('SIGTERM')}
if(failed)process.exitCode=1;
