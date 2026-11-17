// Real browser captures of the production build at a mobile viewport; no invented UI.
import {chromium} from 'playwright';
import {spawn,execFileSync} from 'node:child_process';
import {mkdir,copyFile,rm,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {setTimeout as hold} from 'node:timers/promises';
const output=resolve('public/demos');
await mkdir(output,{recursive:true});
await mkdir('docs/demos',{recursive:true});
const names=['word-lookup','bilingual-reading'];
if(names.every(name=>existsSync(`${output}/${name}.mp4`))){
 for(const name of names){await copyFile(`${output}/${name}.mp4`,`docs/demos/${name}.mp4`);await copyFile(`${output}/${name}.jpg`,`docs/demos/${name}.jpg`)}
 console.log('Existing verified demonstration clips preserved.');process.exit(0);
}
const child=spawn(process.execPath,[resolve('node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port','4177','--strictPort'],{stdio:'ignore'});
const base='http://127.0.0.1:4177/';
let browser;
try{
 for(let i=0;i<60;i++){try{if((await fetch(base)).ok)break}catch{}await hold(200)}
 browser=await chromium.launch({headless:true});
 for(const name of names){
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,recordVideo:{dir:output+'/raw',size:{width:390,height:844}},reducedMotion:'reduce'});
  const page=await context.newPage();page.setDefaultTimeout(12000);
  // Synthetic isolated profile; never include account data, remote analytics or real payments.
  await page.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());
  await page.goto(base+'?book=import-rain-bell&chapter=import-rain-bell-1');
  await page.locator('.prose').waitFor();
  await hold(1500);
  if(name==='word-lookup'){
   await page.locator('.prose').getByRole('button',{name:'查詢 almost',exact:true}).first().click();
   await page.getByRole('dialog',{name:'單字中文翻譯'}).waitFor();
   await page.screenshot({path:output+'/'+name+'.jpg',type:'jpeg',quality:90});
   await hold(3500);
   await page.getByRole('button',{name:'返回原文',exact:true}).click();
   await hold(2500);
  }else{
   await page.getByRole('button',{name:'顯示中文',exact:true}).click();
   const translation=page.locator('.translation').first();
   await translation.scrollIntoViewIfNeeded();
   await page.screenshot({path:output+'/'+name+'.jpg',type:'jpeg',quality:90});
   await hold(4000);
   await page.locator('.reader-tools').scrollIntoViewIfNeeded();
   await page.getByRole('button',{name:'收起中文',exact:true}).click();
   await hold(2500);
  }
  const video=page.video();await context.close();
  const raw=await video.path();
  execFileSync('ffmpeg',['-y','-i',raw,'-vf','scale=-2:1920,pad=1080:1920:(ow-iw)/2:0:color=0x121119','-c:v','libx264','-preset','fast','-crf','23','-pix_fmt','yuv420p','-movflags','+faststart','-an',output+'/'+name+'.mp4'],{stdio:'ignore'});
  const probe=JSON.parse(execFileSync('ffprobe',['-v','quiet','-print_format','json','-show_streams','-show_format',output+'/'+name+'.mp4'],{encoding:'utf8'}));
  if(Number(probe.format.duration)<5||probe.streams[0].width!==1080||probe.streams[0].height!==1920)throw Error('Invalid demonstration video: '+name);
  await copyFile(output+'/'+name+'.mp4','docs/demos/'+name+'.mp4');
  await copyFile(output+'/'+name+'.jpg','docs/demos/'+name+'.jpg');
  console.log('Recorded '+name+': '+probe.format.duration+' seconds, 1080 × 1920 MP4');
 }
 await writeFile(output+'/capture.json',JSON.stringify({recordedAt:new Date().toISOString(),source:'Real Chromium browser interaction with the built website',viewport:{width:390,height:844},output:{width:1080,height:1920},physicalPhone:false,clips:names},null,2));
 await copyFile(output+'/capture.json','docs/demos/capture.json');
}finally{await browser?.close();child.kill();await rm(output+'/raw',{recursive:true,force:true})}
