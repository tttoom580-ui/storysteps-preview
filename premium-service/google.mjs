const encoder = new TextEncoder();
const decoder = new TextDecoder();
const hex = value => Array.from(new Uint8Array(value), byte=>byte.toString(16).padStart(2,'0')).join('');
const randomHex = () => hex(crypto.getRandomValues(new Uint8Array(32)));
const digest = async value => hex(await crypto.subtle.digest('SHA-256',encoder.encode(value)));
const googleToken = /^ssg_[a-f0-9]{64}$/;
const statement = (env,sql,...bindings) => env.DB.prepare(sql).bind(...bindings);
const keysURL = 'https://www.googleapis.com/oauth2/v3/certs';
let keys;
let expiresAt = 0;

export function googleClientId(env) {
 const id = env.GOOGLE_CLIENT_ID || '';
 return /^[a-z0-9-]+\.apps\.googleusercontent\.com$/i.test(id) ? id : '';
}

function jwtPart(value) {
 return Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),char=>char.charCodeAt(0));
}

async function verifyGoogleToken(token,clientId) {
 if (typeof token !== 'string' || token.length > 6000 || !/^[\w-]+\.[\w-]+\.[\w-]+$/.test(token)) return null;
 try {
  const [header,body,signature] = token.split('.');
  const {alg,kid} = JSON.parse(decoder.decode(jwtPart(header)));
  const claims = JSON.parse(decoder.decode(jwtPart(body)));
  const now = Math.floor(Date.now()/1000);
  if (alg !== 'RS256' || typeof kid !== 'string' || !['https://accounts.google.com','accounts.google.com'].includes(claims.iss) ||
   claims.aud !== clientId || (claims.azp && claims.azp !== clientId) ||
   !Number.isSafeInteger(claims.exp) || claims.exp <= now || !Number.isSafeInteger(claims.iat) || claims.iat > now+60 ||
   typeof claims.sub !== 'string' || !/^[\x21-\x7e]{1,255}$/.test(claims.sub) ||
   typeof claims.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(claims.email) ||
   claims.email_verified !== true || !/^[a-f0-9]{64}$/.test(claims.nonce || '')) return null;
  if (!keys || Date.now() >= expiresAt) {
   const result = await fetch(keysURL);
   if (!result.ok) throw Error('Google certificates unavailable');
   const body = await result.json();
   if (!Array.isArray(body.keys)) throw Error('Invalid Google certificates');
   const maxAge = Number(/max-age=(\d+)/i.exec(result.headers.get('cache-control') || '')?.[1] || 60);
   keys = body.keys;
   expiresAt = Date.now()+Math.min(maxAge,86400)*1000;
  }
  const jwk = keys.find(key=>key.kid===kid && key.kty==='RSA' && (!key.alg || key.alg==='RS256'));
  if (!jwk) return null;
  const key = await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  return await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,jwtPart(signature),encoder.encode(header+'.'+body)) ? claims : null;
 } catch { return null; }
}

export async function newGoogleChallenge(env) {
 const nonce = randomHex(), proof = randomHex();
 await statement(env,'INSERT INTO premium_google_challenges VALUES (?,?,?)',await digest(proof),nonce,Date.now()+10*60*1000).run();
 return {nonce,proof};
}

export async function authenticateGoogle(env,data) {
 if (typeof data?.proof !== 'string' || !/^[a-f0-9]{64}$/.test(data.proof)) return null;
 const proofHash = await digest(data.proof);
 const challenge = await statement(env,'SELECT nonce FROM premium_google_challenges WHERE proof_hash=? AND expires_at>?',proofHash,Date.now()).first();
 if (!challenge) return null;
 const claims = await verifyGoogleToken(data.credential,googleClientId(env));
 if (!claims || claims.nonce !== challenge.nonce) return null;
 const consumed = await statement(env,'DELETE FROM premium_google_challenges WHERE proof_hash=? AND nonce=? AND expires_at>?',
  proofHash,claims.nonce,Date.now()).run();
 if (!consumed.meta.changes) return null;
 const account = 'google:' + await digest(claims.sub);
 const token = 'ssg_' + randomHex();
 await env.DB.batch([
  statement(env,'INSERT OR IGNORE INTO premium_accounts(id,created_at) VALUES(?,?)',account,Date.now()),
  statement(env,'INSERT INTO premium_google_accounts VALUES(?,?) ON CONFLICT(account) DO UPDATE SET email=excluded.email',account,claims.email),
  statement(env,'INSERT INTO premium_google_sessions VALUES(?,?,?)',await digest(token),account,Date.now()+30*86400000),
 ]);
 return {token};
}

export async function googleSession(env,token) {
 if (!googleToken.test(token) || !googleClientId(env)) return null;
 return statement(env,'SELECT s.account,g.email FROM premium_google_sessions s JOIN premium_google_accounts g ON g.account=s.account WHERE s.token_hash=? AND s.expires_at>?',
  await digest(token),Date.now()).first();
}

export async function endGoogleSession(env,token) {
 if (googleToken.test(token)) await statement(env,'DELETE FROM premium_google_sessions WHERE token_hash=?',await digest(token)).run();
}

export async function cleanGoogleSessions(env) {
 await env.DB.batch([
  statement(env,'DELETE FROM premium_google_challenges WHERE expires_at<=?',Date.now()),
  statement(env,'DELETE FROM premium_google_sessions WHERE expires_at<=?',Date.now()),
 ]);
}
