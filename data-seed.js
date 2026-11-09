const modes = {
  practicas: 'Durante las prácticas',
  manana: 'Turno de mañana',
  tarde: 'Turno de tarde'
};
const task = (id, title, category, frequency, assignee, options={}) => ({id,title,category,frequency,assignee,optional:false,...options});
const daily = (id,title,category,plan,options={}) => task(id,title,category,'daily','Alterno',{plan,...options});
// Índices: lunes=0 ... domingo=6. "Alterno" alterna Edu/Minerva cada semana.
const seedTasks = [
  daily('cama','Hacer la cama','Orden',{
    practicas:['Minerva','Edu','Minerva','Minerva','Edu','Edu','Alterno'],
    manana:['Minerva','Edu','Minerva','Minerva','Edu','Edu','Alterno'],
    tarde:['Minerva','Edu','Minerva','Minerva','Edu','Edu','Alterno']
  },{emoji:'🛏️',minutes:4,description:'Lunes, miércoles y jueves Minerva; martes, viernes y sábado Edu; domingo se alterna.'}),
  daily('suelo-abajo','Barrer o aspirar planta baja','Suelos',{
    practicas:['Edu','Minerva','Edu','Edu','Edu','Minerva','Minerva'],
    manana:['Edu','Minerva','Edu','Minerva','Edu','Minerva','Edu'],
    tarde:['Minerva','Edu','Minerva','Edu','Edu','Minerva','Edu']
  },{emoji:'🧹',minutes:9,description:'Mejor aspiradora con filtro HEPA o mopa para no levantar polvo.'}),
  daily('cena-tupper','Preparar cena + táper del día siguiente','Cocina',{
    practicas:['Edu','Edu','Edu','Edu','Minerva','Minerva','Edu'],
    manana:['Minerva','Edu','Minerva','Edu','Minerva','Edu','Minerva'],
    tarde:['Edu','Edu','Edu','Edu','Edu','Minerva','Minerva']
  },{emoji:'🍲',minutes:35,description:'Siempre cocinar el día anterior para llevar la comida en táper. El domingo, preparar el lunes.'}),
  daily('recoger-cocina','Recoger encimera, platos y fregadero','Cocina',{
    practicas:['Minerva','Minerva','Minerva','Minerva','Edu','Edu','Minerva'],
    manana:['Edu','Minerva','Edu','Minerva','Edu','Minerva','Edu'],
    tarde:['Minerva','Minerva','Minerva','Minerva','Minerva','Edu','Edu']
  },{emoji:'🍽️',minutes:12,description:'Normalmente se encarga quien no cocina.'}),
  daily('orden-salon','Orden general: mantas, sofá y objetos','Orden',{
    practicas:['Minerva','Edu','Minerva','Edu','Edu','Minerva','Alterno'],
    manana:['Minerva','Edu','Minerva','Edu','Minerva','Edu','Alterno'],
    tarde:['Edu','Minerva','Edu','Minerva','Edu','Minerva','Alterno']
  },{emoji:'🛋️',minutes:6}),
  daily('gatos-comida','Dar comida a los gatos (mañana y noche)','Gatos',{
    practicas:['Minerva','Minerva','Minerva','Minerva','Minerva','Edu','Alterno'],
    manana:['Minerva','Minerva','Minerva','Minerva','Minerva','Edu','Alterno'],
    tarde:['Minerva','Minerva','Minerva','Minerva','Minerva','Edu','Alterno']
  },{emoji:'🐈',minutes:6,description:'Comprobar las dos tomas; si una persona no está, la otra la cubre.'}),
  daily('gatos-agua','Cambiar agua y comprobar bebederos','Gatos',{
    practicas:['Edu','Edu','Edu','Edu','Edu','Minerva','Alterno'],
    manana:['Edu','Edu','Edu','Edu','Edu','Minerva','Alterno'],
    tarde:['Edu','Edu','Edu','Edu','Edu','Minerva','Alterno']
  },{emoji:'💧',minutes:3}),
  daily('gatos-areneros','Recoger areneros y revisar arena','Gatos',{
    practicas:['Edu','Edu','Edu','Edu','Edu','Minerva','Alterno'],
    manana:['Edu','Edu','Edu','Edu','Edu','Minerva','Alterno'],
    tarde:['Edu','Edu','Edu','Edu','Edu','Minerva','Alterno']
  },{emoji:'🐾',minutes:7,description:'Retirar deposiciones a diario. Si se ensucia mucho, hacer un segundo repaso.'}),
  daily('basura','Revisar basura y reciclaje','Cocina',{
    practicas:['Edu','Minerva','Edu','Minerva','Edu','Minerva','Alterno'],
    manana:['Edu','Minerva','Edu','Minerva','Edu','Minerva','Alterno'],
    tarde:['Edu','Minerva','Edu','Minerva','Edu','Minerva','Alterno']
  },{emoji:'♻️',minutes:3,optional:true,description:'Sacar solo si hace falta.'}),
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
export const createInitialState = ({salt,pinHash})=>({
  setup:{salt,pinHash},
  settings:{mode:'practicas',updatedAt:new Date().toISOString()},
  tasks:seedTasks,
  completions:{},
  overrides:{},
  activity:[],
  createdAt:new Date().toISOString()
});
export { seedTasks, modes };
