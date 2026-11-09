import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function freePort(){return new Promise((resolve,reject)=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});s.on('error',reject);});}
async function request(base,path,method='GET',body,cookie){return fetch(base+path,{method,headers:{...(body?{'content-type':'application/json'}:{}),...(method!=='GET'?{'x-hogar-client':'1'}:{}),...(cookie?{cookie}:{})},body:body?JSON.stringify(body):undefined});}
test('flujo compartido: crear casa, entrar, marcar, reasignar, añadir y cambiar horario',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'hogar-test-'));const port=await freePort();
 const proc=spawn(process.execPath,['server.js'],{cwd:new URL('..',import.meta.url).pathname,env:{...process.env,DATA_FILE:path.join(dir,'data.json'),PORT:String(port),APP_SECRET:'test-very-long-secret-just-for-tests-1234567'},stdio:'ignore'});
 t.after(async()=>{proc.kill();await fs.rm(dir,{recursive:true,force:true});});
 const base=`http://127.0.0.1:${port}`;
 let ready=false;for(let n=0;n<50;n++){try{const r=await request(base,'/api/health');if(r.ok){ready=true;break;}}catch{}await pause(80);}assert.ok(ready,'servidor iniciado');
 let r=await request(base,'/api/bootstrap');assert.equal((await r.json()).configured,false);
 r=await request(base,'/api/setup','POST',{pin:'nuestrohogar-123456',actor:'Edu'});assert.equal(r.status,201);const cookEdu=r.headers.get('set-cookie').split(';')[0];assert.ok(cookEdu);
 r=await request(base,'/api/login','POST',{pin:'incorrecto',actor:'Minerva'});assert.equal(r.status,401);
 r=await request(base,'/api/login','POST',{pin:'nuestrohogar-123456',actor:'Minerva'});assert.equal(r.status,200);const cookMinerva=r.headers.get('set-cookie').split(';')[0];
 r=await request(base,'/api/state','GET',undefined,cookMinerva);let state=await r.json();assert.equal(state.actor,'Minerva');assert.ok(state.tasks.length>=30);
 const t1=state.tasks.find(x=>x.id==='cama');assert.equal(t1.plan.practicas[0],'Minerva');
 r=await request(base,'/api/toggle','POST',{taskId:'cama',date:'2026-11-09',done:true},cookEdu);assert.equal(r.status,200);
 r=await request(base,'/api/state','GET',undefined,cookMinerva);state=await r.json();assert.equal(state.completions['cama@2026-11-09'].by,'Edu');
 r=await request(base,'/api/override','POST',{taskId:'cama',date:'2026-11-09',assignee:'Edu'},cookMinerva);assert.equal(r.status,200);
 r=await request(base,'/api/task','POST',{title:'Regar plantas',category:'Otros',frequency:'weekly',assignee:'Minerva',weekday:3,minutes:5},cookEdu);assert.equal(r.status,201);state=await r.json();assert.ok(state.tasks.some(t=>t.title==='Regar plantas'));
 r=await request(base,'/api/settings','PUT',{mode:'tarde'},cookMinerva);assert.equal(r.status,200);state=await r.json();assert.equal(state.settings.mode,'tarde');assert.equal(state.overrides['cama@2026-11-09'],'Edu');
 r=await request(base,'/api/setup','POST',{pin:'alguien-segundo',actor:'Edu'});assert.equal(r.status,409);
 r=await request(base,'/api/task','POST',{title:'Sin login',frequency:'daily',assignee:'Edu'},undefined);assert.equal(r.status,401);
});
