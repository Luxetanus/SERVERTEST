const DIRECTUS = "http://127.0.0.1:8055";
const TOKEN = process.env.DIRECTUS_ADMIN_TOKEN;

if (!TOKEN) {
  console.error("DIRECTUS_ADMIN_TOKEN is required");
  process.exit(1);
}

const researchCollections = {
  investigacion_proyectos: { label: "Proyectos", icon: "science" },
  investigacion_tareas: { label: "Tareas", icon: "task_alt" },
  investigacion_actas: { label: "Reuniones y actas", icon: "edit_note" },
  investigacion_hitos: { label: "Calendario y Gantt", icon: "event" },
  investigacion_documentos: { label: "Documentos", icon: "folder" },
  investigacion_archivos: { label: "Archivos subidos", icon: "upload_file" },
  investigacion_participantes: { label: "Participantes", icon: "groups" },
  investigacion_protocolos: { label: "Instrumentos y protocolos", icon: "fact_check" },
  investigacion_datos: { label: "Datos y analisis", icon: "analytics" },
  investigacion_publicaciones: { label: "Publicaciones y productos", icon: "article" },
  investigacion_equipo: { label: "Equipo investigador", icon: "badge" },
  investigacion_lineas: { label: "Lineas de investigacion", icon: "account_tree" },
  investigacion_vinculacion: { label: "Vinculacion institucional", icon: "hub" },
  investigacion_notificaciones: { label: "Notificaciones internas", icon: "notifications" },
};

async function request(path, options = {}) {
  const response = await fetch(`${DIRECTUS}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) {
    throw new Error(`${options.method || "GET"} ${path} -> ${response.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

async function ensureCollection(collection, meta = {}) {
  const collections = await request("/collections");
  if (collections.data.some((item) => item.collection === collection)) return;
  await request("/collections", {
    method: "POST",
    body: JSON.stringify({
      collection,
      meta: {
        collection,
        group: null,
        hidden: false,
        singleton: false,
        accountability: "all",
        display_template: "{{titulo}}",
        note: "Area de Investigacion Teurgia",
        ...meta,
      },
      schema: {},
    }),
  });
}

async function ensureField(collection, field, type, schema = {}, meta = {}) {
  const fields = await request(`/fields/${collection}`).catch(() => ({ data: [] }));
  if (fields.data.some((item) => item.field === field)) return;
  await request(`/fields/${collection}`, {
    method: "POST",
    body: JSON.stringify({
      field,
      type,
      schema,
      meta: {
        field,
        ...meta,
      },
    }),
  });
}

async function ensureBaseFields(collection) {
  await ensureField(collection, "titulo", "string", { max_length: 255 }, { interface: "input", required: true, width: "half" });
  await ensureField(collection, "descripcion", "text", {}, { interface: "input-multiline" });
  await ensureField(collection, "estado", "string", { max_length: 100, default_value: "Activo" }, { interface: "select-dropdown", width: "half" });
  await ensureField(collection, "categoria", "string", { max_length: 140 }, { interface: "input", width: "half" });
  await ensureField(collection, "proyecto", "string", { max_length: 255 }, { interface: "input", width: "half" });
  await ensureField(collection, "responsable", "string", { max_length: 255 }, { interface: "input", width: "half" });
  await ensureField(collection, "fecha_ref", "string", { max_length: 40 }, { interface: "input", width: "half" });
  await ensureField(collection, "prioridad", "string", { max_length: 80 }, { interface: "select-dropdown", width: "half" });
  await ensureField(collection, "progreso", "integer", { default_value: 0 }, { interface: "input", width: "half" });
  await ensureField(collection, "creado_por", "string", { max_length: 80 }, { interface: "input", readonly: true, width: "half" });
  await ensureField(collection, "creado_por_email", "string", { max_length: 255 }, { interface: "input", readonly: true, width: "half" });
  await ensureField(collection, "datos", "json", {}, { interface: "input-code", options: { language: "json" } });
}

async function ensureFileFields() {
  const collection = "investigacion_archivos";
  await ensureField(collection, "file_id", "uuid", {}, { interface: "input", readonly: true, width: "half" });
  await ensureField(collection, "file_name", "string", { max_length: 255 }, { interface: "input", readonly: true, width: "half" });
  await ensureField(collection, "file_type", "string", { max_length: 120 }, { interface: "input", readonly: true, width: "half" });
  await ensureField(collection, "file_size", "integer", {}, { interface: "input", readonly: true, width: "half" });
  await ensureField(collection, "uploaded_by", "string", { max_length: 80 }, { interface: "input", readonly: true, width: "half" });
  await ensureField(collection, "uploaded_by_email", "string", { max_length: 255 }, { interface: "input", readonly: true, width: "half" });
  await ensureField(collection, "fecha_subida", "dateTime", {}, { interface: "datetime", readonly: true, width: "half" });
}

async function ensureRoleAndPolicy() {
  const roles = await request("/roles?limit=-1&fields=id,name");
  let role = roles.data.find((item) => String(item.name).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === "investigacion");
  if (!role) {
    role = (await request("/roles", {
      method: "POST",
      body: JSON.stringify({
        name: "Investigacion",
        icon: "science",
        description: "Acceso al Area de Investigacion",
      }),
    })).data;
  }

  const policies = await request("/policies?limit=-1&fields=id,name");
  let policy = policies.data.find((item) => item.name === "Investigacion");
  if (!policy) {
    policy = (await request("/policies", {
      method: "POST",
      body: JSON.stringify({
        name: "Investigacion",
        icon: "science",
        description: "Permisos de datos para el Area de Investigacion",
        app_access: true,
        admin_access: false,
      }),
    })).data;
  }

  const access = await request(`/access?limit=-1&filter[role][_eq]=${role.id}&filter[policy][_eq]=${policy.id}`);
  if (!access.data.length) {
    await request("/access", {
      method: "POST",
      body: JSON.stringify({ role: role.id, policy: policy.id }),
    });
  }
  return { role, policy };
}

async function ensurePermission(policyId, collection, action, fields = ["*"], permissions = {}, validation = {}, presets = {}) {
  const existing = await request(`/permissions?limit=1&filter[policy][_eq]=${policyId}&filter[collection][_eq]=${collection}&filter[action][_eq]=${action}`);
  const body = { policy: policyId, collection, action, fields, permissions, validation, presets };
  if (existing.data.length) {
    await request(`/permissions/${existing.data[0].id}`, { method: "PATCH", body: JSON.stringify(body) });
  } else {
    await request("/permissions", { method: "POST", body: JSON.stringify(body) });
  }
}

async function ensurePermissions(policyId) {
  const collections = [...Object.keys(researchCollections), "directus_files", "directus_folders"];
  for (const collection of collections) {
    await ensurePermission(policyId, collection, "read");
  }
  for (const collection of Object.keys(researchCollections)) {
    await ensurePermission(policyId, collection, "create");
    await ensurePermission(policyId, collection, "update");
    await ensurePermission(policyId, collection, "delete");
  }
  await ensurePermission(policyId, "directus_files", "create");
  await ensurePermission(policyId, "directus_files", "update");
}

async function main() {
  for (const [collection, config] of Object.entries(researchCollections)) {
    await ensureCollection(collection, {
      icon: config.icon,
      note: `${config.label} del Area de Investigacion`,
      display_template: "{{titulo}}",
    });
    await ensureBaseFields(collection);
  }
  await ensureFileFields();
  const { role, policy } = await ensureRoleAndPolicy();
  await ensurePermissions(policy.id);
  console.log(`Directus research schema ready: role=${role.name}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
