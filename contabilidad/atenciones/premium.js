let db=load();
initDates();
fillLists(db);

const $obs=$('obs');
const $counter=$('obsCounter');
const $estadoPreview=$('estadoPreview');
const $sumEstado=$('sumEstado');
const $tbody=$('tbody');
const $loader=$('tableLoader');
const $toastWrap=$('toastWrap');
const $detailModal=$('detailModal');
const $detailGrid=$('detailGrid');

document.body.classList.add('page-enter');
if(typeof userLabel==='function')$('userLabelText').textContent=userLabel();

function loadCssOnce(id,href){
  if(document.getElementById(id))return;
  let link=document.createElement('link');
  link.id=id;
  link.rel='stylesheet';
  link.href=href;
  document.head.appendChild(link);
}
function ensureVisualModeCss(){loadCssOnce('premium-visual-mode-css','../assets/visual-mode.css?v=20260625h')}
function ensureVisualPolish(){loadCssOnce('teurgia-visual-polish-css','../assets/teurgia-visual-polish.css?v=20260625p')}

function syncVisualModeLabel(){
  let light=document.body.classList.contains('dark');
  document.querySelectorAll('.top-action').forEach(btn=>{
    if(btn.getAttribute('onclick')&&btn.getAttribute('onclick').includes('toggleModoVisual'))btn.innerHTML=(light?'◑ <span>Modo oscuro</span>':'◐ <span>Modo claro</span>');
  });
}

const originalToggleModoVisual=window.toggleModoVisual;
window.toggleModoVisual=function(){
  if(typeof originalToggleModoVisual==='function')originalToggleModoVisual();
  else document.body.classList.toggle('dark');
  syncVisualModeLabel();
};
ensureVisualModeCss();
ensureVisualPolish();
syncVisualModeLabel();

function toggleSidebar(force){
  const shouldOpen=typeof force==='boolean'?force:!document.body.classList.contains('sidebar-open');
  document.body.classList.toggle('sidebar-open',shouldOpen);
}

function stateMeta(status){
  if(status==='pagado')return{text:'Pagado',cls:'paid'};
  if(status==='deuda')return{text:'Deuda',cls:'debt'};
  if(status==='anulado')return{text:'Anulado',cls:'cancelled'};
  return{text:'Pendiente',cls:'pending'};
}

function boletaLabel(v){
  if(v==='emitida')return'Emitida';
  if(v==='no_aplica')return'No aplica';
  return'Pendiente';
}

function formatPercent(v){
  const num=Number(v||0);
  return Number.isInteger(num)?`${num} %`:`${num.toLocaleString('es-CL',{minimumFractionDigits:0,maximumFractionDigits:2})} %`;
}

function updateCounter(){
  const len=($obs.value||'').length;
  $counter.textContent=`${len} / 300`;
}

function updateStatusPreview(){
  const meta=stateMeta($('estado').value);
  $estadoPreview.className=`chip ${meta.cls}`;
  $estadoPreview.textContent=meta.text;
  $sumEstado.className=`chip ${meta.cls}`;
  $sumEstado.textContent=meta.text;
}

function currentDraft(){
  const a={estado:$('estado').value,arancel:n($('arancel').value),abono:n($('abono').value),porcentaje:n($('porcentaje').value),retencion:n($('retencion').value),boleta:$('boleta').value};
  if(a.estado==='pagado')a.abono=a.arancel;
  return a;
}

function updateSummary(){
  const a=currentDraft();
  $('sumArancel').textContent=money(a.arancel);
  $('sumAbono').textContent=money(a.abono);
  $('sumSaldo').textContent=money(Math.max(a.arancel-a.abono,0));
  $('sumInst').textContent=formatPercent(a.porcentaje||0);
  $('sumRet').textContent=formatPercent(a.retencion||0);
  $('sumBoleta').textContent=boletaLabel(a.boleta);
  updateStatusPreview();
}

