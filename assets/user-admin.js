(() => {
  const USER_COLLECTION='users';
  const ROLES={
    administrador:'Administrador',
    secretario:'Secretario',
    profesional:'Profesional',
    usuario_basico:'Usuario básico',
    invitado:'Invitado / visualizador'
  };
  const PERMISSIONS={
    ver_dashboard:'Ver dashboard',
    ver_agenda:'Ver agenda',
    crear_registros:'Crear registros',
    editar_registros:'Editar registros',
    eliminar_registros:'Eliminar registros',
    acceder_actas:'Acceder a actas',
    generar_pdf:'Generar PDF',
    ver_contabilidad:'Ver contabilidad',
    administrar_usuarios:'Administrar usuarios',
    acceder_configuracion:'Acceder a configuración'
  };
  const DEFAULT_PERMISSIONS={
    administrador:Object.keys(PERMISSIONS),
    secretario:['ver_dashboard','acceder_actas','crear_registros','editar_registros','generar_pdf'],
    profesional:['ver_dashboard','ver_agenda','crear_registros','editar_registros'],
    usuario_basico:['ver_dashboard','ver_agenda'],
    invitado:['ver_dashboard']
  };
  let users=[];
  let editingId='';

  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  const norm=v=>String(v||'').trim().toLowerCase();
  const current=()=>window.pb?.authStore?.model||null;
  const currentId=()=>current()?.id||'';
  const currentRole=()=>norm(current()?.rol||current()?.role||'');
  const currentPerms=()=>Array.isArray(current()?.permisos)?current().permisos:[];
  const isAdmin=()=>currentRole()==='administrador'||currentRole()==='admin'||currentPerms().includes('administrar_usuarios');
  const isActiveUser=()=>norm(current()?.estado||'activo')!=='inactivo';
  const roleLabel=r=>ROLES[r]||r||'Sin rol';
  const roleClass=r=>'role-'+String(r||'sin_rol').replaceAll(' ','_');
  const statusLabel=s=>norm(s||'activo')==='inactivo'?'Inactivo':'Activo';

  function password(){
    const chars='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    let out='';
    const arr=new Uint32Array(14);
    crypto.getRandomValues(arr);
    arr.forEach(n=>out+=chars[n%chars.length]);
    return out;
  }

  function permisosByRole(role){return [...(DEFAULT_PERMISSIONS[role]||[])]}

  function deny(msg='No tienes permiso para realizar esta acción.'){
    showMessage(msg,'err');
    throw new Error(msg);
  }

  function requireAdmin(){
    if(!window.pb?.authStore?.isValid)deny('Debes iniciar sesión.');
    if(!isActiveUser()){window.pb.authStore.clear();deny('La cuenta está inactiva. Contacta al administrador.');}
    if(!isAdmin())deny('Acceso restringido: solo el rol administrador puede administrar usuarios.');
    return true;
  }

  function inject(){
    const dashboard=$('dashboardView');
    if(!dashboard||$('userAdminSection'))return;
    const section=document.createElement('section');
    section.id='userAdminSection';
    section.className='card user-admin-section only-admin-hidden';
    section.innerHTML=`
      <div class="user-admin-head">
        <div>
          <h2>Administración de Usuarios</h2>
          <p class="muted">Crea, edita, activa, desactiva y asigna permisos de acceso por rol.</p>
        </div>
        <button type="button" onclick="teurgiaUserAdmin.openCreate()">Crear usuario</button>
      </div>
      <div id="userAdminMessage" class="user-admin-message hidden"></div>
      <div class="user-admin-toolbar">
        <div><label for="uaSearch">Buscar</label><input id="uaSearch" placeholder="Nombre, correo o rol" oninput="teurgiaUserAdmin.render()"></div>
        <div><label for="uaRoleFilter">Rol</label><select id="uaRoleFilter" onchange="teurgiaUserAdmin.render()"><option value="todos">Todos</option>${Object.entries(ROLES).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></div>
        <div><label for="uaStatusFilter">Estado</label><select id="uaStatusFilter" onchange="teurgiaUserAdmin.render()"><option value="todos">Todos</option><option value="activo">Activo</option><option value="inactivo">Inactivo</option></select></div>
        <button type="button" class="secondary" onclick="teurgiaUserAdmin.load()">Actualizar</button>
      </div>
      <div class="user-admin-table-wrap"><table class="user-admin-table"><thead><tr><th>Usuario</th><th>Correo</th><th>Rol</th><th>Estado</th><th>Permisos</th><th>Acciones</th></tr></thead><tbody id="uaTable"><tr><td colspan="6">Cargando usuarios...</td></tr></tbody></table></div>`;
    const publicaciones=[...dashboard.querySelectorAll('.card')].find(el=>el.textContent.includes('Publicaciones'));
    if(publicaciones)publicaciones.before(section); else dashboard.appendChild(section);

    const modal=document.createElement('div');
    modal.id='userAdminModal';
    modal.className='user-admin-modal';
    modal.innerHTML=`
      <div class="user-admin-panel" role="dialog" aria-modal="true" aria-labelledby="uaModalTitle">
        <div class="user-admin-panel-head">
          <div><h2 id="uaModalTitle">Crear usuario</h2><p class="muted" id="uaModalSub" style="margin:6px 0 0">Define rol, estado y permisos personalizados.</p></div>
          <button type="button" class="close-btn" onclick="teurgiaUserAdmin.close()">Cerrar</button>
        </div>
        <div class="user-admin-panel-body">
          <input type="hidden" id="uaId">
          <div class="user-admin-grid">
            <div><label for="uaNombre">Nombre completo</label><input id="uaNombre" placeholder="Nombre y apellido"></div>
            <div><label for="uaEmail">Correo electrónico</label><input id="uaEmail" type="email" placeholder="usuario@correo.cl"></div>
            <div><label for="uaRol">Rol asignado</label><select id="uaRol" onchange="teurgiaUserAdmin.applyRoleDefaults()">${Object.entries(ROLES).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></div>
            <div><label for="uaEstado">Estado</label><select id="uaEstado"><option value="activo">Activo</option><option value="inactivo">Inactivo</option></select></div>
          </div>
          <label for="uaPassword" id="uaPasswordLabel">Contraseña temporal</label>
          <div class="user-admin-password-row">
            <input id="uaPassword" type="password" autocomplete="new-password" placeholder="Mínimo 8 caracteres">
            <button type="button" class="secondary" onclick="teurgiaUserAdmin.generatePassword()">Autogenerar</button>
            <button type="button" class="outline" onclick="teurgiaUserAdmin.copyPassword()">Copiar</button>
          </div>
          <div class="user-admin-warning">La contraseña no se guarda en texto plano. PocketBase la almacena cifrada/hasheada. En edición solo completa este campo si necesitas restablecerla.</div>
          <h3 style="margin:22px 0 6px">Permisos específicos</h3>
          <p class="muted" style="margin:0 0 8px">Puedes usar los permisos predeterminados del rol o ajustarlos manualmente por sección.</p>
          <div id="uaPermisos" class="user-admin-permissions">${Object.entries(PERMISSIONS).map(([k,v])=>`<label class="permission-check"><input type="checkbox" value="${k}"> <span>${v}</span></label>`).join('')}</div>
          <div class="user-admin-footer">
            <button type="button" class="secondary" onclick="teurgiaUserAdmin.applyRoleDefaults()">Permisos del rol</button>
            <button type="button" class="outline" onclick="teurgiaUserAdmin.close()">Cancelar</button>
            <button type="button" onclick="teurgiaUserAdmin.save()">Guardar usuario</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click',e=>{if(e.target===modal)close()});
  }

  function showMessage(text,type=''){
    const el=$('userAdminMessage');
    if(!el)return;
    el.textContent=text;
    el.className='user-admin-message '+(type||'');
    el.classList.remove('hidden');
    clearTimeout(el._t);
    el._t=setTimeout(()=>el.classList.add('hidden'),4500);
  }

  function refreshVisibility(){
    inject();
    const sec=$('userAdminSection');
    if(!sec)return;
    sec.classList.toggle('only-admin-hidden',!isAdmin()||!isActiveUser()||!window.pb?.authStore?.isValid);
  }

  async function load(){
    requireAdmin();
    const tbody=$('uaTable');
    if(tbody)tbody.innerHTML='<tr><td colspan="6">Cargando usuarios...</td></tr>';
    try{
      users=await window.pb.collection(USER_COLLECTION).getFullList({sort:'email'});
      render();
    }catch(error){
      console.error(error);
      if(tbody)tbody.innerHTML='<tr><td colspan="6">No se pudieron cargar usuarios. Revisa reglas API de PocketBase y campos personalizados.</td></tr>';
      showMessage('No se pudieron cargar usuarios. Revisa reglas API de PocketBase.', 'err');
    }
  }

  function render(){
    refreshVisibility();
    const tbody=$('uaTable');
    if(!tbody||!isAdmin())return;
    const q=norm($('uaSearch')?.value||'');
    const rf=$('uaRoleFilter')?.value||'todos';
    const sf=$('uaStatusFilter')?.value||'todos';
    let list=users.filter(u=>{
      const role=u.rol||u.role||'';
      const st=norm(u.estado||'activo');
      const text=norm([u.nombre,u.name,u.email,role].join(' '));
      if(q&&!text.includes(q))return false;
      if(rf!=='todos'&&role!==rf)return false;
      if(sf!=='todos'&&st!==sf)return false;
      return true;
    });
    if(!list.length){tbody.innerHTML='<tr><td colspan="6">No hay usuarios para mostrar.</td></tr>';return}
    tbody.innerHTML=list.map(u=>row(u)).join('');
  }

  function row(u){
    const role=u.rol||u.role||'sin_rol';
    const st=norm(u.estado||'activo')==='inactivo'?'inactivo':'activo';
    const perms=Array.isArray(u.permisos)?u.permisos:[];
    const chips=perms.slice(0,4).map(p=>`<span class="perm-chip">${esc(PERMISSIONS[p]||p)}</span>`).join('')+(perms.length>4?`<span class="perm-chip">+${perms.length-4}</span>`:'');
    const self=u.id===currentId();
    return `<tr>
      <td><strong>${esc(u.nombre||u.name||'Sin nombre')}</strong>${self?'<span class="muted">Tu cuenta</span>':''}</td>
      <td>${esc(u.email||'')}</td>
      <td><span class="role-badge ${roleClass(role)}">${esc(roleLabel(role))}</span></td>
      <td><span class="status-badge status-${st}">${statusLabel(st)}</span></td>
      <td><div class="perm-list">${chips||'<span class="muted">Sin permisos</span>'}</div></td>
      <td><div class="user-admin-actions"><button class="small" onclick="teurgiaUserAdmin.openEdit('${u.id}')">Editar</button><button class="small secondary" onclick="teurgiaUserAdmin.resetPassword('${u.id}')">Restablecer</button><button class="small ${st==='activo'?'secondary':'ok'}" onclick="teurgiaUserAdmin.toggleStatus('${u.id}')">${st==='activo'?'Desactivar':'Activar'}</button><button class="small danger" onclick="teurgiaUserAdmin.remove('${u.id}')" ${self?'disabled title="No puedes eliminarte a ti mismo"':''}>Eliminar</button></div></td>
    </tr>`;
  }

  function openCreate(){
    requireAdmin();
    editingId='';
    $('uaModalTitle').textContent='Crear usuario';
    $('uaModalSub').textContent='Crea una cuenta con rol, estado y permisos.';
    $('uaId').value='';$('uaNombre').value='';$('uaEmail').value='';$('uaPassword').value='';$('uaRol').value='usuario_basico';$('uaEstado').value='activo';
    $('uaPasswordLabel').textContent='Contraseña temporal';
    applyRoleDefaults();
    $('userAdminModal').classList.add('open');
    setTimeout(()=>$('uaNombre').focus(),60);
  }

  function openEdit(id){
    requireAdmin();
    const u=users.find(x=>x.id===id);if(!u)return;
    editingId=id;
    $('uaModalTitle').textContent='Editar usuario';
    $('uaModalSub').textContent='Modifica datos, rol, estado y permisos específicos.';
    $('uaId').value=id;$('uaNombre').value=u.nombre||u.name||'';$('uaEmail').value=u.email||'';$('uaPassword').value='';$('uaRol').value=u.rol||u.role||'usuario_basico';$('uaEstado').value=norm(u.estado||'activo')==='inactivo'?'inactivo':'activo';
    $('uaPasswordLabel').textContent='Nueva contraseña temporal (opcional)';
    setPerms(Array.isArray(u.permisos)?u.permisos:permisosByRole($('uaRol').value));
    $('userAdminModal').classList.add('open');
  }

  function close(){$('userAdminModal')?.classList.remove('open')}
  function getPerms(){return [...document.querySelectorAll('#uaPermisos input:checked')].map(x=>x.value)}
  function setPerms(perms){document.querySelectorAll('#uaPermisos input').forEach(x=>x.checked=perms.includes(x.value))}
  function applyRoleDefaults(){setPerms(permisosByRole($('uaRol')?.value||'usuario_basico'))}
  function generatePassword(){const p=password();$('uaPassword').value=p;navigator.clipboard?.writeText(p).catch(()=>{});showMessage('Contraseña temporal generada y copiada al portapapeles.', 'ok')}
  function copyPassword(){const p=$('uaPassword')?.value;if(!p){showMessage('No hay contraseña para copiar.', 'err');return}navigator.clipboard?.writeText(p).then(()=>showMessage('Contraseña copiada al portapapeles.', 'ok')).catch(()=>showMessage('No se pudo copiar automáticamente.', 'err'))}

  async function save(){
    requireAdmin();
    const id=$('uaId').value;
    const nombre=$('uaNombre').value.trim();
    const email=$('uaEmail').value.trim().toLowerCase();
    const pass=$('uaPassword').value;
    const rol=$('uaRol').value;
    const estado=$('uaEstado').value;
    const permisos=getPerms();
    if(!nombre||!email||!rol||!estado){showMessage('Completa nombre, correo, rol y estado.', 'err');return}
    if(!id&&pass.length<8){showMessage('La contraseña temporal debe tener al menos 8 caracteres.', 'err');return}
    if(id===currentId()&&(estado==='inactivo'||rol!=='administrador')){showMessage('No puedes quitarte accidentalmente el rol administrador ni desactivar tu propia cuenta.', 'err');return}
    const duplicate=users.find(u=>norm(u.email)===email&&u.id!==id);
    if(duplicate){showMessage('Ya existe un usuario con ese correo.', 'err');return}
    const payload={nombre,email,rol,estado,permisos,emailVisibility:true};
    if(!id){payload.password=pass;payload.passwordConfirm=pass;payload.verified=true}else if(pass){if(pass.length<8){showMessage('La nueva contraseña debe tener al menos 8 caracteres.', 'err');return}payload.password=pass;payload.passwordConfirm=pass}
    try{
      if(id)await window.pb.collection(USER_COLLECTION).update(id,payload);else await window.pb.collection(USER_COLLECTION).create(payload);
      close();
      await load();
      showMessage(id?'Usuario actualizado correctamente.':'Usuario creado correctamente.', 'ok');
    }catch(error){
      console.error(error);
      showMessage('No se pudo guardar. Revisa campos personalizados y reglas API de PocketBase.', 'err');
    }
  }

  async function toggleStatus(id){
    requireAdmin();
    const u=users.find(x=>x.id===id);if(!u)return;
    if(id===currentId()){showMessage('No puedes desactivar tu propia cuenta.', 'err');return}
    const next=norm(u.estado||'activo')==='inactivo'?'activo':'inactivo';
    if(!confirm(`¿Confirmas ${next==='inactivo'?'desactivar':'activar'} esta cuenta?`))return;
    try{await window.pb.collection(USER_COLLECTION).update(id,{estado:next});await load();showMessage('Estado actualizado.', 'ok')}catch(e){console.error(e);showMessage('No se pudo cambiar el estado.', 'err')}
  }

  async function resetPassword(id){
    requireAdmin();
    const u=users.find(x=>x.id===id);if(!u)return;
    if(!confirm(`¿Restablecer contraseña de ${u.email}?`))return;
    const p=password();
    try{
      await window.pb.collection(USER_COLLECTION).update(id,{password:p,passwordConfirm:p});
      await navigator.clipboard?.writeText(p).catch(()=>{});
      showMessage('Contraseña temporal generada y copiada al portapapeles. Entrégala por un canal seguro.', 'ok');
    }catch(e){console.error(e);showMessage('No se pudo restablecer la contraseña.', 'err')}
  }

  async function remove(id){
    requireAdmin();
    if(id===currentId()){showMessage('No puedes eliminar tu propia cuenta.', 'err');return}
    const u=users.find(x=>x.id===id);if(!u)return;
    if(!confirm(`¿Eliminar definitivamente a ${u.email}? Esta acción no se puede deshacer.`))return;
    try{await window.pb.collection(USER_COLLECTION).delete(id);await load();showMessage('Usuario eliminado.', 'ok')}catch(e){console.error(e);showMessage('No se pudo eliminar el usuario.', 'err')}
  }

  function patchAuth(){
    if(!window.pb)return;
    const originalActualizar=window.actualizarEstadoAuth;
    if(typeof originalActualizar==='function'&&!originalActualizar.__userAdminPatched){
      window.actualizarEstadoAuth=function(){originalActualizar();refreshVisibility();if(isAdmin()&&window.pb.authStore.isValid)load().catch(()=>{})};
      window.actualizarEstadoAuth.__userAdminPatched=true;
    }
    const originalLogin=window.login;
    if(typeof originalLogin==='function'&&!originalLogin.__userAdminPatched){
      window.login=async function(){
        const email=$('email').value.trim(), pass=$('password').value.trim();
        $('loginError').classList.add('hidden');$('loginError').textContent='';
        if(!email||!pass){window.mostrarLoginError?.('Ingresa correo y contraseña.');return}
        try{
          await window.pb.collection(USER_COLLECTION).authWithPassword(email,pass);
          const user=window.pb.authStore.model;
          if(norm(user?.estado||'activo')==='inactivo'){window.pb.authStore.clear();window.mostrarLoginError?.('La cuenta está inactiva. Contacta al administrador.');return}
          const role=norm(user?.rol||user?.role||'');
          const perms=Array.isArray(user?.permisos)?user.permisos:[];
          if(window.selectedLoginArea==='contabilidad'){
            if(role==='administrador'||perms.includes('ver_contabilidad')){if(window.teurgiaFadeTo)window.teurgiaFadeTo('contabilidad/');else location.href='contabilidad/';return}
            window.pb.authStore.clear();window.mostrarLoginError?.('Tu usuario no tiene permiso para ver contabilidad.');return;
          }
          if(!(role==='administrador'||perms.includes('ver_dashboard'))){window.pb.authStore.clear();window.mostrarLoginError?.('Tu usuario no tiene permiso para acceder al panel.');return}
          window.cerrarLogin?.();
          window.actualizarEstadoAuth?.();
          if(role==='administrador'||perms.includes('ver_dashboard'))window.cargarPublicaciones?.();
        }catch(error){window.mostrarLoginError?.('No se pudo ingresar. Revisa usuario, contraseña o permisos.',error)}
      };
      window.login.__userAdminPatched=true;
    }
  }

  function init(){inject();patchAuth();refreshVisibility();if(isAdmin()&&window.pb?.authStore?.isValid)load().catch(()=>{})}
  document.addEventListener('DOMContentLoaded',init);
  window.addEventListener('load',init);
  window.teurgiaUserAdmin={load,render,openCreate,openEdit,close,save,remove,toggleStatus,resetPassword,applyRoleDefaults,generatePassword,copyPassword};
})();