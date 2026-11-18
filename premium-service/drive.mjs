import {googleClientId, googleAccountForSubject} from './google.mjs';

const scope = 'https://www.googleapis.com/auth/drive.appdata';
const tokenUrl = 'https://oauth2.googleapis.com/token';
const driveUrl = 'https://www.googleapis.com/drive/v3/files';
const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id';
const encode = new TextEncoder();
const decode = new TextDecoder();
const MAX_BACKUP = 800_000;
const query = (env, sql, ...values) => env.DB.prepare(sql).bind(...values);
const random = () => hex(crypto.getRandomValues(new Uint8Array(32)));
const hex = bytes => Array.from(bytes, byte => byte.toString(16).padStart(2,'0')).join('');
const unhex = value => Uint8Array.from(value.match(/../g), pair => parseInt(pair,16));
const callbackUrl = env => new URL('/api/premium/drive/callback',env.SERVICE_URL).href;
const connection = (env,account) => query(env,'SELECT * FROM premium_drive_connections WHERE account=?',account).first();

export const driveConfigured = env => Boolean(googleClientId(env) && env.GOOGLE_DRIVE_CLIENT_SECRET &&
 /^[a-f0-9]{64}$/i.test(env.GOOGLE_DRIVE_TOKEN_KEY || '') && env.SERVICE_URL && env.APP_URL);

async function cryptKey(env) {
 return crypto.subtle.importKey('raw',unhex(env.GOOGLE_DRIVE_TOKEN_KEY),'AES-GCM',false,['encrypt','decrypt']);
}
async function encrypt(env,account,value) {
 const iv = crypto.getRandomValues(new Uint8Array(12));
 const encrypted = await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encode.encode(account)},await cryptKey(env),encode.encode(value));
 return hex(iv)+hex(new Uint8Array(encrypted));
}
async function decrypt(env,account,value) {
 const raw = unhex(value);
 return decode.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:raw.slice(0,12),additionalData:encode.encode(account)},await cryptKey(env),raw.slice(12)));
}
async function tokens(env,fields) {
 return fetch(tokenUrl,{method:'POST',body:new URLSearchParams({
  client_id:googleClientId(env),client_secret:env.GOOGLE_DRIVE_CLIENT_SECRET,...fields
 }),signal:AbortSignal.timeout(12_000)});
}
async function driveFetch(url,token,options={}) {
 return fetch(url,{...options,headers:{authorization:'Bearer '+token,...options.headers},signal:AbortSignal.timeout(12_000)});
}

