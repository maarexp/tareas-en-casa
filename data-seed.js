const modes = {
  practicas: 'Mañana + prácticas L–J',
  manana: 'Mañana (8:15–16:00)',
  tarde: 'Tarde (14:00–20:30)'
};
// ---------------------------------------------------------------------------
// Reparto automático de las tareas diarias según quién está en casa cada día.
//  · Edu: «oficina» (sale 6:30, vuelve 19:30) los lunes, miércoles y jueves; «casa» (teletrabajo) martes y viernes.
//    Un día suelto se puede cambiar desde la app (state.workdays). El sábado no trabaja: cuenta como «casa».
//  · Minerva trabaja de lunes a sábado. De lunes a viernes, según el horario elegido:
//      manana → sale ~8:15 y está en casa desde las 16:00.
//      tarde  → en casa por la mañana; fuera de 14:00 a 20:30.
//      larga  → mañana + prácticas (L–J): fuera de ~8:15 a ~20:30; tareas cortas antes de salir y recoger la cena.
//    Con prácticas, el viernes es solo de mañana. El sábado trabaja siempre de ~9:15 a ~15:20: cuenta como día de mañana.
//  · Domingo: los dos libres; a medias (Edu cocina y prepara el táper del lunes; Minerva recoge y hace lo demás).
//  · En todos los casos recoge la cocina quien no ha cocinado.
// ---------------------------------------------------------------------------
export const MINERVA_WEEK = {
  manana: ['manana','manana','manana','manana','manana','manana'],
  tarde: ['tarde','tarde','tarde','tarde','tarde','manana'],
  practicas: ['larga','larga','larga','larga','manana','manana']
};
const WHO = {E:'Edu', M:'Minerva', A:'Ambos', '~':'Alterno'};
const who = letters => [...letters].map(c => WHO[c]);
// oficina / casa: quién la hace con Minerva de [mañana, tarde, prácticas]; domingo: quién la hace ese día.
const plan = (oficina, casa, domingo) => {
  const [om,ot,ol] = who(oficina), [cm,ct,cl] = who(casa);
  return {oficina:{manana:om,tarde:ot,larga:ol}, casa:{manana:cm,tarde:ct,larga:cl}, domingo:WHO[domingo]};
};
const task = (id, title, category, frequency, assignee, options={}) => ({id,title,category,frequency,assignee,optional:false,...options});
const daily = (id,title,category,p,options={}) => task(id,title,category,'daily','Alterno',{plan:p,...options});
const seedTasks = [
  //                                                                       oficina  casa  domingo
  daily('cama','Hacer la cama','Orden',                                    plan('MMM','EMM','E'),{emoji:'🛏️',minutes:4,description:'La hace quien sale más tarde de casa (Edu sale a las 6:30 los días de oficina).'}),
  daily('suelo-abajo','Barrer o aspirar planta baja','Suelos',             plan('MME','EME','M'),{emoji:'🧹',minutes:9,description:'Mejor aspiradora con filtro HEPA o mopa para no levantar polvo.'}),
  daily('cena-tupper','Preparar cena + táper del día siguiente','Cocina',  plan('MEE','EEE','E'),{emoji:'🍲',minutes:35,description:'Siempre cocinar el día anterior para llevar la comida en táper. El domingo, preparar el lunes.'}),
  daily('recoger-cocina','Recoger encimera, platos y fregadero','Cocina',  plan('EMM','MMM','M'),{emoji:'🍽️',minutes:12,description:'Normalmente se encarga quien no cocina.'}),
  daily('orden-salon','Orden general: mantas, sofá y objetos','Orden',     plan('EEE','MEE','M'),{emoji:'🛋️',minutes:6}),
  daily('gatos-comida','Dar comida a los gatos (mañana y noche)','Gatos',  plan('MMM','MMM','M'),{emoji:'🐈',minutes:6,description:'Comprobar las dos tomas; si una persona no está, la otra la cubre.'}),
  daily('gatos-agua','Cambiar agua y comprobar bebederos','Gatos',         plan('MMM','EEM','E'),{emoji:'💧',minutes:3}),
  daily('gatos-areneros','Recoger areneros y revisar arena','Gatos',       plan('EMM','EEM','M'),{emoji:'🐾',minutes:7,description:'Retirar deposiciones a diario. Si se ensucia mucho, hacer un segundo repaso.'}),
  daily('basura','Revisar basura y reciclaje','Cocina',                    plan('EEE','MEE','~'),{emoji:'♻️',minutes:3,optional:true,description:'Sacar solo si hace falta.'}),
  task('bano-abajo','Limpiar baño de abajo','Baños','weekly','Edu',{weekday:4,emoji:'🚿',minutes:22}),
  task('bano-arriba','Limpiar baño de arriba','Baños','weekly','Minerva',{weekday:6,emoji:'🛁',minutes:22}),
  task('fregar-abajo','Fregar suelo de abajo','Suelos','weekly','Edu',{weekday:5,emoji:'🪣',minutes:18}),
  task('aspirar-arriba','Aspirar o pasar mopa planta de arriba','Suelos','weekly','Minerva',{weekday:5,emoji:'🧹',minutes:18}),
  task('escaleras','Limpiar peldaños de las escaleras','Suelos','weekly','Edu',{weekday:6,emoji:'🪜',minutes:15}),
  task('lavadora-1','Poner lavadora semanal','Ropa','weekly','Edu',{weekday:5,emoji:'👕',minutes:10,description:'Tender, recoger y guardar después de secar.'}),
  task('lavadora-2','Segunda lavadora si se necesita','Ropa','weekly','Minerva',{weekday:2,emoji:'🧺',minutes:10,optional:true}),
  task('sabanas','Cambiar sábanas','Ropa','weekly','Minerva',{weekday:6,emoji:'🛏️',minutes:14}),
  task('toallas','Cambiar y lavar toallas si toca','Ropa','weekly','Edu',{weekday:5,emoji:'🧻',minutes:7}),
  task('gatos-cuencos','Lavar cuencos y revisar material de gatos','Gatos','weekly','Edu',{weekday:6,emoji:'🐱',minutes:10}),
  task('menu-compra','Revisar menús y compra semanal','Cocina','weekly','Ambos',{weekday:6,emoji:'🛒',minutes:12}),
  task('repaso-cocina','Limpiar bien placa y encimeras','Cocina','weekly','Edu',{weekday:4,emoji:'✨',minutes:17}),
  task('juego-gatos','Jugar y revisar juguetes de los gatos','Gatos','weekly','Ambos',{weekday:5,emoji:'🪀',minutes:15,description:'Además del juego espontáneo de cada día.'}),
  task('puertas','Limpiar puertas e interruptores con paño húmedo','Limpieza profunda','fortnightly','Edu',{anchorDate:'2026-11-14',emoji:'🚪',minutes:20}),
  task('rodapies','Limpiar rodapiés y superficies con polvo','Limpieza profunda','fortnightly','Minerva',{anchorDate:'2026-11-15',emoji:'🧽',minutes:20,description:'Edu no realiza tareas de quitar el polvo por su alergia.'}),
  task('barandilla','Limpiar barandilla y pasamanos','Limpieza profunda','fortnightly','Edu',{anchorDate:'2026-11-21',emoji:'🪜',minutes:12}),
  task('mamparas','Mamparas, espejos y grifería','Baños','fortnightly','Edu',{anchorDate:'2026-11-22',emoji:'🪞',minutes:20}),
  task('microondas','Limpieza interior del microondas','Cocina','fortnightly','Edu',{anchorDate:'2026-11-14',emoji:'🍽️',minutes:12}),
  task('terraza','Barrer y limpiar terraza','Exterior','fortnightly','Edu',{anchorDate:'2026-11-21',emoji:'🪴',minutes:20}),
  task('areneros-fondo','Vaciar, lavar y secar areneros','Gatos','fortnightly','Edu',{anchorDate:'2026-11-22',emoji:'🐾',minutes:25,description:'Ajustar a tipo de arena y frecuencia real de uso.'}),
  task('textil-gatos','Lavar mantas y camas de los gatos','Gatos','fortnightly','Minerva',{anchorDate:'2026-11-15',emoji:'🐈',minutes:12}),
  task('cristales','Limpiar cristales de ventanas','Limpieza profunda','monthly','Edu',{monthDay:4,emoji:'🪟',minutes:30}),
  task('persianas','Marcos, guías y persianas con polvo','Limpieza profunda','monthly','Minerva',{monthDay:8,emoji:'🧽',minutes:30}),
  task('nevera','Limpiar nevera y revisar caducidades','Cocina','monthly','Edu',{monthDay:11,emoji:'🧊',minutes:25}),
  task('horno','Limpieza interior del horno','Cocina','monthly','Edu',{monthDay:16,emoji:'♨️',minutes:25}),
  task('campana','Limpiar campana y filtros según indicaciones','Cocina','monthly','Edu',{monthDay:20,emoji:'🍳',minutes:25}),
  task('lavadora-filtro','Cuidado de lavadora: goma, cajetín y filtro','Ropa','monthly','Edu',{monthDay:24,emoji:'🧺',minutes:20,description:'Seguir el manual de la lavadora; desenchufar antes de acceder al filtro.'}),
  task('sofa-profundo','Sofá: aspirar textiles y limpiar polvo','Limpieza profunda','monthly','Minerva',{monthDay:13,emoji:'🛋️',minutes:25}),
  task('armarios','Orden y repaso de armarios y estantes','Orden','monthly','Minerva',{monthDay:26,emoji:'📦',minutes:25}),
  task('rincones','Polvo en rincones altos y lámparas accesibles','Limpieza profunda','monthly','Minerva',{monthDay:18,emoji:'🪶',minutes:20}),
  task('gatos-inventario','Revisar pienso, arena, comederos y rascadores','Gatos','monthly','Ambos',{monthDay:27,emoji:'🐱',minutes:15})
];
// Versión del reparto. v2: según quién está en casa. v3: Minerva trabaja también el sábado y recoge la cena con prácticas.
export const PLAN_VERSION = 3;
// Descripciones de versiones anteriores que se actualizan si nadie las ha editado.
const OLD_DESCRIPTIONS = {
  cama:['Lunes, miércoles y jueves Minerva; martes, viernes y sábado Edu; domingo se alterna.'],
  'recoger-cocina':['Normalmente quien no cocina; con prácticas, de lunes a jueves lo hace Edu.']
};
// Actualiza una casa guardada con un reparto antiguo: sustituye el reparto automático de las tareas que lo conservan
// («Según horario»). No toca completados, reasignaciones manuales ni tareas editadas con responsable fijo.
export function upgradeState(state){
  if(!state||(state.planVersion||1)>=PLAN_VERSION) return false;
  for(const seed of seedTasks.filter(t=>t.plan)){
    const task=state.tasks.find(t=>t.id===seed.id);
    if(!task?.plan) continue;
    task.plan=JSON.parse(JSON.stringify(seed.plan));
    if(OLD_DESCRIPTIONS[seed.id]?.includes(task.description)) task.description=seed.description;
  }
  state.planVersion=PLAN_VERSION;
  return true;
}
export const createInitialState = ({salt,pinHash})=>({
  setup:{salt,pinHash},
  planVersion:PLAN_VERSION,
  settings:{mode:'practicas',updatedAt:new Date().toISOString()},
  tasks:seedTasks,
  completions:{},
  overrides:{},
  workdays:{},
  activity:[],
  createdAt:new Date().toISOString()
});
export { seedTasks, modes };