function showToast(type,title,text){
  const item=document.createElement('div');
  item.className=`toast ${type}`;
  item.innerHTML=`<div class="t-icon">${type==='success'?'✓':'⚠'}</div><div><div class="t-title">${title}</div><div class="t-text">${text}</div></div>`;
  $toastWrap.appendChild(item);
  setTimeout(()=>{item.style.opacity='0';item.style.transform='translateY(10px)'},2600);
  setTimeout(()=>item.remove(),3000);
}

function withLoader(fn){
  $loader.classList.remove('hidden');
  $tbody.innerHTML='';
  setTimeout(()=>{fn();$loader.classList.add('hidden')},120);
}

function limpiar(){
  ['edit','usuario','profesional','servicio','arancel','obs'].forEach(id=>$(id).value='');
  $('fecha').value=today();
  $('metodo').value='Transferencia';
  $('estado').value='pagado';
  $('abono').value=0;
  $('porcentaje').value=30;
  $('retencion').value=15.25;
  $('boleta').value='pendiente';
  $('title').textContent='Nueva atención';
  updateCounter();
  updateSummary();
}

function validarCampos(a){return a.usuario&&a.profesional&&a.servicio&&a.arancel}

function guardar(){
  const id=$('edit').value;
  const a={id:id||uid(),fecha:$('fecha').value||today(),usuario:$('usuario').value.trim(),profesional:$('profesional').value.trim(),servicio:$('servicio').value.trim(),metodo:$('metodo').value,estado:$('estado').value,arancel:n($('arancel').value),abono:n($('abono').value),porcentaje:n($('porcentaje').value),retencion:n($('retencion').value),boleta:$('boleta').value,obs:$('obs').value.trim(),liquidado:false};
  if(a.estado==='pagado')a.abono=a.arancel;
  if(!validarCampos(a)){showToast('error','Campos incompletos','Completa usuario, profesional, servicio y arancel.');return}
  if(id){
    const old=db.atenciones.find(x=>x.id===id);
    a.liquidado=old?.liquidado||false;
    db.atenciones=db.atenciones.map(x=>x.id===id?a:x);
  }else db.atenciones.push(a);
  save(db);
  fillLists(db);
  limpiar();
  render();
  showToast('success','Atención guardada correctamente','El registro fue guardado y actualizado en la tabla.');
}

function editar(id){
  cerrarMenus();
  const a=db.atenciones.find(x=>x.id===id);
  if(!a)return;
  Object.keys(a).forEach(k=>{if($(k))$(k).value=a[k]});
  $('edit').value=id;
  $('title').textContent='Editar atención';
  updateCounter();
  updateSummary();
  window.scrollTo({top:0,behavior:'smooth'});
}

function duplicar(id){
  cerrarMenus();
  const a=db.atenciones.find(x=>x.id===id);
  if(!a)return;
  db.atenciones.push({...a,id:uid(),fecha:today(),liquidado:false});
  save(db);
  render();
  showToast('success','Atención duplicada','Se creó una copia del registro seleccionado.');
}

function borrar(id){
  cerrarMenus();
  if(!confirm('¿Eliminar atención?'))return;
  db.atenciones=db.atenciones.filter(x=>x.id!==id);
  save(db);
  render();
  showToast('success','Atención eliminada','El registro fue eliminado correctamente.');
}

function ver(id){
  cerrarMenus();
  const a=db.atenciones.find(x=>x.id===id);
  if(!a)return;
  const detail=[['Fecha',a.fecha],['Usuario',a.usuario],['Profesional',a.profesional],['Servicio',a.servicio],['Método',a.metodo],['Estado',stateMeta(a.estado).text],['Arancel',money(a.arancel)],['Abono',money(cob(a))],['Saldo pendiente',money(deuda(a))],['% institución',formatPercent(a.porcentaje)],['% retención',formatPercent(a.retencion)],['Boleta / respaldo',boletaLabel(a.boleta)],['Observación',a.obs||'Sin observación']];
  $detailGrid.innerHTML=detail.map(([k,v])=>`<div class="detail-item"><div class="k">${k}</div><div class="v">${escapeHTML(v)}</div></div>`).join('');
  $detailModal.classList.add('open');
}

function cerrarDetalle(){$detailModal.classList.remove('open')}