export async function startDrive(env,session) {
 const state = random(), verifier = random();
 const hashed = new Uint8Array(await crypto.subtle.digest('SHA-256',encode.encode(verifier)));
 const challenge = btoa(String.fromCharCode(...hashed)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
 await env.DB.batch([
  query(env,'DELETE FROM premium_drive_challenges WHERE expires_at<=?',Date.now()),
  query(env,'INSERT INTO premium_drive_challenges VALUES (?,?,?,?)',state,session.account,verifier,Date.now()+10*60_000),
 ]);
 const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
 url.search = new URLSearchParams({client_id:googleClientId(env),redirect_uri:callbackUrl(env),
  response_type:'code',access_type:'offline',prompt:'consent',scope:'openid '+scope,state,
  code_challenge:challenge,code_challenge_method:'S256',login_hint:session.email}).toString();
 return {url:url.href};
}

export async function completeDrive(env,url) {
 const destination = new URL(env.APP_URL);
 const finish = result => {
  destination.searchParams.set('drive-backup',result);
  return new Response(null,{status:303,headers:{location:destination.href,'cache-control':'no-store','referrer-policy':'no-referrer'}});
 };
 const state = url.searchParams.get('state') || '', code = url.searchParams.get('code');
 if (!env.DB || !driveConfigured(env) || !/^[a-f0-9]{64}$/.test(state)) return finish('failed');
 const now = Date.now();
 const proof = await query(env,'DELETE FROM premium_drive_challenges WHERE state=? AND expires_at>? RETURNING account,verifier',state,now).first();
 if (!proof || !code || code.length>4096) return finish('failed');
 const exchanged = await tokens(env,{code,code_verifier:proof.verifier,redirect_uri:callbackUrl(env),grant_type:'authorization_code'});
 if (!exchanged.ok) return finish('failed');
 const token = await exchanged.json();
 if (!token.access_token || !token.refresh_token || !token.scope?.split(' ').includes(scope)) return finish('failed');
 const who = await driveFetch('https://openidconnect.googleapis.com/v1/userinfo',token.access_token);
 if (!who.ok) return finish('failed');
 const {sub} = await who.json();
 if (typeof sub !== 'string' || await googleAccountForSubject(sub) !== proof.account) return finish('wrong-account');
 const encrypted = await encrypt(env,proof.account,token.refresh_token);
 await query(env,`INSERT INTO premium_drive_connections(account,refresh_token) VALUES (?,?)
  ON CONFLICT(account) DO UPDATE SET refresh_token=excluded.refresh_token,revision=premium_drive_connections.revision+1`,proof.account,encrypted).run();
 return finish('connected');
}

async function accessToken(env,row) {
 const response = await tokens(env,{grant_type:'refresh_token',refresh_token:await decrypt(env,row.account,row.refresh_token)});
 const token = await response.json();
 if (response.ok && typeof token.access_token==='string') return token.access_token;
 if (token.error==='invalid_grant') {
  await query(env,'UPDATE premium_drive_connections SET refresh_token=NULL,revision=revision+1 WHERE account=? AND refresh_token=?',row.account,row.refresh_token).run();
  return null;
 }
 throw Error('Drive authorization unavailable');
}

export async function driveStatus(env,account) {
 const row = await connection(env,account);
 return {connected:Boolean(row?.refresh_token),savedAt:row?.saved_at || 0,profile:account};
}

const learningKeys = new Set(['storysteps-guest','storysteps-reader-v2-guest','storysteps-reading-days-v1',
 'storysteps-comfort','storysteps-line','storysteps-weekly-goal','storysteps-last']);
function validSnapshot(snapshot) {
 if (snapshot?.version!==1 || !snapshot.records || typeof snapshot.records!=='object' || Array.isArray(snapshot.records)) return false;
 const records = Object.entries(snapshot.records);
 return records.length<=4000 && records.every(([key,value])=>{
  if (!learningKeys.has(key) && !/^storysteps-position-[a-z0-9-]{1,90}$/.test(key)) return false;
  try { return typeof value==='string' && JSON.parse(value)!==null; } catch { return false; }
 });
}

async function deleteFile(id,token) {
 if (id) await driveFetch(driveUrl+'/'+encodeURIComponent(id),token,{method:'DELETE'}).catch(()=>{});
}

export async function driveBackup(env,account,action,data) {
 const row = await connection(env,account);
 if (action==='disconnect') {
  await query(env,'UPDATE premium_drive_connections SET refresh_token=NULL,revision=revision+1 WHERE account=?',account).run();
  return [await driveStatus(env,account),200];
 }
 if (!row?.refresh_token) return [{error:'請先連結 Google Drive。',reconnect:true},409];
 if (action==='read' && !row.file_id) return [{revision:row.revision,snapshot:null,savedAt:0},200];
 let json;
 if (action==='save') {
  if (!validSnapshot(data?.snapshot) || (json=JSON.stringify(data.snapshot)).length>MAX_BACKUP ||
   encode.encode(json).length>MAX_BACKUP) return [{error:'備份格式不符或檔案過大。'},400];
  if (data.revision!==row.revision) return [{error:'雲端備份已更新，請重試。'},409];
 }
 const token = await accessToken(env,row);
 if (!token) return [{error:'Google Drive 授權已失效，請重新連結。',reconnect:true},409];
 if (action==='read') {
  const result = await driveFetch(driveUrl+'/'+encodeURIComponent(row.file_id)+'?alt=media',token);
  if (result.status===404) return [{revision:row.revision,snapshot:null,savedAt:0},200];
  if (!result.ok) throw Error('Drive backup download failed');
  const snapshot = await result.json();
  if (!validSnapshot(snapshot)) return [{error:'雲端備份格式不符，請保留現有紀錄。'},409];
  return [{revision:row.revision,snapshot,savedAt:row.saved_at},200];
 }
 const boundary = 'storysteps_'+random();
 const metadata = JSON.stringify({name:'storysteps-learning-backup.json',parents:['appDataFolder'],mimeType:'application/json'});
 const uploaded = await driveFetch(uploadUrl,token,{method:'POST',headers:{'content-type':'multipart/related; boundary='+boundary},
  body:`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${json}\r\n--${boundary}--\r\n`});
 if (!uploaded.ok) throw Error('Drive backup upload failed');
 const {id} = await uploaded.json();
 if (typeof id!=='string' || !id) throw Error('Drive backup file ID missing');
 const savedAt = Date.now();
 const update = await query(env,`UPDATE premium_drive_connections SET file_id=?,saved_at=?,revision=revision+1
  WHERE account=? AND revision=? AND refresh_token IS NOT NULL`,id,savedAt,account,row.revision).run();
 if (!update.meta.changes) {
  await deleteFile(id,token);
  return [{error:'雲端備份已更新，請重試。'},409];
 }
 await deleteFile(row.file_id,token);
 return [{revision:row.revision+1,savedAt},200];
}
