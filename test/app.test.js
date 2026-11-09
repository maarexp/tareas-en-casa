import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {fileURLToPath} from 'node:url';
import {createInitialState,upgradeState,PLAN_VERSION} from '../data-seed.js';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function freePort(){return new Promise((resolve,reject)=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});s.on('error',reject);});}
async function request(base,path,method='GET',body,cookie){return fetch(base+path,{method,headers:{...(body?{'content-type':'application/json'}:{}),...(method!=='GET'?{'x-hogar-client':'1'}:{}),...(cookie?{cookie}:{})},body:body?JSON.stringify(body):undefined});}
test('flujo compartido: crear casa, entrar, marcar, reasignar, añadir y cambiar horario',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'hogar-test-'));const port=await freePort();
 const proc=spawn(process.execPath,['server.js'],{cwd:fileURLToPath(new URL('..',import.meta.url)),env:{...process.env,DATA_FILE:path.join(dir,'data.json'),PORT:String(port),APP_SECRET:'test-very-long-secret-just-for-tests-1234567'},stdio:'ignore'});
 t.after(async()=>{proc.kill();await fs.rm(dir,{recursive:true,force:true});});
 const base=`http://127.0.0.1:${port}`;
 let ready=false;for(let n=0;n<50;n++){try{const r=await request(base,'/api/health');if(r.ok){ready=true;break;}}catch{}await pause(80);}assert.ok(ready,'servidor iniciado');
 let r=await request(base,'/api/bootstrap');assert.equal((await r.json()).configured,false);
 r=await request(base,'/api/setup','POST',{pin:'nuestrohogar-123456',actor:'Edu'});assert.equal(r.status,201);const cookEdu=r.headers.get('set-cookie').split(';')[0];assert.ok(cookEdu);
 r=await request(base,'/api/login','POST',{pin:'incorrecto',actor:'Minerva'});assert.equal(r.status,401);
 r=await request(base,'/api/login','POST',{pin:'nuestrohogar-123456',actor:'Minerva'});assert.equal(r.status,200);const cookMinerva=r.headers.get('set-cookie').split(';')[0];
 r=await request(base,'/api/state','GET',undefined,cookMinerva);let state=await r.json();assert.equal(state.actor,'Minerva');assert.ok(state.tasks.length>=30);
 const t1=state.tasks.find(x=>x.id==='cama');assert.equal(t1.plan.oficina.larga,'Minerva');assert.equal(t1.plan.casa.manana,'Edu');assert.deepEqual(state.minervaWeek.practicas,['larga','larga','larga','larga','manana','manana']);assert.equal(state.tasks.find(x=>x.id==='recoger-cocina').plan.oficina.larga,'Minerva');
 r=await request(base,'/api/toggle','POST',{taskId:'cama',date:'2026-11-09',done:true},cookEdu);assert.equal(r.status,200);
 r=await request(base,'/api/state','GET',undefined,cookMinerva);state=await r.json();assert.equal(state.completions['cama@2026-11-09'].by,'Edu');
 r=await request(base,'/api/override','POST',{taskId:'cama',date:'2026-11-09',assignee:'Edu'},cookMinerva);assert.equal(r.status,200);
 r=await request(base,'/api/task','POST',{title:'Regar plantas',category:'Otros',frequency:'weekly',assignee:'Minerva',weekday:3,minutes:5},cookEdu);assert.equal(r.status,201);state=await r.json();assert.ok(state.tasks.some(t=>t.title==='Regar plantas'));
 r=await request(base,'/api/settings','PUT',{mode:'tarde'},cookMinerva);assert.equal(r.status,200);state=await r.json();assert.equal(state.settings.mode,'tarde');assert.equal(state.overrides['cama@2026-11-09'],'Edu');
 // Cambios puntuales de teletrabajo: miércoles en casa, martes en la oficina, sábado no permitido y vuelta a lo habitual.
 const near=n=>{const d=new Date();d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
 const nextDow=dw=>{for(let n=1;n<=7;n++){const s=near(n);if((new Date(s+'T12:00:00Z').getUTCDay()+6)%7===dw)return s;}};
 const wed=nextDow(2),tue=nextDow(1),sat=nextDow(5);
 r=await request(base,'/api/workday','POST',{date:wed,place:'casa'},cookMinerva);assert.equal(r.status,200);state=await r.json();assert.equal(state.workdays[wed],'casa');assert.deepEqual(state.teleworkDays,[1,4]);
 r=await request(base,'/api/workday','POST',{date:tue,place:'oficina'},cookEdu);state=await r.json();assert.equal(state.workdays[tue],'oficina');
 r=await request(base,'/api/workday','POST',{date:tue,place:'casa'},cookEdu);state=await r.json();assert.equal(state.workdays[tue],undefined,'lo habitual no se guarda como excepción');
 r=await request(base,'/api/workday','POST',{date:wed,place:null},cookEdu);state=await r.json();assert.equal(state.workdays[wed],undefined);
 r=await request(base,'/api/workday','POST',{date:sat,place:'casa'},cookEdu);assert.equal(r.status,400);
 r=await request(base,'/api/workday','POST',{date:wed,place:'playa'},cookEdu);assert.equal(r.status,400);
 assert.ok(state.activity.some(a=>a.message.startsWith('Edu teletrabaja el ')));
 r=await request(base,'/api/setup','POST',{pin:'alguien-segundo',actor:'Edu'});assert.equal(r.status,409);
 r=await request(base,'/api/task','POST',{title:'Sin login',frequency:'daily',assignee:'Edu'},undefined);assert.equal(r.status,401);
});
test('migración: una casa antigua recibe el reparto por disponibilidad sin perder lo demás',()=>{
 const old=JSON.parse(JSON.stringify(createInitialState({salt:'s',pinHash:'h'})));delete old.planVersion;
 const cama=old.tasks.find(t=>t.id==='cama');cama.plan={practicas:['Minerva','Edu','Minerva','Minerva','Edu','Edu','Alterno'],manana:['Minerva','Edu','Minerva','Minerva','Edu','Edu','Alterno'],tarde:['Minerva','Edu','Minerva','Minerva','Edu','Edu','Alterno']};cama.description='Lunes, miércoles y jueves Minerva; martes, viernes y sábado Edu; domingo se alterna.';
 const cena=old.tasks.find(t=>t.id==='cena-tupper');cena.title='Cena y táper';
 const fija=old.tasks.find(t=>t.id==='orden-salon');delete fija.plan;fija.assignee='Minerva';
 old.completions['cama@2026-11-09']={by:'Edu',at:'x'};old.overrides['basura@2026-11-10']='Ambos';
 assert.equal(upgradeState(old),true);assert.equal(old.planVersion,PLAN_VERSION);
 assert.equal(cama.plan.practicas,undefined);assert.deepEqual(cama.plan.oficina,{manana:'Minerva',tarde:'Minerva',larga:'Minerva'});assert.equal(cama.plan.domingo,'Edu');assert.ok(cama.description.startsWith('La hace quien'));
 assert.equal(cena.title,'Cena y táper');assert.equal(fija.plan,undefined);assert.equal(fija.assignee,'Minerva');
 assert.ok(old.completions['cama@2026-11-09']);assert.equal(old.overrides['basura@2026-11-10'],'Ambos');
 assert.equal(upgradeState(old),false,'solo se aplica una vez');
 // Una casa ya migrada a la v2 (fin de semana fijo, Edu recogía con prácticas) también se actualiza
 const v2=JSON.parse(JSON.stringify(createInitialState({salt:'s',pinHash:'h'})));v2.planVersion=2;
 const rec=v2.tasks.find(t=>t.id==='recoger-cocina');rec.plan={oficina:{manana:'Edu',tarde:'Minerva',larga:'Edu'},casa:{manana:'Minerva',tarde:'Minerva',larga:'Edu'},finde:{manana:['Edu','Minerva'],tarde:['Edu','Edu'],practicas:['Edu','Edu']}};rec.description='Normalmente quien no cocina; con prácticas, de lunes a jueves lo hace Edu.';
 assert.equal(upgradeState(v2),true);assert.equal(rec.plan.oficina.larga,'Minerva');assert.equal(rec.plan.finde,undefined);assert.equal(rec.description,'Normalmente se encarga quien no cocina.');
});
