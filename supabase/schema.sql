-- ============================================================
-- GestionLab — esquema completo (proyecto Supabase: vnoecaqldymonkgrmvlj)
-- ============================================================
-- Convenciones de esta primera versión (migración mecánica desde Sheets):
--   - Los ID de negocio existentes (ID_Activo, ID_Incidencia, USR-001...) se
--     mantienen como clave primaria de tipo text, en vez de introducir un uuid
--     surrogate — evita tener que retocar QR/NFC ya impresos y todo el código
--     JS que ya referencia esos IDs literalmente.
--   - Campos "Sí"/"No" de Sheets -> boolean real aquí. Los scripts de
--     importación deben mapear el texto al convertir.
--   - Fechas de texto libre de Sheets -> date/timestamptz/time reales aquí.
--   - Estados (Estado, Resultado, Impacto...) se dejan como `text` sin enum
--     por ahora — iremos añadiendo CHECK constraints módulo a módulo durante
--     la migración de CRUD (no antes, para no bloquear la carga de datos
--     históricos que puedan tener valores sucios).
--   - Campos que hoy son texto libre con nombres de persona (Responsable,
--     Reportado_Por, Realizado_Por...) se mantienen como texto: el código
--     actual ya los compara por nombre, no por ID (ver esResponsableDeEquipo
--     en config.js). Normalizarlos a user_id es una mejora futura, no parte
--     de este primer corte.
--   - Equipos.ubicacion y Material.ubicacion se dejan sin FK a ubicaciones:
--     CLAUDE.md ya documenta que ese campo tiene datos pendientes de limpiar
--     en el instituto: forzar la FK ahora bloquearía la importación.
--   - RLS: se activa en todas las tablas pero SIN políticas todavía (equivale
--     a "todo bloqueado salvo service_role"). Las políticas por rol se
--     diseñan en la tarea de Auth (#8), cuando haya usuarios reales de
--     Supabase Auth contra los que probarlas.

create extension if not exists pgcrypto;

create type user_role as enum ('Administrador', 'Gestor', 'Profesor', 'Alumno');

-- ============================================================
-- 1. IDENTIDAD — ciclos, módulos, usuarios, ubicaciones, proveedores
-- ============================================================

create table ciclos (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null unique,
  created_at    timestamptz not null default now()
);

create table modulos (
  id                uuid primary key default gen_random_uuid(),
  nombre            text not null,
  lab_teoria        text,
  lab_practicas     text,
  horas_semanales   integer,
  created_at        timestamptz not null default now()
);

create table modulo_ciclo (
  ciclo_id   uuid not null references ciclos(id) on delete cascade,
  modulo_id  uuid not null references modulos(id) on delete cascade,
  primary key (ciclo_id, modulo_id)
);

-- id = auth.users.id (Supabase Auth). gestionlab_id conserva el formato
-- histórico USR-001 solo como referencia visible, no como clave.
create table users (
  id                          uuid primary key references auth.users(id) on delete cascade,
  gestionlab_id               text unique,
  nombre                      text not null,
  email                       text not null unique,
  rol                         user_role not null default 'Alumno',
  activo                      boolean not null default true,
  ciclo_principal_id          uuid references ciclos(id),
  puede_revisar_inventario    boolean not null default false,
  created_at                  timestamptz not null default now()
);

create table user_modulos (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references users(id) on delete cascade,
  modulo_id          uuid not null references modulos(id) on delete cascade,
  curso_academico    text not null,
  created_at         timestamptz not null default now(),
  unique (user_id, modulo_id, curso_academico)
);

create table ubicaciones (
  id_ubicacion            text primary key,
  laboratorio_aula        text,
  zona                    text,
  subzona                 text,
  descripcion_completa    text,
  activa                  boolean not null default true
);

create table proveedores (
  id_proveedor         text primary key,
  nombre_proveedor     text not null,
  tipo_proveedor       text,
  persona_contacto     text,
  email_contacto       text,
  telefono             text,
  web                  text,
  observaciones        text,
  activo               boolean not null default true
);

-- Nota: los campos "proveedor" de otras tablas (equipos, intervenciones,
-- material, pedidos, historico_precio) NO llevan FK a esta tabla — el
-- código actual los rellena con el nombre libre desde un <input list>/
-- datalist que admite tanto elegir del catálogo como escribir un proveedor
-- puntual no dado de alta (ver docs/modulo-incidencias.md, "técnicos
-- puntuales"). Forzar la FK rompería ese caso de uso y bloquearía datos
-- históricos con nombres que ya no coinciden exactamente con el catálogo.

-- ============================================================
-- 2. EQUIPOS, INTERVENCIONES, INCIDENCIAS
-- ============================================================

create table equipos (
  id_activo                       text primary key,
  tipo_equipo                     text not null,
  marca                           text,
  modelo                          text,
  numero_serie                    text,
  ubicacion                       text,   -- sin FK: datos pendientes de limpiar (ver CLAUDE.md)
  responsable                     text,   -- nombres separados por coma, texto libre
  fecha_adquisicion               date,
  origen_financiacion             text,
  proveedor_compra                text,   -- nombre libre, no FK: ver nota más abajo
  proveedor_servicio_tecnico      text,   -- nombre libre, no FK: ver nota más abajo
  estado_operativo                text,
  manual_ficha_tecnica            text,   -- pasará a ser ruta de Supabase Storage
  observaciones                   text,
  coste                           numeric,
  protocolo_uso                   text,
  tipo_mantenimiento              text,
  mes_inicio_temporada            integer,
  mes_fin_temporada               integer
);

create table intervenciones (
  id_intervencion                        text primary key,
  id_equipo                              text not null references equipos(id_activo) on delete cascade,
  tipo                                   text,
  origen                                 text,
  fecha_planificada                      date,
  fecha_realizacion                      date,
  realizado_por                          text,
  tecnico_externo                        text,
  proveedor                              text,   -- nombre libre (admite SAT puntual no dado de alta), no FK
  descripcion_actuacion                  text,
  resultado                              text,   -- derivado de tareas_intervencion, no editable a mano
  equipo_operativo_tras_intervencion     boolean,
  url_adjunto                            text,
  factura_asociada                       text,
  actualiza_proximo_preventivo           boolean,
  observaciones                          text,
  nombre_adjunto                         text,
  estado                                 text,   -- derivado de tareas_intervencion
  fecha_estimada_resolucion              date,
  coste_intervencion                     numeric
);

create table incidencias (
  id_incidencia            text primary key,
  id_equipo                text not null references equipos(id_activo) on delete cascade,
  reportado_por            text,
  fecha_hora               timestamptz not null default now(),
  descripcion_problema     text,
  impacto                  text,
  urgencia                 text,
  estado                   text,
  intervencion_generada    text references intervenciones(id_intervencion),
  relacionada_con          text references incidencias(id_incidencia)
);

create table tareas_intervencion (
  id_tarea            text primary key,
  id_intervencion      text not null references intervenciones(id_intervencion) on delete cascade,
  descripcion          text,
  resultado            text,
  operativo            boolean,
  observaciones        text
);

-- ============================================================
-- 3. MANTENIMIENTO PREVENTIVO
-- ============================================================

create table planes_mantenimiento (
  id_plan             text primary key,
  id_equipo           text not null references equipos(id_activo) on delete cascade,
  tipo_intervencion   text,
  periodicidad        text,
  activo              boolean not null default true,
  operacion           text,
  instrucciones       text,
  con_alumnado        boolean not null default false
);

create table registro_mantenimientos (
  id_registro         text primary key,
  id_plan             text not null references planes_mantenimiento(id_plan) on delete cascade,
  id_equipo           text not null references equipos(id_activo) on delete cascade,
  curso_academico     text,
  periodo             text,
  fecha_realizacion   date,
  realizado_por       text,
  supervisado_por     text,
  observaciones       text
);

-- ============================================================
-- 4. RESIDUOS
-- ============================================================

create table tipos_residuo (
  id_residuo         text primary key,
  nombre             text not null,
  descripcion        text,
  riesgo             text,   -- lista de pictogramas GHS separados por coma
  contenedor_tipo    text,
  lab                text,
  zona               text
);

create table contenedores_residuo (
  id_contenedor          text primary key,
  categoria              text not null,
  lab                    text,
  zona                   text,
  nivel                  text,
  estado                 text not null default 'activo',
  fecha_apertura         date,
  fecha_cierre           date,
  fecha_actualizacion    timestamptz,
  actualizado_por        text,
  formato                text
);

create table adiciones_residuo (
  id_adicion         text primary key,
  id_contenedor      text not null references contenedores_residuo(id_contenedor) on delete cascade,
  id_residuo         text not null references tipos_residuo(id_residuo),
  fecha              timestamptz not null default now(),
  usuario            text,
  observaciones      text
);

create table consultas_residuo (
  id_consulta            text primary key,
  fecha                  timestamptz not null default now(),
  usuario                text,
  descripcion            text,
  ubicacion_dejado       text,
  estado                 text not null default 'Pendiente'
);

-- ============================================================
-- 5. RESERVAS DE EQUIPOS
-- ============================================================

create table config_reservas (
  id_equipo                text primary key references equipos(id_activo) on delete cascade,
  politica                 text not null,
  params_template          jsonb,
  max_horas                numeric,
  antelacion_min_horas     numeric
);

create table reservas_equipos (
  id_reserva               text primary key,
  id_equipo                text not null references equipos(id_activo) on delete cascade,
  usuario                  text,
  fecha_inicio             timestamptz not null,
  fecha_fin                timestamptz not null,
  condiciones              jsonb,
  proposito                text,
  estado                   text not null default 'Confirmada',
  aprobado_por             text,
  observaciones_admin      text,
  inicio_real              timestamptz,
  fin_real                 timestamptz
);

-- ============================================================
-- 6. REGISTROS DE USO (cabina de bioseguridad / autoclave)
-- ============================================================

create table registros_cabina (
  id_registro                     text primary key,
  id_equipo                       text not null references equipos(id_activo) on delete cascade,
  usuario                         text,
  fecha                           date not null,
  hora_inicio                     time,
  hora_fin                        time,
  practica_tecnica                text,
  nivel_riesgo                    text,
  verificacion_previa             text,
  descontaminacion_posterior      text,
  incidencias                     text,
  estado                          text not null default 'Abierta'
);

create table registros_autoclave (
  id_registro           text primary key,
  id_equipo              text not null references equipos(id_activo) on delete cascade,
  usuario                 text,
  fecha                   date not null,
  hora_inicio              time,
  hora_fin                 time,
  programa_ciclo           text,
  tipo_carga               text,
  resultado_control        text,
  incidencias              text,
  estado                   text not null default 'Cerrada'
);

-- ============================================================
-- 7. MATERIAL, PEDIDOS, SOLICITUDES
-- ============================================================

create table material (
  id_material            text primary key,
  nombre                 text not null,
  categoria              text,
  referencia_proveedor   text,
  proveedor              text,   -- nombre libre, no FK
  unidad                 text,
  ubicacion              text,   -- legacy: solo ubicación primaria, ver docs/modulo-pedidos.md
  stock_actual           numeric,
  stock_minimo           numeric,
  stock_optimo           numeric,
  observaciones          text,
  gestion_automatica     boolean not null default false
);

create table material_ubicaciones (
  id                   text primary key,
  id_material          text not null references material(id_material) on delete cascade,
  id_ubicacion         text not null references ubicaciones(id_ubicacion),
  stock_local          numeric not null default 0,
  stock_minimo_local   numeric,
  stock_optimo_local   numeric,
  id_lote_padre        text references material_ubicaciones(id),
  unidad_lote          text
);

create table pedidos (
  id_pedido                    text primary key,
  nombre_lista                 text,
  proveedor                    text,   -- nombre libre, no FK
  fecha_creacion                date,
  fecha_presupuesto              date,
  fecha_aprobacion                date,
  fecha_pedido_enviado             date,
  fecha_recepcion_completa         date,
  fecha_factura                     date,
  estado                            text not null default 'Abierto',
  numero_presupuesto                text,
  numero_factura                    text,
  observaciones                     text,
  doc_hoja_generada                 boolean not null default false,
  doc_enviada_jefatura               boolean not null default false,
  ciclo                              text,
  modulo                             text,
  tipo                                text not null default 'Material',
  gasto_extra_concepto                text,
  gasto_extra_importe                 numeric
);

create table lineas_pedido (
  id_linea             text primary key,
  pedido               text not null references pedidos(id_pedido) on delete cascade,
  material             text references material(id_material),
  cantidad_pedida      numeric,
  cantidad_recibida    numeric not null default 0,
  estado_linea         text,
  observaciones        text,
  precio_unitario      numeric,
  id_equipo            text references equipos(id_activo)
);

create table solicitudes (
  id_solicitud            text primary key,
  material                text references material(id_material),
  cantidad_solicitada     numeric,
  solicitante             text,
  fecha                   timestamptz not null default now(),
  motivo                  text,
  proveedor_requerido     text,
  estado                  text not null default 'Pendiente',
  lista_pedido            text references pedidos(id_pedido),
  observaciones           text,
  snooze_hasta            date
);

create table historico_precio (
  id_historico       text primary key,
  nombre_material    text,
  id_pedido          text references pedidos(id_pedido),
  proveedor          text,   -- nombre libre, no FK
  fecha              date,
  precio_unitario    numeric
);

create table movimientos (
  id_movimiento    text primary key,
  material         text references material(id_material),
  tipo             text,
  cantidad         numeric,
  usuario          text,
  fecha            timestamptz not null default now(),
  motivo           text,
  observaciones    text
);

create table revisiones_inventario (
  id_revision       text primary key,
  fecha             timestamptz not null default now(),
  id_material       text references material(id_material),
  nombre_material   text,
  stock_app         numeric,
  stock_real        numeric,
  diferencia        numeric,
  usuario           text,
  observaciones     text
);

-- ============================================================
-- 8. VARIOS
-- ============================================================

-- Tareas personales del usuario (recordatorios propios, sin relación con
-- tareas_intervencion — nombre distinto adrede para no confundirlas).
create table tareas_personales (
  id_tarea         text primary key,
  email            text not null,
  texto            text not null,
  fecha_limite     date,
  completada       boolean not null default false,
  fecha_creacion   timestamptz not null default now()
);

-- ============================================================
-- 9. ROW LEVEL SECURITY — activada en todo, sin políticas todavía
-- ============================================================
-- Con RLS activa y cero políticas, solo la service_role key (uso exclusivo
-- desde Edge Functions/servidor) puede leer o escribir. El cliente público
-- (anon/authenticated) no tendrá ningún acceso hasta que se diseñen las
-- políticas por rol en la tarea de Auth (#8).

do $$
declare
  t text;
begin
  for t in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security;', t);
  end loop;
end $$;

-- ============================================================
-- 10. PERMISOS DE TABLA (GRANTs)
-- ============================================================
-- RLS decide QUÉ filas se ven; los GRANT deciden si el rol puede tocar la
-- tabla siquiera. Al crear las tablas conectados como superusuario (postgres)
-- en vez de vía las migraciones propias de Supabase, estos GRANT no se
-- aplican solos — hay que darlos a mano. Sin esto, service_role (usada desde
-- las Edge Functions) recibe "permission denied" aunque tenga vía libre de
-- RLS. anon/authenticated se conceden ya también: como RLS sigue sin
-- políticas, no abre ningún acceso real todavía, pero evita este mismo
-- problema cuando se añadan las políticas en la tarea de Auth (#8).

grant usage on schema public to anon, authenticated, service_role;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant select on tables to anon;

-- ============================================================
-- 11. POLÍTICAS RLS — catálogos no sensibles, lectura pública
-- ============================================================
-- Mismo criterio que ciclos/modulos en el proyecto compartido: catálogos sin
-- datos personales, de lectura libre para cualquiera con la anon key (igual
-- que ya pasa hoy). Las escrituras siguen exigiendo Admin/Gestor vía Edge
-- Function (gestionar-proveedor) porque el navegador no tiene sesión real de
-- Supabase Auth todavía (tarea #8) — sin eso, una policy de escritura para
-- "authenticated" no protegería nada real.

create policy "proveedores_select_anon" on proveedores for select to anon using (true);
