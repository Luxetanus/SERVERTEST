(() => {
  const USER_COLLECTION = "users";
  const BOOTSTRAP_ADMIN_EMAILS = ["luxetanus@teurgia.cl"];
  const ROLES = {
    administracion: "Administracion",
    lectura: "Lectura",
  };
  const PERMISSIONS = {
    ver_dashboard: "Ver panel",
    ver_contabilidad: "Ver contabilidad",
    administrar_usuarios: "Administrar usuarios",
  };
  const DEFAULT_PERMISSIONS = {
    administracion: Object.keys(PERMISSIONS),
    lectura: ["ver_dashboard"],
  };

  let users = [];
  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const norm = (value) => String(value || "").trim().toLowerCase();
  const normalizeRole = (value) => {
    const role = norm(value);
    if (role === "administrator" || role === "administrador" || role === "administracio" || role === "administracion") return "administracion";
    if (role === "lectura" || role === "read" || role === "reader") return "lectura";
    return "lectura";
  };
  const current = () => window.pb?.authStore?.model || null;
  const currentId = () => current()?.id || "";
  const currentEmail = () => norm(current()?.email || current()?.username || "");
  const isBootstrapAdmin = () => BOOTSTRAP_ADMIN_EMAILS.includes(currentEmail());
  const currentRole = () => isBootstrapAdmin() ? "administracion" : normalizeRole(current()?.rol || current()?.role || "");
  const currentPerms = () => currentRole() === "administracion" ? Object.keys(PERMISSIONS) : DEFAULT_PERMISSIONS.lectura;
  const isAdmin = () => currentRole() === "administracion" || currentPerms().includes("administrar_usuarios");
  const isActiveUser = () => norm(current()?.estado || "activo") !== "inactivo";
  const roleLabel = (role) => ROLES[normalizeRole(role)] || "Lectura";
  const roleClass = (role) => `role-${normalizeRole(role)}`;

  function password() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
    let out = "";
    const arr = new Uint32Array(14);
    crypto.getRandomValues(arr);
    arr.forEach((num) => { out += chars[num % chars.length]; });
    return out;
  }

  function permisosByRole(role) {
    return [...(DEFAULT_PERMISSIONS[normalizeRole(role)] || DEFAULT_PERMISSIONS.lectura)];
  }

  function showMessage(text, type = "") {
    const el = $("userAdminMessage");
    if (!el) return;
    el.textContent = text;
    el.className = `user-admin-message ${type}`;
    el.classList.remove("hidden");
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.add("hidden"), 4500);
  }

  function deny(message = "No tienes permiso para realizar esta accion.") {
    showMessage(message, "err");
    throw new Error(message);
  }

  function requireAdmin() {
    if (!window.pb?.authStore?.isValid) deny("Debes iniciar sesion.");
    if (!isActiveUser()) deny("La cuenta esta inactiva. Contacta al administrador.");
    if (!isAdmin()) deny("Acceso restringido: solo Administracion puede administrar usuarios.");
    return true;
  }

  function inject() {
    const mount = $("adminUsersMount") || $("dashboardView");
    if (!mount || $("userAdminSection")) return;
    const section = document.createElement("section");
    section.id = "userAdminSection";
    section.className = "card user-admin-section only-admin-hidden";
    section.innerHTML = `<div class="user-admin-head"><div><h2>Administracion</h2><p class="muted">Crea usuarios nuevos y asigna rol de Administracion o Lectura.</p></div><button type="button" onclick="teurgiaUserAdmin.openCreate()">Anadir usuario</button></div><div id="userAdminMessage" class="user-admin-message hidden"></div><div class="user-admin-toolbar"><div><label for="uaSearch">Buscar</label><input id="uaSearch" placeholder="Nombre, correo o rol" oninput="teurgiaUserAdmin.render()"></div><div><label for="uaRoleFilter">Rol</label><select id="uaRoleFilter" onchange="teurgiaUserAdmin.render()"><option value="todos">Todos</option>${Object.entries(ROLES).map(([key, label]) => `<option value="${key}">${label}</option>`).join("")}</select></div><div><label for="uaStatusFilter">Estado</label><select id="uaStatusFilter" onchange="teurgiaUserAdmin.render()"><option value="todos">Todos</option><option value="activo">Activo</option><option value="inactivo">Inactivo</option></select></div><button type="button" class="secondary" onclick="teurgiaUserAdmin.load()">Actualizar</button></div><div class="user-admin-table-wrap"><table class="user-admin-table"><thead><tr><th>Usuario</th><th>Correo</th><th>Rol</th><th>Estado</th><th>Permisos</th><th>Acciones</th></tr></thead><tbody id="uaTable"><tr><td colspan="6">Cargando usuarios...</td></tr></tbody></table></div>`;
    mount.appendChild(section);

    const modal = document.createElement("div");
    modal.id = "userAdminModal";
    modal.className = "user-admin-modal";
    modal.innerHTML = `<div class="user-admin-panel" role="dialog" aria-modal="true" aria-labelledby="uaModalTitle"><div class="user-admin-panel-head"><div><h2 id="uaModalTitle">Anadir usuario</h2><p class="muted" id="uaModalSub" style="margin:6px 0 0">Define acceso, rol y contrasena temporal.</p></div><button type="button" class="close-btn" onclick="teurgiaUserAdmin.close()">Cerrar</button></div><div class="user-admin-panel-body"><input type="hidden" id="uaId"><div class="user-admin-grid"><div><label for="uaNombre">Nombre completo</label><input id="uaNombre" placeholder="Nombre y apellido"></div><div><label for="uaEmail">Correo electronico</label><input id="uaEmail" type="email" placeholder="usuario@correo.cl"></div><div><label for="uaRol">Rol</label><select id="uaRol" onchange="teurgiaUserAdmin.applyRoleDefaults()">${Object.entries(ROLES).map(([key, label]) => `<option value="${key}">${label}</option>`).join("")}</select></div><div><label for="uaEstado">Estado</label><select id="uaEstado"><option value="activo">Activo</option><option value="inactivo">Inactivo</option></select></div></div><label for="uaPassword" id="uaPasswordLabel">Contrasena temporal</label><div class="user-admin-password-row"><input id="uaPassword" type="password" autocomplete="new-password" placeholder="Minimo 8 caracteres"><button type="button" class="secondary" onclick="teurgiaUserAdmin.generatePassword()">Generar</button><button type="button" class="outline" onclick="teurgiaUserAdmin.copyPassword()">Copiar</button></div><div class="user-admin-warning">Directus almacena la contrasena de forma segura. En edicion solo completa este campo si necesitas restablecerla.</div><h3 style="margin:22px 0 6px">Permisos del rol</h3><div id="uaPermisos" class="user-admin-permissions">${Object.entries(PERMISSIONS).map(([key, label]) => `<label class="permission-check"><input type="checkbox" value="${key}" disabled> <span>${label}</span></label>`).join("")}</div><div class="user-admin-footer"><button type="button" class="outline" onclick="teurgiaUserAdmin.close()">Cancelar</button><button type="button" onclick="teurgiaUserAdmin.save()">Guardar usuario</button></div></div></div>`;
    document.body.appendChild(modal);
    modal.addEventListener("click", (event) => { if (event.target === modal) close(); });
  }

  function setStats() {
    const total = users.length;
    const admin = users.filter((user) => normalizeRole(user.rol || user.role) === "administracion").length;
    const lectura = users.filter((user) => normalizeRole(user.rol || user.role) === "lectura").length;
    if ($("contadorUsuarios")) $("contadorUsuarios").textContent = total;
    if ($("contadorAdministracion")) $("contadorAdministracion").textContent = admin;
    if ($("contadorLectura")) $("contadorLectura").textContent = lectura;
  }

  function refreshVisibility() {
    inject();
    const section = $("userAdminSection");
    if (!section) return;
    section.classList.toggle("only-admin-hidden", !isAdmin() || !isActiveUser() || !window.pb?.authStore?.isValid);
  }

  async function load() {
    requireAdmin();
    const tbody = $("uaTable");
    if (tbody) tbody.innerHTML = '<tr><td colspan="6">Cargando usuarios...</td></tr>';
    try {
      users = await window.pb.collection(USER_COLLECTION).getFullList({ sort: "email" });
      users = users.map((user) => ({ ...user, rol: normalizeRole(user.rol || user.role) }));
      render();
    } catch (error) {
      console.error(error);
      if (tbody) tbody.innerHTML = '<tr><td colspan="6">No se pudieron cargar usuarios desde Directus.</td></tr>';
      showMessage(error.message || "Directus bloqueo la lectura de usuarios o el token expiro.", "err");
    }
  }

  function render() {
    refreshVisibility();
    const tbody = $("uaTable");
    if (!tbody || !isAdmin()) return;
    const q = norm($("uaSearch")?.value || "");
    const roleFilter = $("uaRoleFilter")?.value || "todos";
    const statusFilter = $("uaStatusFilter")?.value || "todos";
    const list = users.filter((user) => {
      const role = normalizeRole(user.rol || user.role);
      const status = norm(user.estado || "activo");
      const text = norm([user.nombre, user.name, user.email, roleLabel(role)].join(" "));
      if (q && !text.includes(q)) return false;
      if (roleFilter !== "todos" && role !== roleFilter) return false;
      if (statusFilter !== "todos" && status !== statusFilter) return false;
      return true;
    });
    setStats();
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="6">No hay usuarios para mostrar.</td></tr>';
      return;
    }
    tbody.innerHTML = list.map(row).join("");
  }

  function row(user) {
    const role = normalizeRole(user.rol || user.role);
    const status = norm(user.estado || "activo") === "inactivo" ? "inactivo" : "activo";
    const perms = permisosByRole(role);
    const chips = perms.map((perm) => `<span class="perm-chip">${esc(PERMISSIONS[perm] || perm)}</span>`).join("");
    const self = user.id === currentId();
    return `<tr><td><strong>${esc(user.nombre || user.name || "Sin nombre")}</strong>${self ? '<span class="muted">Tu cuenta</span>' : ""}</td><td>${esc(user.email || "")}</td><td><span class="role-badge ${roleClass(role)}">${esc(roleLabel(role))}</span></td><td><span class="status-badge status-${status}">${status === "inactivo" ? "Inactivo" : "Activo"}</span></td><td><div class="perm-list">${chips}</div></td><td><div class="user-admin-actions"><button class="small" onclick="teurgiaUserAdmin.openEdit('${user.id}')">Editar</button><button class="small secondary" onclick="teurgiaUserAdmin.resetPassword('${user.id}')">Restablecer</button><button class="small ${status === "activo" ? "secondary" : "ok"}" onclick="teurgiaUserAdmin.toggleStatus('${user.id}')">${status === "activo" ? "Desactivar" : "Activar"}</button><button class="small danger" onclick="teurgiaUserAdmin.remove('${user.id}')" ${self ? 'disabled title="No puedes eliminarte a ti mismo"' : ""}>Eliminar</button></div></td></tr>`;
  }

  function openCreate() {
    requireAdmin();
    $("uaModalTitle").textContent = "Anadir usuario";
    $("uaModalSub").textContent = "Crea una cuenta con rol Administracion o Lectura.";
    $("uaId").value = "";
    $("uaNombre").value = "";
    $("uaEmail").value = "";
    $("uaPassword").value = "";
    $("uaRol").value = "lectura";
    $("uaEstado").value = "activo";
    $("uaPasswordLabel").textContent = "Contrasena temporal";
    applyRoleDefaults();
    $("userAdminModal").classList.add("open");
    setTimeout(() => $("uaNombre").focus(), 60);
  }

  function openEdit(id) {
    requireAdmin();
    const user = users.find((item) => item.id === id);
    if (!user) return;
    $("uaModalTitle").textContent = "Editar usuario";
    $("uaModalSub").textContent = "Modifica nombre, correo, rol o estado.";
    $("uaId").value = id;
    $("uaNombre").value = user.nombre || user.name || "";
    $("uaEmail").value = user.email || "";
    $("uaPassword").value = "";
    $("uaRol").value = normalizeRole(user.rol || user.role);
    $("uaEstado").value = norm(user.estado || "activo") === "inactivo" ? "inactivo" : "activo";
    $("uaPasswordLabel").textContent = "Nueva contrasena temporal (opcional)";
    applyRoleDefaults();
    $("userAdminModal").classList.add("open");
  }

  function close() {
    $("userAdminModal")?.classList.remove("open");
  }

  function setPerms(perms) {
    document.querySelectorAll("#uaPermisos input").forEach((input) => { input.checked = perms.includes(input.value); });
  }

  function applyRoleDefaults() {
    setPerms(permisosByRole($("uaRol")?.value || "lectura"));
  }

  function generatePassword() {
    const temp = password();
    $("uaPassword").value = temp;
    navigator.clipboard?.writeText(temp).catch(() => {});
    showMessage("Contrasena temporal generada y copiada.", "ok");
  }

  function copyPassword() {
    const temp = $("uaPassword")?.value;
    if (!temp) {
      showMessage("No hay contrasena para copiar.", "err");
      return;
    }
    navigator.clipboard?.writeText(temp).then(() => showMessage("Contrasena copiada.", "ok")).catch(() => showMessage("No se pudo copiar automaticamente.", "err"));
  }

  async function save() {
    requireAdmin();
    const id = $("uaId").value;
    const nombre = $("uaNombre").value.trim();
    const email = $("uaEmail").value.trim().toLowerCase();
    const pass = $("uaPassword").value;
    const rol = normalizeRole($("uaRol").value);
    const estado = $("uaEstado").value;
    const permisos = permisosByRole(rol);
    if (!nombre || !email || !rol || !estado) {
      showMessage("Completa nombre, correo, rol y estado.", "err");
      return;
    }
    if (!id && pass.length < 8) {
      showMessage("La contrasena temporal debe tener al menos 8 caracteres.", "err");
      return;
    }
    if (id === currentId() && (estado === "inactivo" || rol !== "administracion")) {
      showMessage("No puedes quitarte el rol Administracion ni desactivar tu propia cuenta.", "err");
      return;
    }
    const duplicate = users.find((user) => norm(user.email) === email && user.id !== id);
    if (duplicate) {
      showMessage("Ya existe un usuario con ese correo.", "err");
      return;
    }
    const payload = { nombre, email, rol, estado, permisos };
    if (!id) payload.password = pass;
    else if (pass) {
      if (pass.length < 8) {
        showMessage("La nueva contrasena debe tener al menos 8 caracteres.", "err");
        return;
      }
      payload.password = pass;
    }
    try {
      if (id) await window.pb.collection(USER_COLLECTION).update(id, payload);
      else await window.pb.collection(USER_COLLECTION).create(payload);
      close();
      await load();
      showMessage(id ? "Usuario actualizado correctamente." : "Usuario creado correctamente.", "ok");
    } catch (error) {
      console.error(error);
      showMessage(error.message || "No se pudo guardar el usuario en Directus.", "err");
    }
  }

  async function toggleStatus(id) {
    requireAdmin();
    const user = users.find((item) => item.id === id);
    if (!user) return;
    if (id === currentId()) {
      showMessage("No puedes desactivar tu propia cuenta.", "err");
      return;
    }
    const next = norm(user.estado || "activo") === "inactivo" ? "activo" : "inactivo";
    if (!confirm(`Confirmas ${next === "inactivo" ? "desactivar" : "activar"} esta cuenta?`)) return;
    try {
      await window.pb.collection(USER_COLLECTION).update(id, { estado: next });
      await load();
      showMessage("Estado actualizado.", "ok");
    } catch (error) {
      console.error(error);
      showMessage("No se pudo cambiar el estado.", "err");
    }
  }

  async function resetPassword(id) {
    requireAdmin();
    const user = users.find((item) => item.id === id);
    if (!user) return;
    if (!confirm(`Restablecer contrasena de ${user.email}?`)) return;
    const temp = password();
    try {
      await window.pb.collection(USER_COLLECTION).update(id, { password: temp });
      await navigator.clipboard?.writeText(temp).catch(() => {});
      showMessage("Contrasena temporal generada y copiada.", "ok");
    } catch (error) {
      console.error(error);
      showMessage("No se pudo restablecer la contrasena.", "err");
    }
  }

  async function remove(id) {
    requireAdmin();
    if (id === currentId()) {
      showMessage("No puedes eliminar tu propia cuenta.", "err");
      return;
    }
    const user = users.find((item) => item.id === id);
    if (!user) return;
    if (!confirm(`Eliminar definitivamente a ${user.email}? Esta accion no se puede deshacer.`)) return;
    try {
      await window.pb.collection(USER_COLLECTION).delete(id);
      await load();
      showMessage("Usuario eliminado.", "ok");
    } catch (error) {
      console.error(error);
      showMessage("No se pudo eliminar el usuario.", "err");
    }
  }

  function patchAuth() {
    if (!window.pb) return;
    const originalOpen = window.abrirLogin;
    if (typeof originalOpen === "function" && !originalOpen.__userAdminAreaPatched) {
      window.abrirLogin = function(area) {
        window.teurgiaSelectedLoginArea = area || "admin";
        return originalOpen(area);
      };
      window.abrirLogin.__userAdminAreaPatched = true;
    }
    const originalActualizar = window.actualizarEstadoAuth;
    if (typeof originalActualizar === "function" && !originalActualizar.__userAdminPatched) {
      window.actualizarEstadoAuth = function() {
        originalActualizar();
        refreshVisibility();
        if (isAdmin() && window.pb.authStore.isValid) load().catch(() => {});
      };
      window.actualizarEstadoAuth.__userAdminPatched = true;
    }
    const originalLogin = window.login;
    if (typeof originalLogin === "function" && !originalLogin.__userAdminPatched) {
      window.login = async function() {
        const email = $("email").value.trim();
        const pass = $("password").value.trim();
        $("loginError").classList.add("hidden");
        $("loginError").textContent = "";
        if (!email || !pass) {
          window.mostrarLoginError?.("Ingresa correo y contrasena.");
          return;
        }
        try {
          await window.pb.collection(USER_COLLECTION).authWithPassword(email, pass);
          const user = window.pb.authStore.model;
          if (norm(user?.estado || "activo") === "inactivo" && !BOOTSTRAP_ADMIN_EMAILS.includes(norm(user?.email || email))) {
            window.mostrarLoginError?.("La cuenta esta inactiva. Contacta al administrador.");
            return;
          }
          const role = normalizeRole(user?.rol || user?.role || "");
          const area = window.teurgiaSelectedLoginArea || "admin";
          if (area === "contabilidad") {
            if (role === "administracion") {
              if (window.teurgiaFadeTo) window.teurgiaFadeTo("contabilidad/");
              else location.href = "contabilidad/";
              return;
            }
            window.mostrarLoginError?.("Tu usuario no tiene permiso para ver contabilidad.");
            return;
          }
          if (role !== "administracion" && role !== "lectura") {
            window.mostrarLoginError?.("Tu usuario no tiene permiso para acceder al panel.");
            return;
          }
          window.cerrarLogin?.();
          window.actualizarEstadoAuth?.();
        } catch (error) {
          window.mostrarLoginError?.("No se pudo ingresar. Revisa usuario, contrasena o permisos.", error);
        }
      };
      window.login.__userAdminPatched = true;
    }
  }

  function init() {
    inject();
    patchAuth();
    refreshVisibility();
    if (isAdmin() && window.pb?.authStore?.isValid) load().catch(() => {});
  }

  document.addEventListener("DOMContentLoaded", init);
  window.addEventListener("load", init);
  window.teurgiaUserAdmin = { load, render, openCreate, openEdit, close, save, remove, toggleStatus, resetPassword, applyRoleDefaults, generatePassword, copyPassword };
})();
