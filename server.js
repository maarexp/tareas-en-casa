import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';
import {createInitialState} from './data-seed.js';

const root=path.dirname(fileURLToPath(import.meta.url));
const staticRoot=path.join(root,'public');
const PORT=Number(process.env.PORT||3000);
const DATA_PATH=process.env.DATA_FILE||path.join(root,'.data','hogar.json');
const dbUrl=process.env.DATABASE_URL;
const secret=process.env.APP_SECRET||crypto.randomBytes(32).toString('hex');
if(!process.env.APP_SECRET) console.warn('APP_SECRET no configurado: las sesiones se invalidarán tras reiniciar.');
if(!dbUrl && process.env.REQUIRE_POSTGRES==='1') throw new Error('Falta DATABASE_URL: este despliegue requiere PostgreSQL para guardar los datos.');
if(!dbUrl && process.env.PERSISTENT_STORAGE!=='1') console.warn('Modo local no persistente: usa PERSISTENT_STORAGE=1 con un volumen real o configura DATABASE_URL.');
let pgPool=null;
let fileQueue=Promise.resolve();
if(dbUrl){
  const {Pool}=await import('pg');
  pgPool=new Pool({connectionString:dbUrl,ssl:process.env.PGSSL==='require'?{rejectUnauthorized:false}:undefined});
  // Neon puede cerrar conexiones inactivas: sin este manejador el proceso se caería.
  pgPool.on('error',err=>console.error('Conexión PostgreSQL cerrada:',err.message));
  await pgPool.query('CREATE TABLE IF NOT EXISTS hogar_state (id INTEGER PRIMARY KEY, payload JSONB NOT NULL)');
}
async function loadFile(){try{return JSON.parse(await fs.readFile(DATA_PATH,'utf8'));}catch(err){if(err.code==='ENOENT')return null; throw err;}}
async function writeFile(state){await fs.mkdir(path.dirname(DATA_PATH),{recursive:true});const temp=DATA_PATH+'.tmp';await fs.writeFile(temp,JSON.stringify(state,null,2));await fs.rename(temp,DATA_PATH);}
async function getState(){if(pgPool){const r=await pgPool.query('SELECT payload FROM hogar_state WHERE id=1');return r.rows[0]?.payload||null;}return loadFile();}
async function mutate(fn){
  if(pgPool){const client=await pgPool.connect();try{await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(7266481)');const r=await client.query('SELECT payload FROM hogar_state WHERE id=1 FOR UPDATE');const state=r.rows[0]?.payload||null;const updated=await fn(state);if(updated!==undefined){await client.query('INSERT INTO hogar_state (id,payload) VALUES (1,$1::jsonb) ON CONFLICT(id) DO UPDATE SET payload=$1::jsonb',[JSON.stringify(updated)]);}await client.query('COMMIT');return updated;}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}}
  const pending=fileQueue.then(async()=>{const current=await loadFile();const updated=await fn(current);if(updated!==undefined)await writeFile(updated);return updated;});fileQueue=pending.catch(()=>{});return pending;
}
const b64=v=>Buffer.from(v).toString('base64url');
const hmac=s=>crypto.createHmac('sha256',secret).update(s).digest('base64url');
const hashPin=(pin,salt)=>crypto.scryptSync(pin,salt,64).toString('hex');
const parseBody=async req=>{
  if(!req.headers['content-type']?.includes('application/json'))throw httpError(415,'Solo JSON');
  let body='';for await(const chunk of req){body+=chunk;if(body.length>100000)throw httpError(413,'Solicitud demasiado grande');}
  try{return JSON.parse(body||'{}');}catch{throw httpError(400,'JSON inválido');}
};
const httpError=(status,message)=>Object.assign(new Error(message),{status});
function cookie(req){const raw=req.headers.cookie||'';const match=raw.match(/(?:^|;\s*)hogar_session=([^;]+)/);if(!match)return null;const encoded=decodeURIComponent(match[1]);const sep=encoded.lastIndexOf('.');if(sep<0)return null;const data=encoded.slice(0,sep),signature=encoded.slice(sep+1);const expected=hmac(data);if(signature.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(signature),Buffer.from(expected)))return null;try{const payload=JSON.parse(Buffer.from(data,'base64url').toString('utf8'));return payload.exp>Date.now()&&['Edu','Minerva'].includes(payload.actor)?payload:null;}catch{return null;}}
function createCookie(req,actor){const payload=b64(JSON.stringify({actor,exp:Date.now()+30*86400_000}));const secure=(req.headers['x-forwarded-proto']||'').split(',')[0]==='https'||!!req.socket.encrypted;return `hogar_session=${payload}.${hmac(payload)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000${secure?'; Secure':''}`;}
function json(res,status,data,headers={}){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(JSON.stringify(data));}
function validDate(s){if(!/^\d{4}-\d\d-\d\d$/.test(s||''))return false;const d=new Date(`${s}T12:00:00Z`);return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===s;}
function checkOrigin(req){if(['GET','HEAD','OPTIONS'].includes(req.method))return; if(req.headers['x-hogar-client']!=='1')throw httpError(403,'Solicitud no autorizada');const origin=req.headers.origin;if(origin){const o=new URL(origin);const forwarded=req.headers['x-forwarded-host']?.split(',')[0]?.trim();const host=forwarded||req.headers.host;if(o.host!==host)throw httpError(403,'Origen no permitido');}}
function needLogin(req){const sess=cookie(req);if(!sess)throw httpError(401,'Introduce el código de la casa');return sess;}
function publicState(s,actor){return {actor,settings:s.settings,tasks:s.tasks,completions:s.completions,overrides:s.overrides,activity:s.activity.slice(-65)};}
function logActivity(s,actor,message){s.activity.push({id:crypto.randomUUID(),actor,message,at:new Date().toISOString()});if(s.activity.length>200)s.activity=s.activity.slice(-200);}
const categories=['Orden','Cocina','Gatos','Suelos','Baños','Ropa','Limpieza profunda','Exterior','Otros'];
function validateTask(t){
  const title=String(t.title||'').trim().slice(0,90),category=categories.includes(t.category)?t.category:'Otros';
  const freq=t.frequency,assignee=t.assignee;
  if(!title||!['daily','weekly','fortnightly','monthly','once'].includes(freq)||!['Edu','Minerva','Ambos','Alterno'].includes(assignee))throw httpError(400,'Revisa los datos de la tarea');
  const out={title,category,frequency:freq,assignee,optional:!!t.optional,emoji:'✓',minutes:Math.max(1,Math.min(240,Number(t.minutes)||10)),description:String(t.description||'').slice(0,280)};
  if(freq==='weekly'){const d=Number(t.weekday);if(!Number.isInteger(d)||d<0||d>6)throw httpError(400,'Día no válido');out.weekday=d;}
  if(freq==='fortnightly'){if(!validDate(t.anchorDate))throw httpError(400,'Fecha quincenal no válida');out.anchorDate=t.anchorDate;}
  if(freq==='monthly'){const d=Number(t.monthDay);if(!Number.isInteger(d)||d<1||d>28)throw httpError(400,'Elige un día entre 1 y 28');out.monthDay=d;}
  if(freq==='once'){if(!validDate(t.date))throw httpError(400,'Fecha no válida');out.date=t.date;}
  return out;
}
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.ico':'image/x-icon'};
async function serveStatic(req,res,pathName){
  const decoded=decodeURIComponent(pathName);
  const requested=decoded==='/'?'index.html':decoded.slice(1);
  if(requested.split('/').some(p=>p==='..'||p.startsWith('.')))throw httpError(404,'No encontrado');
  const target=path.resolve(staticRoot,requested);
  if(!target.startsWith(staticRoot+path.sep))throw httpError(404,'No encontrado');
  let stat;try{stat=await fs.stat(target);}catch{throw httpError(404,'No encontrado');}
  if(!stat.isFile())throw httpError(404,'No encontrado');
  res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream','Cache-Control':target.endsWith('index.html')?'no-cache':'public, max-age=3600','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"});
  createReadStream(target).pipe(res);
}
const server=http.createServer(async(req,res)=>{
  try{
    checkOrigin(req);
    const url=new URL(req.url,'http://localhost');const p=url.pathname;
    if(p==='/api/health')return json(res,200,{ok:true,backend:pgPool?'postgres':process.env.PERSISTENT_STORAGE==='1'?'persistent-file':'local-preview'});
    if(p==='/api/bootstrap'&&req.method==='GET'){const s=await getState();return json(res,200,{configured:!!s,authenticated:!!cookie(req),actor:cookie(req)?.actor||null,productionReady:!!pgPool||process.env.PERSISTENT_STORAGE==='1'});}
    if(p==='/api/setup'&&req.method==='POST'){
      const {pin,actor='Edu'}=await parseBody(req);
      if(typeof pin!=='string'||pin.length<8||pin.length>72||!['Edu','Minerva'].includes(actor))throw httpError(400,'El código debe tener entre 8 y 72 caracteres');
      const salt=crypto.randomBytes(16).toString('hex');const pinHash=hashPin(pin,salt);
      await mutate(current=>{if(current)throw httpError(409,'La casa ya está configurada');return createInitialState({salt,pinHash});});
      return json(res,201,{ok:true,actor},{'Set-Cookie':createCookie(req,actor)});
    }
    if(p==='/api/login'&&req.method==='POST'){
      const {pin,actor}=await parseBody(req);const s=await getState();if(!s)throw httpError(400,'Primero hay que configurar la casa');
      if(!['Edu','Minerva'].includes(actor)||typeof pin!=='string')throw httpError(401,'Datos incorrectos');
      const actual=hashPin(pin,s.setup.salt),expected=s.setup.pinHash;
      if(!crypto.timingSafeEqual(Buffer.from(actual),Buffer.from(expected)))throw httpError(401,'Código de acceso incorrecto');
      return json(res,200,{ok:true,actor},{'Set-Cookie':createCookie(req,actor)});
    }
    if(p==='/api/logout'&&req.method==='POST'){return json(res,200,{ok:true},{'Set-Cookie':'hogar_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'});}
    if(p.startsWith('/api/')){
      const {actor}=needLogin(req);
      if(p==='/api/state'&&req.method==='GET'){const s=await getState();return json(res,200,publicState(s,actor));}
      if(p==='/api/settings'&&req.method==='PUT'){
        const {mode}=await parseBody(req);if(!['practicas','manana','tarde'].includes(mode))throw httpError(400,'Modo incorrecto');
        const s=await mutate(s=>{s.settings={mode,updatedAt:new Date().toISOString()};logActivity(s,actor,`Cambió el horario a ${mode}`);return s;});return json(res,200,publicState(s,actor));
      }
      if(p==='/api/toggle'&&req.method==='POST'){
        const {taskId,date,done}=await parseBody(req);
        if(typeof taskId!=='string'||!validDate(date)||typeof done!=='boolean')throw httpError(400,'Datos inválidos');
        const now=Date.now(),value=new Date(date+'T12:00:00Z').getTime();if(value<now-400*86400_000||value>now+400*86400_000)throw httpError(400,'Fecha fuera de rango');
        const s=await mutate(s=>{const t=s.tasks.find(t=>t.id===taskId);if(!t)throw httpError(404,'Tarea desconocida');const key=`${taskId}@${date}`;if(done)s.completions[key]={by:actor,at:new Date().toISOString()};else delete s.completions[key];logActivity(s,actor,`${done?'Completó':'Desmarcó'}: ${t.title}`);return s;});return json(res,200,publicState(s,actor));
      }
      if(p==='/api/override'&&req.method==='POST'){
        const {taskId,date,assignee}=await parseBody(req);if(!validDate(date)||!['Edu','Minerva','Ambos'].includes(assignee))throw httpError(400,'Reasignación incorrecta');
        const s=await mutate(s=>{const t=s.tasks.find(t=>t.id===taskId);if(!t)throw httpError(404,'Tarea desconocida');s.overrides[`${taskId}@${date}`]=assignee;logActivity(s,actor,`Reasignó ${t.title} a ${assignee}`);return s;});return json(res,200,publicState(s,actor));
      }
      if(p==='/api/task'&&req.method==='POST'){
        const parsed=validateTask(await parseBody(req));
        const s=await mutate(s=>{s.tasks.push({...parsed,id:crypto.randomUUID()});logActivity(s,actor,`Añadió: ${parsed.title}`);return s;});return json(res,201,publicState(s,actor));
      }
      const match=p.match(/^\/api\/task\/([\w-]+)$/);
      if(match&&(req.method==='PUT'||req.method==='DELETE')){
        const raw=req.method==='PUT'?await parseBody(req):null;const parsed=raw?validateTask(raw):null;
        // Al editar se conservan el emoji y, si se pide, el reparto automático según horario (plan).
        const s=await mutate(s=>{const idx=s.tasks.findIndex(t=>t.id===match[1]);if(idx<0)throw httpError(404,'Tarea no encontrada');const old=s.tasks[idx];if(parsed)s.tasks[idx]={...parsed,id:old.id,emoji:old.emoji||parsed.emoji,...(old.plan&&raw.keepPlan===true?{plan:old.plan}:{})};else s.tasks.splice(idx,1);logActivity(s,actor,`${parsed?'Editó':'Eliminó'}: ${old.title}`);return s;});return json(res,200,publicState(s,actor));
      }
      throw httpError(404,'Ruta no encontrada');
    }
    if(req.method==='GET'||req.method==='HEAD')return serveStatic(req,res,p);
    throw httpError(405,'Método no permitido');
  }catch(err){console.error(err.status||500,err.message);if(!res.headersSent)json(res,err.status||500,{error:err.status?err.message:'Error interno del servidor'});else res.end();}
});
server.listen(PORT,()=>console.log(`Hogar Edu y Minerva: http://localhost:${PORT}`));
