# Configuración PocketBase para Administración de Usuarios

Para que la sección **Administración de Usuarios** funcione con control real de acceso, la colección auth `users` debe tener campos personalizados y reglas API. El frontend ya valida roles y permisos, pero la seguridad real debe reforzarse en PocketBase.

## Campos personalizados en `users`

Crear o verificar estos campos en la colección auth `users`:

| Campo | Tipo | Requerido | Valores sugeridos |
|---|---|---:|---|
| `nombre` | Plain text | Sí | Nombre completo |
| `rol` | Select o plain text | Sí | `administrador`, `secretario`, `profesional`, `usuario_basico`, `invitado` |
| `estado` | Select o plain text | Sí | `activo`, `inactivo` |
| `permisos` | JSON | Sí | Array de permisos |

Ejemplo de `permisos` para administrador:

```json
[
  "ver_dashboard",
  "ver_agenda",
  "crear_registros",
  "editar_registros",
  "eliminar_registros",
  "acceder_actas",
  "generar_pdf",
  "ver_contabilidad",
  "administrar_usuarios",
  "acceder_configuracion"
]
```

## Reglas API recomendadas en `users`

Configurar en `PocketBase → Collections → users → API rules`:

```text
List/Search:
@request.auth.id != "" && @request.auth.rol = "administrador"

View:
@request.auth.id != "" && (@request.auth.rol = "administrador" || id = @request.auth.id)

Create:
@request.auth.id != "" && @request.auth.rol = "administrador"

Update:
@request.auth.id != "" && @request.auth.rol = "administrador"

Delete:
@request.auth.id != "" && @request.auth.rol = "administrador" && id != @request.auth.id
```

Si PocketBase no permite comparar el campo `rol` directamente en reglas de auth, usar `@request.auth.permisos ?~ "administrar_usuarios"` como alternativa, o mantener `rol` como campo plain text.

## Reglas para otras colecciones

Ejemplos:

### `publicaciones`

```text
List/Search:
@request.auth.id != "" && (@request.auth.rol = "administrador" || @request.auth.permisos ?~ "ver_dashboard")

Create:
@request.auth.id != "" && (@request.auth.rol = "administrador" || @request.auth.permisos ?~ "crear_registros")

Update:
@request.auth.id != "" && (@request.auth.rol = "administrador" || @request.auth.permisos ?~ "editar_registros")

Delete:
@request.auth.id != "" && (@request.auth.rol = "administrador" || @request.auth.permisos ?~ "eliminar_registros")
```

### `contabilidad_datos`

```text
List/Search:
@request.auth.id != "" && (@request.auth.rol = "administrador" || @request.auth.permisos ?~ "ver_contabilidad")

View:
@request.auth.id != "" && (@request.auth.rol = "administrador" || @request.auth.permisos ?~ "ver_contabilidad")

Create:
@request.auth.id != "" && @request.auth.rol = "administrador"

Update:
@request.auth.id != "" && @request.auth.rol = "administrador"

Delete:
@request.auth.id != "" && @request.auth.rol = "administrador"
```

## Primer administrador

Antes de usar el módulo, asignar manualmente al usuario administrador inicial:

```json
{
  "rol": "administrador",
  "estado": "activo",
  "permisos": [
    "ver_dashboard",
    "ver_agenda",
    "crear_registros",
    "editar_registros",
    "eliminar_registros",
    "acceder_actas",
    "generar_pdf",
    "ver_contabilidad",
    "administrar_usuarios",
    "acceder_configuracion"
  ]
}
```
