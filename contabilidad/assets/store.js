const KEY='servertest_contabilidad_v3';
const OLD='servertest_contabilidad_v2';
const PB_URL='https://pocketbase.agrupacionnothofagus.cl';
const SERVER_COLLECTION='contabilidad_datos';
const SERVER_KEY='contabilidad_general';
const SERVER_ID_KEY='servertest_contabilidad_record_id';
const $=id=>document.getElementById(id);
const n=v=>Number(v||0);
const money=v=>n(v).toLocaleString('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0});
const uid=()=>crypto.randomUUID?crypto.randomUUID():'id'+Date.now()+Math.random();
const today=()=>new Date().toISOString().slice(0,10);
const month=()=>new Date().toISOString().slice(0,7);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function authData(){try{return JSON.parse(localStorage.getItem('pocketbase_auth')||'null')||{}}catch(e){return{}}}
function tokenExpired(t){try{let p=JSON.parse(atob(t.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));return p.exp&&p.exp*1000<Date.now()}catch(e){return true}}
function isLoginPage(){return location.pathname.includes('/contabilidad/login/')}
function loginUrl(){let rel=(location.pathname.split('/contabilidad/')[1]||'');return rel===''||rel==='index.html'?'login/':'../login/'}
function isAuthenticated(){let a=authData();return !!(a.token&&!tokenExpired(a.token))}
function requireAuth(){if(isLoginPage())return true;if(!isAuthenticated()){location.href=loginUrl();return false}return true}
function userLabel(){let m=authData().model||{};return m.email||m.username||m.name||'Usuario'}
function logoutContabilidad(){localStorage.removeItem('pocketbase_auth');location.href=loginUrl()}
requireAuth();
function seed(){return{atenciones:[],usuarios:[],profesionales:[],aranceles:[{id:uid(),servicio:'Psicología',tramo:'General',valor:0,obs:'Completar valor'},{id:uid(),servicio:'Terapia Ocupacional',tramo:'General',valor:0,obs:'Completar valor'},{id:uid(),servicio:'Fonoaudiología',tramo:'General',valor:0,obs:'Completar valor'},{id:uid(),servicio:'Psicopedagogía',tramo:'General',valor:0,obs:'Completar valor'},{id:uid(),servicio:'ADOS-2 / ADI-R',tramo:'Evaluación',valor:0,obs:'Completar valor'}],egresos:[],cierres:[]}}
function fixDb(db){db=db||seed();db.atenciones=db.atenciones||[];db.usuarios=db.usuarios||[];db.profesionales=db.profesionales||[];db.aranceles=db.aranceles||[];db.egresos=db.egresos||[];db.cierres=db.cierres||[];db.atenciones=db.atenciones.map(a=>({...a,liquidado:!!a.liquidado,boleta:a.boleta||'pendiente'}));return db}
function loadLocal(){let raw=localStorage.getItem(KEY)||localStorage.getItem(OLD);return raw?fixDb(JSON.parse(raw)):seed()}
function load(){let db=loadLocal();setTimeout(syncFromServer,250);return db}
function save(db){db=fixDb(db);localStorage.setItem(KEY,JSON.stringify(db));saveToServer(db)}
function serverHeaders(){return{'Content-Type':'application/json','Authorization':'Bearer '+authData().token}}
async function findServerRecord(){let f=encodeURIComponent("clave='"+SERVER_KEY+"'");let res=await fetch(`${PB_URL}/api/collections/${SERVER_COLLECTION}/records?filter=${f}&perPage=1`,{headers:serverHeaders()});if(!res.ok)throw new Error('No se pudo buscar registro servidor: '+res.status);let data=await res.json();return data.items&&data.items[0]?data.items[0]:null}
async function readServer(){if(!isAuthenticated()||isLoginPage())return null;let rec=await findServerRecord();if(!rec){let local=loadLocal();await createServer(local);return local}localStorage.setItem(SERVER_ID_KEY,rec.id);return fixDb(rec.datos||seed())}
async function createServer(db){let res=await fetch(`${PB_URL}/api/collections/${SERVER_COLLECTION}/records`,{method:'POST',headers:serverHeaders(),body:JSON.stringify({clave:SERVER_KEY,datos:fixDb(db)})});if(!res.ok)throw new Error('No se pudo crear registro servidor: '+res.status);let rec=await res.json();localStorage.setItem(SERVER_ID_KEY,rec.id);return rec}
async function saveToServer(db){if(!isAuthenticated()||isLoginPage())return;try{let id=localStorage.getItem(SERVER_ID_KEY);if(!id){let rec=await findServerRecord();if(rec){id=rec.id;localStorage.setItem(SERVER_ID_KEY,id)}}let body=JSON.stringify({clave:SERVER_KEY,datos:fixDb(db)});let res=id?await fetch(`${PB_URL}/api/collections/${SERVER_COLLECTION}/records/${id}`,{method:'PATCH',headers:serverHeaders(),body}):await fetch(`${PB_URL}/api/collections/${SERVER_COLLECTION}/records`,{method:'POST',headers:serverHeaders(),body});if(!res.ok)throw new Error('No se pudo guardar en servidor: '+res.status);let rec=await res.json();localStorage.setItem(SERVER_ID_KEY,rec.id);localStorage.removeItem('contabilidad_sync_error')}catch(e){console.error(e);localStorage.setItem('contabilidad_sync_error',e.message)}}
async function syncFromServer(){if(!isAuthenticated()||isLoginPage())return;try{let server=await readServer();if(!server)return;let serverRaw=JSON.stringify(server),localRaw=JSON.stringify(loadLocal());if(serverRaw!==localRaw){localStorage.setItem(KEY,serverRaw);let once='contabilidad_hydrated_'+location.pathname;if(sessionStorage.getItem(once)!=='1'){sessionStorage.setItem(once,'1');location.reload()}}localStorage.removeItem('contabilidad_sync_error')}catch(e){console.error(e);localStorage.setItem('contabilidad_sync_error',e.message)}}
function cob(a){if(a.estado==='pagado')return n(a.arancel);if(a.estado==='abonado')return Math.min(n(a.abono),n(a.arancel));return 0}
function deuda(a){return Math.max(n(a.arancel)-cob(a),0)}
function calc(a){let c=cob(a),inst=c*n(a.porcentaje||30)/100,base=Math.max(c-inst,0),ret=base*n(a.retencion||15.25)/100;return{c,inst,base,ret,liq:Math.max(base-ret,0),deuda:deuda(a)}}
function byPeriod(db,mes='',q='todas',pro='todos'){return db.atenciones.filter(a=>{if(mes&&!(a.fecha||'').startsWith(mes))return false;let d=n((a.fecha||'').slice(8,10));if(q==='1'&&d>15)return false;if(q==='2'&&d<16)return false;if(pro!=='todos'&&a.profesional!==pro)return false;return true})}
function egByPeriod(db,mes='',q='todas'){return db.egresos.filter(e=>{if(mes&&!(e.fecha||'').startsWith(mes))return false;let d=n((e.fecha||'').slice(8,10));if(q==='1'&&d>15)return false;if(q==='2'&&d<16)return false;return true})}
function resumen(ats,egs=[]){let r={bruto:0,cobrado:0,inst:0,prof:0,deuda:0,pendLiq:0,n:ats.length};ats.forEach(a=>{let c=calc(a);r.bruto+=n(a.arancel);r.cobrado+=c.c;r.inst+=c.inst;r.prof+=c.liq;r.deuda+=c.deuda;if(!a.liquidado)r.pendLiq+=c.liq});r.egresos=egs.reduce((s,e)=>s+n(e.monto),0);r.saldo=r.inst-r.egresos;return r}
function nav(prefix=''){let root=prefix||'./';return `<nav class="top-links"><a href="${root}">Panel</a><a href="${root}atenciones/">Atenciones</a><a href="${root}caja/">Caja</a><a href="${root}deudas/">Deudas</a><a href="${root}liquidaciones/">Pagos prof.</a><a href="${root}egresos/">Egresos</a><a href="${root}usuarios/">Usuarios</a><a href="${root}profesionales/">Profesionales</a><a href="${root}aranceles/">Aranceles</a><a href="${root}reportes/">Reportes</a></nav>`}
function sidebar(prefix=''){let err=localStorage.getItem('contabilidad_sync_error');return `<aside class="side"><div class="brand"><div class="logo">$</div><div class="brand-text"><span class="brand-title">Contabilidad</span><span class="brand-subtitle">${err?'Modo local':'Servidor activo'}</span></div></div>${nav(prefix)}<div class="auth-mini"><span>${esc(userLabel())}</span><button onclick="logoutContabilidad()">Salir</button></div></aside>`}
function initDates(){document.querySelectorAll('[data-today]').forEach(x=>x.value=today());document.querySelectorAll('[data-month]').forEach(x=>x.value=month())}
function fillLists(db){document.querySelectorAll('[data-pros]').forEach(el=>{let a=[...new Set([...db.profesionales.map(x=>x.nombre),...db.atenciones.map(x=>x.profesional)].filter(Boolean))].sort();el.innerHTML=a.map(x=>`<option value="${esc(x)}">`).join('')});document.querySelectorAll('[data-users]').forEach(el=>{let a=[...new Set([...db.usuarios.map(x=>x.nombre),...db.atenciones.map(x=>x.usuario)].filter(Boolean))].sort();el.innerHTML=a.map(x=>`<option value="${esc(x)}">`).join('')});document.querySelectorAll('[data-servs]').forEach(el=>{let a=[...new Set([...db.aranceles.map(x=>x.servicio),...db.atenciones.map(x=>x.servicio)].filter(Boolean))].sort();el.innerHTML=a.map(x=>`<option value="${esc(x)}">`).join('')})}
function download(name,txt,type){let b=new Blob([txt],{type}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=name;a.click();URL.revokeObjectURL(u)}