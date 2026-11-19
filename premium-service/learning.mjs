import {validSnapshot} from './drive.mjs';

export async function learningRequest(env,account,action,data) {
 const sql=(text,...values)=>env.DB.prepare(text).bind(...values);
 if(action==='status'){
  const row=await sql('SELECT saved_at FROM premium_learning WHERE account=?',account).first();
  return [{connected:true,profile:account,savedAt:row?.saved_at||0},200];
 }
 if(action==='read'){
  const row=await sql('SELECT * FROM premium_learning WHERE account=?',account).first();
  return [{revision:row?.revision||0,snapshot:row?JSON.parse(row.snapshot):null,savedAt:row?.saved_at||0},200];
 }
 if(!validSnapshot(data?.snapshot)||!Number.isSafeInteger(data?.revision)||data.revision<0)
  return [{error:'學習紀錄格式不符。'},400];
 const snapshot=JSON.stringify(data.snapshot);
 if(new TextEncoder().encode(snapshot).length>800000)return [{error:'學習紀錄過大，請下載備份。'},413];
 const savedAt=Date.now();
 const updated=data.revision===0
  ?await sql('INSERT OR IGNORE INTO premium_learning VALUES (?,1,?,?)',account,snapshot,savedAt).run()
  :await sql('UPDATE premium_learning SET revision=revision+1,snapshot=?,saved_at=? WHERE account=? AND revision=?',snapshot,savedAt,account,data.revision).run();
 return updated.meta.changes?[{revision:data.revision+1,savedAt},200]:[{error:'另一台裝置已更新紀錄，請重試。'},409];
}
