const $=sel=>document.querySelector(sel);
const $$=sel=>[...document.querySelectorAll(sel)];
const DAY=['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
const WEEKDAY=['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
const FREQ_ORDER=['daily','weekly','fortnightly','monthly','once'];
const DAY_GROUPS=[['daily','Todos los días'],['weekly','Esta semana'],['fortnightly','Cada 15 días'],['monthly','Una vez al mes'],['once','Puntuales']];
const ROUTINE_GROUPS=[['daily','Diarias'],['weekly','Semanales'],['fortnightly','Cada 15 días'],['monthly','Mensuales'],['once','Puntuales']];
const CAT_ORDER=['Orden','Cocina','Gatos','Suelos','Baños','Ropa','Limpieza profunda','Exterior','Otros'];
const CAT_EMOJI={Orden:'🧺',Cocina:'🍳',Gatos:'🐈',Suelos:'🧹','Baños':'🛁',Ropa:'👕','Limpieza profunda':'✨',Exterior:'🪴',Otros:'📌'};
const VIEW_LABEL={hoy:'Mi día',semana:'Calendario',rutinas:'Todas las tareas',actividad:'Actividad'};

const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const fromIso=s=>{const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d,12,0,0);};
const todayDate=()=>fromIso(iso(new Date()));
const addDays=(date,offset)=>{const d=fromIso(iso(date));d.setDate(d.getDate()+offset);return d;};
const monday=d=>addDays(d,-((d.getDay()+6)%7));
const dow=d=>(d.getDay()+6)%7;
const dateDiff=(a,b)=>Math.round((Date.UTC(a.getFullYear(),a.getMonth(),a.getDate())-Date.UTC(b.getFullYear(),b.getMonth(),b.getDate()))/86400000);
const weekNumber=d=>Math.floor(dateDiff(monday(d),fromIso('2026-11-09'))/7);
const safe=str=>String(str??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const prettyDate=(d,options={})=>new Intl.DateTimeFormat('es-ES',options).format(d);
const capitalize=s=>s.charAt(0).toUpperCase()+s.slice(1);
const icon=(name,cls='')=>`<svg class="ico${cls?' '+cls:''}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const emojiOf=t=>t.emoji&&t.emoji!=='✓'?t.emoji:(CAT_EMOJI[t.category]||'✓');
const avatar=who=>who==='Ambos'?'<span class="avatar-pair"><span class="avatar edu">E</span><span class="avatar minerva">M</span></span>':`<span class="avatar ${who==='Minerva'?'minerva':'edu'}">${who==='Minerva'?'M':'E'}</span>`;
const store={get(k){try{return localStorage.getItem(k);}catch{return null;}},set(k,v){try{localStorage.setItem(k,v);}catch{}}};
const isMobile=()=>matchMedia('(max-width: 899px)').matches;

let state=null,configured=false,view='hoy',frequencyFilter='all',assignContext=null,popKey=null,workdayDate=null,movedKeys=new Set();
let actor=store.get('hogar-actor')==='Minerva'?'Minerva':'Edu';
let personFilter=['Edu','Minerva'].includes(store.get('hogar-filter'))?store.get('hogar-filter'):'Todos';
let selected=todayDate(),lastToday=iso(new Date());
let pending=0,chain=Promise.resolve();

function notify(message,error=false){const el=$('#toast');el.textContent=message;el.className='toast show'+(error?' error':'');clearTimeout(notify.timer);notify.timer=setTimeout(()=>el.classList.remove('show'),3200);}
function sync(ok){$('#sync-label').textContent=ok?'Sincronizado':'Sin conexión';$('#sync-indicator').classList.toggle('off',!ok);$('#sync-state').classList.toggle('off',!ok);}
async function api(path,{method='GET',body}={}){
  const res=await fetch(path,{method,credentials:'same-origin',headers:{...(body?{'Content-Type':'application/json'}:{}),...(method!=='GET'?{'X-Hogar-Client':'1'}:{})},body:body?JSON.stringify(body):undefined});
  let data;try{data=await res.json();}catch{throw new Error('El servidor no responde');}
  if(!res.ok){if(res.status===401&&configured)displayAuth(true);throw new Error(data.error||'No se pudo guardar');}
  sync(true);return data;
}
function appVisible(){return !$('#app').hidden;}

async function init(){
  try{const b=await api('/api/bootstrap');configured=b.configured;if(b.actor)actor=b.actor;if(b.authenticated){await refresh();displayApp();}else displayAuth(configured);if(!b.productionReady)console.info('Atención: el alojamiento debe tener datos persistentes para compartir los cambios.');}
  catch(e){sync(false);notify('Error de conexión con el servidor',true);displayAuth(true);}
}
function displayAuth(isConfigured){
  $('#auth').hidden=false;$('#app').hidden=true;
  $('#auth-title').textContent=isConfigured?'Entrar en casa':'Crear nuestra casa';
  $('#auth-submit').innerHTML=(isConfigured?'Entrar':'Crear la casa')+icon('right','sm');
  $('#setup-explanation').hidden=isConfigured;
  $('#pin-label').textContent=isConfigured?'Código de acceso compartido':'Crea un código para ambos (mínimo 8 caracteres)';
  $('#access-code').value='';$('#auth-error').textContent='';
  $$('#actor-picker button').forEach(b=>{const on=b.dataset.actor===actor;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',on);});
}
function displayApp(){
  configured=true;$('#auth').hidden=true;$('#app').hidden=false;store.set('hogar-actor',actor);
  const minerva=actor==='Minerva';
  for(const id of ['side-name','top-name','more-name'])$('#'+id).textContent=actor;
  for(const id of ['side-avatar','top-avatar','more-avatar']){const el=$('#'+id);el.textContent=minerva?'M':'E';el.className='avatar '+(minerva?'minerva':'edu');}
  navigate(view);
}
async function refresh(){const s=await api('/api/state');if(pending>0)return;state=s;actor=s.actor;if(appVisible())render();}

// ---------- Lógica de tareas ----------
function orderTask(a,b){return CAT_ORDER.indexOf(a.category)-CAT_ORDER.indexOf(b.category)||a.title.localeCompare(b.title,'es');}
function occurs(t,d){switch(t.frequency){case 'daily':return true;case 'weekly':return t.weekday===dow(d);case 'fortnightly':return dateDiff(d,fromIso(t.anchorDate))>=0&&dateDiff(d,fromIso(t.anchorDate))%14===0;case 'monthly':return d.getDate()===t.monthDay;case 'once':return iso(d)===t.date;default:return false;}}
// ---------- Teletrabajo de Edu ----------
const teleDays=()=>state.teleworkDays||[1,4];
const isWorkday=d=>dow(d)<5;
const habitualPlace=d=>teleDays().includes(dow(d))?'casa':'oficina';
const placeOf=d=>(isWorkday(d)&&state.workdays?.[iso(d)])||habitualPlace(d);
// Reparto automático: cada tarea diaria depende de dónde está Edu ese día (oficina / casa, con los cambios puntuales)
// y del horario de Minerva (mañana / tarde / mañana + prácticas). El fin de semana tiene su propio reparto por horario.
const MINERVA_WEEK={manana:Array(5).fill('manana'),tarde:Array(5).fill('tarde'),practicas:['larga','larga','larga','larga','manana']};
function planned(t,d){
  const p=t.plan,mode=state.settings.mode,day=dow(d);if(!p)return t.assignee;
  if(!p.oficina)return (p[mode]||p.practicas)?.[day];
  if(day>4)return (p.finde[mode]||p.finde.practicas)[day-5];
  const minerva=(state.minervaWeek?.[mode]||MINERVA_WEEK[mode]||MINERVA_WEEK.practicas)[day];
  return p[placeOf(d)]?.[minerva];
}
function assigned(t,d){const key=`${t.id}@${iso(d)}`;if(state.overrides[key])return state.overrides[key];let a=planned(t,d)||t.assignee;return a==='Alterno'?(weekNumber(d)%2===0?'Edu':'Minerva'):a;}
function forPerson(t,d,who){if(!who||who==='Todos')return true;const a=assigned(t,d);return a===who||a==='Ambos';}
function tasksFor(d,who='Todos'){return state.tasks.filter(t=>occurs(t,d)&&forPerson(t,d,who)).sort((a,b)=>FREQ_ORDER.indexOf(a.frequency)-FREQ_ORDER.indexOf(b.frequency)||orderTask(a,b));}
function completed(t,d){return Boolean(state.completions[`${t.id}@${iso(d)}`]);}
function percentage(list,d){const must=list.filter(t=>!t.optional);const done=must.filter(t=>completed(t,d)).length;return must.length?Math.round(done*100/must.length):100;}

// ---------- Navegación ----------
function navigate(next){
  view=next;$('#app').dataset.view=view;
  $$('.view').forEach(e=>e.hidden=e.id!==`view-${view}`);
  $$('[data-view]').forEach(e=>e.classList.toggle('active',e.dataset.view===view));
  $$('[data-mobile-view]').forEach(e=>{const on=e.dataset.mobileView===view;e.classList.toggle('active',on);if(on)e.setAttribute('aria-current','page');else e.removeAttribute('aria-current');});
  $('#crumb').textContent=VIEW_LABEL[view];
  render();window.scrollTo({top:0,behavior:'instant'});
}
function render(){if(!state)return;$('#mode-select').value=state.settings.mode;if(view==='hoy')renderToday();if(view==='semana')renderWeek();if(view==='rutinas')renderRoutines();if(view==='actividad')renderActivity();}

// ---------- Mi día ----------
function greetingWord(){const h=new Date().getHours();return h<6?'Buenas noches':h<13?'Buenos días':h<21?'Buenas tardes':'Buenas noches';}
function dayEyebrow(d){const diff=dateDiff(d,todayDate());if(diff===0)return'Hoy';if(diff===1)return'Mañana';if(diff===-1)return'Ayer';return diff>0?`Dentro de ${diff} días`:`Hace ${-diff} días`;}
function renderToday(){
  const todayIso=iso(new Date()),selIso=iso(selected),isToday=selIso===todayIso;
  $('#hero-eyebrow').textContent=`${greetingWord()}, ${actor}`;
  $('#greeting').innerHTML=isToday?'Qué bien estar <em>en casa.</em>':`${safe(capitalize(prettyDate(selected,{weekday:'long'})))} <em>en casa.</em>`;
  $('#day-eyebrow').textContent=dayEyebrow(selected);
  $('#today-title').textContent=capitalize(prettyDate(selected,{weekday:'long',day:'numeric',month:'long'}));
  $('#today-day').hidden=isToday;
  renderWorkday();

  const anchor=monday(selected);
  $('#week-strip').innerHTML=Array.from({length:7},(_,i)=>{
    const d=addDays(anchor,i),k=iso(d),pct=percentage(tasksFor(d),d),on=k===selIso;
    return `<button class="day-chip${on?' active':''}${k===todayIso?' today':''}" data-date="${k}" aria-pressed="${on}" aria-label="${safe(prettyDate(d,{weekday:'long',day:'numeric'}))}, ${pct}% hecho"><span>${DAY[i]}</span><strong>${d.getDate()}</strong><i class="chip-bar"><b style="width:${pct}%"></b></i></button>`;
  }).join('');

  const full=tasksFor(selected);
  const remaining=who=>full.filter(t=>!completed(t,selected)&&forPerson(t,selected,who)).length;
  $$('#person-filters button').forEach(b=>{const who=b.dataset.person,on=who===personFilter,n=remaining(who);b.classList.toggle('active',on);b.setAttribute('aria-pressed',on);b.setAttribute('aria-label',`${who}: ${n} pendientes`);b.innerHTML=`${who}<span class="count">${n}</span>`;});

  const list=tasksFor(selected,personFilter);
  $('#day-tasks').innerHTML=list.length?DAY_GROUPS.map(([f,title])=>{
    const items=list.filter(t=>t.frequency===f);if(!items.length)return'';
    const done=items.filter(t=>completed(t,selected)).length;
    return `<div class="task-section-header"><strong>${title}</strong><span>${done}/${items.length}</span></div><div class="task-group">${items.map(t=>renderRow(t,selected)).join('')}</div>`;
  }).join(''):'<div class="empty-state"><span class="big">🌷</span><b>Todo despejado</b>No hay tareas para este filtro.</div>';

  const must=full.filter(t=>!t.optional),done=must.filter(t=>completed(t,selected)).length,pct=percentage(full,selected);
  const wheel=$('#progress-wheel');wheel.style.setProperty('--pct',pct+'%');wheel.setAttribute('aria-label',`${pct}% del día completado`);
  $('#progress-percent').textContent=pct+'%';
  $('#progress-count').textContent=`${done} de ${must.length} hechas`;
  $('#progress-copy').textContent=pct===100?'¡Todo listo!':pct>=60?'¡Casi lo tenéis!':pct>=20?'¡Buen ritmo!':'¡Vamos a ello!';

  $('#people-progress').innerHTML=['Edu','Minerva'].map(who=>{
    let tasks=0,complete=0;
    for(let i=0;i<7;i++){const d=addDays(anchor,i);for(const t of tasksFor(d,who).filter(t=>!t.optional)){tasks++;if(completed(t,d))complete++;}}
    const p=tasks?Math.round(complete*100/tasks):100;
    return `<div class="person-stat"><div class="stat-top">${avatar(who)}<strong>${who}</strong><small>${complete} / ${tasks}</small></div><div class="bar-track"><div class="bar-fill ${who.toLowerCase()}" style="width:${p}%"></div></div></div>`;
  }).join('');
}
function renderWorkday(){
  const chip=$('#workday-chip');chip.hidden=!isWorkday(selected);if(chip.hidden)return;
  const place=placeOf(selected),changed=place!==habitualPlace(selected),home=place==='casa';
  chip.className=`workday-chip ${place}${changed?' changed':''}`;
  chip.setAttribute('aria-label',`Edu ${home?'teletrabaja':'va a la oficina'} este día${changed?' (cambio puntual)':''}. Cambiar`);
  chip.innerHTML=`${icon(home?'home':'briefcase')}<span>${home?'Edu en casa':'Edu en la oficina'}</span>${changed?'<span class="tag">Puntual</span>':''}${icon('down','xs')}`;
}
function renderRow(t,d){
  const k=iso(d),key=`${t.id}@${k}`,done=completed(t,d),person=assigned(t,d),by=state.completions[key]?.by;
  const meta=[t.category,`${Number(t.minutes)||10} min`];if(t.optional)meta.push('Si hace falta');if(done&&by)meta.push(`Hecho por ${by}`);
  return `<div class="task-row${done?' done':''}${popKey===key?' pop':''}">`+
    `<button class="task-hit" data-toggle="${safe(t.id)}" data-date="${k}" aria-pressed="${done}"><span class="task-check">${icon('check')}</span><span class="task-emoji" aria-hidden="true">${safe(emojiOf(t))}</span><span class="task-main"><strong>${safe(t.title)}</strong><small>${safe(meta.join(' · '))}</small></span></button>`+
    `<button class="task-owner ${person.toLowerCase()}${movedKeys.has(key)?' moved':''}" data-reassign="${safe(t.id)}" data-date="${k}" aria-label="Responsable: ${safe(person)}. Cambiar solo este día">${avatar(person)}<span class="owner-name">${safe(person)}</span>${icon('down','xs')}</button></div>`;
}
function shiftDay(n){
  selected=addDays(selected,n);render();
  const el=$('#day-tasks');el.classList.remove('slide-left','slide-right');void el.offsetWidth;el.classList.add(n>0?'slide-left':'slide-right');
}

// ---------- Semana ----------
function renderWeek(){
  const start=monday(selected),end=addDays(start,6),todayIso=iso(new Date());
  $('#week-heading').textContent=`${start.getDate()} ${prettyDate(start,{month:'short'})} – ${end.getDate()} ${prettyDate(end,{month:'short'})}`;
  $('#current-week').disabled=iso(monday(todayDate()))===iso(start);
  $('#calendar-grid').innerHTML=Array.from({length:7},(_,i)=>{
    const d=addDays(start,i),k=iso(d),tasks=tasksFor(d),pct=percentage(tasks,d),doneCount=tasks.filter(t=>completed(t,d)).length;
    const people=['Edu','Minerva'].map(who=>{const mine=tasks.filter(t=>forPerson(t,d,who));return `<span class="cal-person">${avatar(who)}${mine.filter(t=>completed(t,d)).length}/${mine.length}</span>`;}).join('');
    const w=isWorkday(d)&&state.workdays?.[k],tag=w?`<span class="cal-tag">${icon(w==='casa'?'home':'briefcase')}${w==='casa'?'Edu en casa':'Edu en oficina'}</span>`:'';
    const items=tasks.slice(0,8).map(t=>`<div class="cal-item${completed(t,d)?' done':''}">${safe(t.title)}</div>`).join('')+(tasks.length>8?`<div class="cal-more">+ ${tasks.length-8} tareas más</div>`:'');
    return `<button class="calendar-day${k===todayIso?' is-today':''}" data-calendar-date="${k}" aria-label="${safe(prettyDate(d,{weekday:'long',day:'numeric',month:'long'}))}: ${doneCount} de ${tasks.length} hechas">`+
      `<div class="cal-head"><span class="cal-dow">${DAY[i]}</span><strong class="cal-num">${d.getDate()}</strong></div>`+
      `<div class="cal-body"><div class="cal-summary"><span>${doneCount} de ${tasks.length} hechas</span><b>${pct}%</b></div><div class="cal-progress"><i style="width:${pct}%"></i></div><div class="cal-people">${people}${tag}</div><div class="cal-items">${items}</div></div>`+
      `${icon('right','cal-chevron')}</button>`;
  }).join('');
}

// ---------- Todas las tareas ----------
function schedule(t){switch(t.frequency){case'daily':return'Cada día';case'weekly':return`Cada ${WEEKDAY[t.weekday].toLowerCase()}`;case'fortnightly':return`Cada 15 días desde el ${prettyDate(fromIso(t.anchorDate),{day:'numeric',month:'short'})}`;case'monthly':return`Día ${t.monthDay} de cada mes`;case'once':return capitalize(prettyDate(fromIso(t.date),{weekday:'short',day:'numeric',month:'short'}));default:return'';}}
function routineRow(t){
  const who=t.plan?'Según horario':t.assignee,fixed=['Edu','Minerva','Ambos'].includes(who);
  const meta=[schedule(t),`${Number(t.minutes)||10} min`];if(!fixed)meta.push(who);if(t.optional)meta.push('Opcional');
  const badge=fixed?`<span class="routine-who" aria-label="Responsable: ${safe(who)}">${avatar(who)}</span>`:`<span class="routine-who auto" aria-label="Responsable: ${safe(who)}">${icon('swap','sm')}</span>`;
  return `<button class="routine-card" data-edit="${safe(t.id)}"><span class="task-emoji" aria-hidden="true">${safe(emojiOf(t))}</span><span class="routine-copy"><strong>${safe(t.title)}</strong><small>${safe(meta.join(' · '))}</small></span>${badge}${icon('right','chev')}</button>`;
}
function renderRoutines(){
  $$('#frequency-filters button').forEach(e=>{const on=e.dataset.frequency===frequencyFilter;e.classList.toggle('selected',on);e.setAttribute('aria-pressed',on);});
  const html=ROUTINE_GROUPS.filter(([f])=>frequencyFilter==='all'||f===frequencyFilter).map(([f,title])=>{
    const items=state.tasks.filter(t=>t.frequency===f).sort(orderTask);if(!items.length)return'';
    return `<div class="task-section-header"><strong>${title}</strong><span>${items.length}</span></div><div class="task-group">${items.map(routineRow).join('')}</div>`;
  }).join('');
  $('#routine-list').innerHTML=html||'<div class="empty-state"><span class="big">🗂️</span><b>Nada por aquí</b>No hay tareas de esta frecuencia.</div>';
}

// ---------- Actividad ----------
function relTime(at){
  const date=new Date(at),secs=(Date.now()-date.getTime())/1000,rtf=new Intl.RelativeTimeFormat('es',{numeric:'auto'});
  if(secs<60)return'Ahora mismo';if(secs<3600)return rtf.format(-Math.round(secs/60),'minute');if(secs<86400)return rtf.format(-Math.round(secs/3600),'hour');
  if(secs<6*86400)return capitalize(rtf.format(-Math.round(secs/86400),'day'))+', '+prettyDate(date,{hour:'2-digit',minute:'2-digit'});
  return prettyDate(date,{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
}
function renderActivity(){
  const recent=[...state.activity].reverse().slice(0,40);
  $('#activity-list').innerHTML=recent.length?recent.map(a=>`<div class="activity-item">${avatar(a.actor)}<div><strong>${safe(a.message)}</strong><small>${safe(a.actor)} · ${safe(relTime(a.at))}</small></div></div>`).join(''):'<div class="empty-state"><span class="big">🌱</span><b>Aún no hay actividad</b>Aquí aparecerán las tareas completadas y los cambios que hagáis.</div>';
}

// ---------- Escrituras: actualización optimista + cola ----------
function write(path,method,body,success,optimistic){
  if(optimistic){optimistic();render();}
  pending++;
  chain=chain.then(async()=>{
    try{const next=await api(path,{method,body});pending--;if(pending===0){state=next;actor=next.actor;render();}if(success)notify(success);}
    catch(e){pending--;sync(false);notify(e.message,true);if(pending===0){try{await refresh();}catch{}}}
  });
  return chain;
}
function toggleTask(t,dateIso){
  const d=fromIso(dateIso),key=`${t.id}@${dateIso}`,done=!completed(t,d),before=percentage(tasksFor(d),d);
  popKey=done?key:null;
  write('/api/toggle','POST',{taskId:t.id,date:dateIso,done},null,()=>{if(done)state.completions[key]={by:actor,at:new Date().toISOString()};else delete state.completions[key];});
  popKey=null;
  if(done&&before<100&&percentage(tasksFor(d),d)===100)notify('¡Día completado! Buen trabajo en equipo 🎉');
}

// ---------- Hoja de tarea ----------
function openTask(t=null){
  $('#task-id').value=t?.id||'';
  $('#dialog-title').textContent=t?'Editar tarea':'Nueva tarea';
  $('#save-task').textContent=t?'Guardar cambios':'Crear tarea';
  $('#delete-task').hidden=!t;
  $('#task-title').value=t?.title||'';
  $('#task-category').value=t?.category||'Orden';
  const who=$('#task-assignee');who.querySelector('option[value=plan]')?.remove();
  if(t?.plan){who.insertAdjacentHTML('afterbegin','<option value="plan">Según horario (automático)</option>');who.value='plan';}else who.value=t?.assignee||actor;
  $('#task-frequency').value=t?.frequency||'weekly';
  $('#task-description').value=t?.description||'';
  $('#task-optional').checked=!!t?.optional;
  $('#task-minutes').value=t?.minutes||10;
  updateFrequencyExtra(t);
  $('#task-dialog').showModal();
  if(!t&&!isMobile())$('#task-title').focus();else $('#task-dialog').scrollTop=0;
}
function updateFrequencyExtra(t=null){
  const f=$('#task-frequency').value;let html='';
  if(f==='weekly'){const day=t?.frequency==='weekly'?t.weekday:dow(selected);html='<label for="task-weekday">Día de la semana</label><select id="task-weekday">'+WEEKDAY.map((name,i)=>`<option value="${i}" ${day===i?'selected':''}>${name}</option>`).join('')+'</select>';}
  else if(f==='fortnightly'){html=`<label for="task-anchor">Primera fecha</label><input id="task-anchor" type="date" value="${safe(t?.anchorDate||iso(selected))}">`;}
  else if(f==='monthly'){html=`<label for="task-monthday">Día del mes (1–28)</label><input id="task-monthday" type="number" inputmode="numeric" min="1" max="28" value="${Number(t?.monthDay)||Math.min(selected.getDate(),28)}">`;}
  else if(f==='once'){html=`<label for="task-date">Fecha</label><input id="task-date" type="date" value="${safe(t?.date||iso(selected))}">`;}
  else html='<p class="small-note">Se repetirá todos los días.</p>';
  $('#frequency-extra').innerHTML=html;
}
async function saveTask(){
  const id=$('#task-id').value,freq=$('#task-frequency').value;
  const who=$('#task-assignee').value;
  const body={title:$('#task-title').value.trim(),category:$('#task-category').value,assignee:who==='plan'?'Alterno':who,keepPlan:who==='plan',frequency:freq,description:$('#task-description').value,optional:$('#task-optional').checked,minutes:Number($('#task-minutes').value)};
  if(!body.title)return notify('Ponle un nombre a la tarea',true);
  if(freq==='weekly')body.weekday=Number($('#task-weekday').value);
  if(freq==='fortnightly')body.anchorDate=$('#task-anchor').value;
  if(freq==='monthly')body.monthDay=Number($('#task-monthday').value);
  if(freq==='once')body.date=$('#task-date').value;
  $('#task-dialog').close();
  await write(id?`/api/task/${encodeURIComponent(id)}`:'/api/task',id?'PUT':'POST',body,id?'Tarea actualizada':'Tarea creada');
}
function openWorkday(){
  if(!isWorkday(selected))return;
  const d=selected,place=placeOf(d),habitual=habitualPlace(d);workdayDate=iso(d);
  $('#workday-date').textContent=capitalize(prettyDate(d,{weekday:'long',day:'numeric',month:'long'}));
  for(const p of ['casa','oficina'])$('#hint-'+p).textContent=p===habitual?`Lo habitual los ${WEEKDAY[dow(d)].toLowerCase()}`:'Cambio puntual, solo este día';
  $$('#workday-dialog [data-place]').forEach(b=>{const on=b.dataset.place===place;b.classList.toggle('current',on);b.setAttribute('aria-pressed',on);});
  $('#workday-dialog').showModal();
}
function setWorkday(place){
  const date=workdayDate;workdayDate=null;$('#workday-dialog').close();
  if(!date)return;const d=fromIso(date);if(place===placeOf(d))return;
  // Se calcula qué tareas cambian de responsable para avisarlo y resaltarlas.
  const saved=state.workdays||{},next={...saved};if(place===habitualPlace(d))delete next[date];else next[date]=place;
  const daily=state.tasks.filter(t=>t.plan&&occurs(t,d)),before=daily.map(t=>assigned(t,d));
  state.workdays=next;const moved=daily.filter((t,i)=>assigned(t,d)!==before[i]);state.workdays=saved;
  const day=prettyDate(d,{weekday:'long'}),label=place===habitualPlace(d)?`Vuelve lo habitual el ${day}`:`${place==='casa'?'Edu teletrabaja':'Edu va a la oficina'} el ${day}`;
  const msg=`${label} · ${moved.length?`${moved.length} ${moved.length===1?'tarea reasignada':'tareas reasignadas'}`:'sin cambios en el reparto'}`;
  movedKeys=new Set(moved.map(t=>`${t.id}@${date}`));
  write('/api/workday','POST',{date,place},msg,()=>{state.workdays=next;});
  movedKeys=new Set();
}
function openAssign(t,dateIso){
  const d=fromIso(dateIso),current=assigned(t,d);
  assignContext={id:t.id,date:dateIso};
  $('#assign-copy').innerHTML=`<span class="task-emoji" aria-hidden="true">${safe(emojiOf(t))}</span><span><strong>${safe(t.title)}</strong><small>${safe(capitalize(prettyDate(d,{weekday:'long',day:'numeric',month:'long'})))}</small></span>`;
  $$('#assign-dialog [data-assign]').forEach(b=>{const on=b.dataset.assign===current;b.classList.toggle('current',on);b.setAttribute('aria-pressed',on);});
  $('#assign-dialog').showModal();
}
function enableSheet(dlg){
  dlg.addEventListener('click',e=>{if(e.target===dlg)dlg.close();});
  const head=dlg.querySelector('.dialog-head');let startY=null,dy=0;
  head.addEventListener('touchstart',e=>{if(!isMobile()||e.target.closest('button'))return;startY=e.touches[0].clientY;dy=0;dlg.classList.add('dragging');},{passive:true});
  head.addEventListener('touchmove',e=>{if(startY===null)return;dy=Math.max(0,e.touches[0].clientY-startY);dlg.style.transform=`translateY(${dy}px)`;},{passive:true});
  const end=()=>{if(startY===null)return;startY=null;dlg.classList.remove('dragging');if(dy>90)dlg.close();dlg.classList.add('settling');dlg.style.transform='';setTimeout(()=>dlg.classList.remove('settling'),260);};
  head.addEventListener('touchend',end);head.addEventListener('touchcancel',end);
}

async function login(evt){
  evt.preventDefault();const pin=$('#access-code').value,btn=$('#auth-submit');btn.disabled=true;
  try{const result=await api(configured?'/api/login':'/api/setup',{method:'POST',body:{pin,actor}});actor=result.actor;await refresh();displayApp();notify(`¡Hola, ${actor}!`);}
  catch(e){$('#auth-error').textContent=e.message;}
  finally{btn.disabled=false;}
}
async function logout(){try{await api('/api/logout',{method:'POST'});}catch{}finally{state=null;displayAuth(true);}}
function onSwipe(el,handler){
  let s=null;
  el.addEventListener('touchstart',e=>{const p=e.touches[0];s={x:p.clientX,y:p.clientY,t:Date.now()};},{passive:true});
  el.addEventListener('touchend',e=>{if(!s)return;const p=e.changedTouches[0],dx=p.clientX-s.x,dy=p.clientY-s.y,dt=Date.now()-s.t;s=null;if(Math.abs(dx)>70&&Math.abs(dy)<45&&dt<700)handler(dx<0?1:-1);},{passive:true});
}

function attach(){
  $('#auth-form').addEventListener('submit',login);
  $('#actor-picker').addEventListener('click',e=>{const btn=e.target.closest('[data-actor]');if(!btn)return;actor=btn.dataset.actor;$$('#actor-picker button').forEach(x=>{const on=x===btn;x.classList.toggle('selected',on);x.setAttribute('aria-pressed',on);});});
  for(const id of ['switch-profile','more-logout'])$('#'+id).addEventListener('click',logout);
  $('#top-profile').addEventListener('click',()=>navigate('actividad'));
  $$('[data-view]').forEach(e=>e.addEventListener('click',()=>navigate(e.dataset.view)));
  $$('[data-mobile-view]').forEach(e=>e.addEventListener('click',()=>navigate(e.dataset.mobileView)));
  $$('[data-goto]').forEach(e=>e.addEventListener('click',()=>navigate(e.dataset.goto)));
  $('#week-strip').addEventListener('click',e=>{const button=e.target.closest('[data-date]');if(button){selected=fromIso(button.dataset.date);render();}});
  $('#day-tasks').addEventListener('click',e=>{
    const toggle=e.target.closest('[data-toggle]');
    if(toggle){const t=state.tasks.find(x=>x.id===toggle.dataset.toggle);if(t)toggleTask(t,toggle.dataset.date);return;}
    const owner=e.target.closest('[data-reassign]');
    if(owner){const t=state.tasks.find(x=>x.id===owner.dataset.reassign);if(t)openAssign(t,owner.dataset.date);}
  });
  onSwipe($('#day-tasks'),shiftDay);
  onSwipe($('#week-strip'),n=>shiftDay(n*7));
  $('#person-filters').addEventListener('click',e=>{const btn=e.target.closest('[data-person]');if(btn){personFilter=btn.dataset.person;store.set('hogar-filter',personFilter);renderToday();}});
  $('#prev-day').addEventListener('click',()=>shiftDay(-1));
  $('#next-day').addEventListener('click',()=>shiftDay(1));
  $('#today-day').addEventListener('click',()=>{selected=todayDate();render();});
  $('#prev-week').addEventListener('click',()=>{selected=addDays(selected,-7);render();});
  $('#next-week').addEventListener('click',()=>{selected=addDays(selected,7);render();});
  $('#current-week').addEventListener('click',()=>{selected=todayDate();render();});
  $('#calendar-grid').addEventListener('click',e=>{const btn=e.target.closest('[data-calendar-date]');if(btn){selected=fromIso(btn.dataset.calendarDate);navigate('hoy');}});
  for(const id of ['new-task-hero','new-task-today','new-task-week','new-task-routines','fab-add'])$('#'+id).addEventListener('click',()=>openTask());
  $('#frequency-filters').addEventListener('click',e=>{const btn=e.target.closest('[data-frequency]');if(btn){frequencyFilter=btn.dataset.frequency;renderRoutines();btn.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'});}});
  $('#routine-list').addEventListener('click',e=>{const edit=e.target.closest('[data-edit]');if(edit){const t=state.tasks.find(x=>x.id===edit.dataset.edit);if(t)openTask(t);}});
  $('#task-frequency').addEventListener('change',()=>{const id=$('#task-id').value;updateFrequencyExtra(id?state.tasks.find(t=>t.id===id):null);});
  $('#task-form').addEventListener('submit',e=>{e.preventDefault();saveTask();});
  for(const id of ['close-dialog','cancel-task'])$('#'+id).addEventListener('click',()=>$('#task-dialog').close());
  $('#delete-task').addEventListener('click',async()=>{
    const id=$('#task-id').value,t=state.tasks.find(x=>x.id===id);if(!t)return;
    if(!confirm(`¿Eliminar “${t.title}” de vuestro calendario?`))return;
    $('#task-dialog').close();await write(`/api/task/${encodeURIComponent(id)}`,'DELETE',undefined,'Tarea eliminada');
  });
  $('#assign-close').addEventListener('click',()=>$('#assign-dialog').close());
  $('#assign-dialog').addEventListener('click',e=>{
    const b=e.target.closest('[data-assign]');if(!b||!assignContext)return;
    const c=assignContext,who=b.dataset.assign;assignContext=null;$('#assign-dialog').close();
    write('/api/override','POST',{taskId:c.id,date:c.date,assignee:who},`Ahora se encarga ${who==='Ambos'?'los dos':who}`,()=>{state.overrides[`${c.id}@${c.date}`]=who;});
  });
  $('#workday-chip').addEventListener('click',openWorkday);
  $('#workday-close').addEventListener('click',()=>$('#workday-dialog').close());
  $('#workday-dialog').addEventListener('click',e=>{const b=e.target.closest('[data-place]');if(b)setWorkday(b.dataset.place);});
  enableSheet($('#task-dialog'));enableSheet($('#assign-dialog'));enableSheet($('#workday-dialog'));
  $('#mode-select').addEventListener('change',e=>{const mode=e.target.value;write('/api/settings','PUT',{mode},'Horario actualizado',()=>{state.settings.mode=mode;});});
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState!=='visible')return;
    const now=iso(new Date());if(now!==lastToday){if(iso(selected)===lastToday)selected=fromIso(now);lastToday=now;}
    if(appVisible())refresh().catch(()=>sync(false));
  });
  setInterval(()=>{if(document.visibilityState==='visible'&&appVisible()&&pending===0&&!$$('dialog').some(x=>x.open))refresh().catch(()=>sync(false));},12000);
}
attach();init();