function toggleMenu(id,ev){
  ev.stopPropagation();
  document.querySelectorAll('.dropdown.open').forEach(el=>{if(el.id!==`dd-${id}`)el.classList.remove('open')});
  const dd=document.getElementById(`dd-${id}`);
  dd.classList.toggle('open');
}

function cerrarMenus(){document.querySelectorAll('.dropdown.open').forEach(el=>el.classList.remove('open'))}

function renderNow(){
  const q=$('buscar').value.toLowerCase().trim();
  const e=$('fEstado').value;
  const rows=db.atenciones.filter(a=>(e==='todos'||a.estado===e)&&(!q||[a.usuario,a.profesional,a.servicio].join(' ').toLowerCase().includes(q))).sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||''));
  if(!rows.length){$tbody.innerHTML='<tr><td colspan="7" style="text-align:center;color:#8ea5c6;padding:26px 18px;">No hay atenciones para mostrar.</td></tr>';return}
  $tbody.innerHTML=rows.map(a=>{const meta=stateMeta(a.estado);return `<tr><td>${escapeHTML(a.fecha)}</td><td>${escapeHTML(a.usuario)}</td><td>${escapeHTML(a.profesional)}</td><td>${escapeHTML(a.servicio)}</td><td class="amount">${money(a.arancel)}</td><td><span class="chip ${meta.cls}">${meta.text}</span></td><td><div class="row-actions"><button class="icon-btn" onclick="ver('${a.id}')" title="Ver">👁</button><button class="icon-btn" onclick="editar('${a.id}')" title="Editar">✎</button><button class="icon-btn" onclick="duplicar('${a.id}')" title="Duplicar">⧉</button><div class="dropdown" id="dd-${a.id}"><button class="icon-btn" onclick="toggleMenu('${a.id}',event)" title="Más opciones">⋯</button><div class="dropdown-menu"><button onclick="ver('${a.id}')">Ver detalle</button><button onclick="editar('${a.id}')">Editar</button><button onclick="duplicar('${a.id}')">Duplicar</button><button class="danger" onclick="borrar('${a.id}')">Eliminar</button></div></div></div></td></tr>`}).join('');
}

function render(){withLoader(renderNow)}

function escapeHTML(texto){return String(texto??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;')}

document.addEventListener('click',e=>{if(!e.target.closest('.dropdown'))cerrarMenus();if(e.target===$detailModal)cerrarDetalle()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){cerrarMenus();cerrarDetalle();document.body.classList.remove('sidebar-open')}});
document.addEventListener('input',e=>{if(['arancel','abono','porcentaje','retencion','obs'].includes(e.target.id))updateSummary();if(e.target.id==='obs')updateCounter()});
document.addEventListener('change',e=>{
  if(e.target.id==='usuario'){
    const u=db.usuarios.find(x=>(x.nombre||'').toLowerCase()===$('usuario').value.trim().toLowerCase());
    if(u){$('servicio').value=u.servicio||'';$('profesional').value=u.profesional||'';$('arancel').value=u.pago||''}
  }
  if(e.target.id==='servicio'){
    const a=db.aranceles.find(x=>(x.servicio||'').toLowerCase()===$('servicio').value.trim().toLowerCase()&&n(x.valor)>0);
    if(a)$('arancel').value=a.valor;
  }
  if(e.target.id==='estado'&&$('estado').value==='pagado')$('abono').value=$('arancel').value||0;
  if(['usuario','servicio','estado','boleta','arancel','abono','porcentaje','retencion'].includes(e.target.id))updateSummary();
});

window.toggleSidebar=toggleSidebar;
window.limpiar=limpiar;
window.guardar=guardar;
window.editar=editar;
window.duplicar=duplicar;
window.borrar=borrar;
window.ver=ver;
window.cerrarDetalle=cerrarDetalle;
window.toggleMenu=toggleMenu;
window.render=render;
window.ensureVisualModeCss=ensureVisualModeCss;
window.ensureVisualPolish=ensureVisualPolish;

updateCounter();
updateSummary();
render();
