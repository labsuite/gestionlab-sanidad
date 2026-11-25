-- ============================================================
-- Verificación anual de las micropipetas (2026-11-24)
-- Encargo del laboratorio: ENCARGO_calculos_verificacion_micropipetas.md (carpeta de
-- protocolos). Cálculo en supabase/functions/_shared/verif_pipetas.js. Ver
-- docs/modulo-verificacion-pipetas.md. Este bloque va también al final de schema.sql.
-- ============================================================

-- Datos de cada pipeta: volúmenes de prueba, método y límites (verificacion_micropipetas.csv,
-- cargado con scripts/cargar_verificacion_micropipetas.py). La recarga del CSV no pisa lo que
-- decide el laboratorio desde la app (columnas ajuste_respuesta* y v_bajo_elegido*).
create table if not exists verif_pipetas_parametros (
  id_activo       text primary key references equipos(id_activo) on update cascade on delete cascade,
  archivo         text,
  marca_modelo    text,
  multicanal      boolean not null default false,
  estado          text,
  rango           text,
  origen_rango    text,
  confirmar       text,           -- aviso: comprobar el rango en la pipeta
  ajuste_usuario  text,           -- 'sí' | 'no (servicio técnico)' | 'por comprobar (…)'
  v_nominal numeric, metodo_nominal text, patron_nominal text, masa_nominal_g numeric, es_nominal_pct numeric, cv_nominal_pct numeric,
  v_bajo    numeric, metodo_bajo    text, patron_bajo    text, masa_bajo_g    numeric, es_bajo_pct    numeric, cv_bajo_pct    numeric,
  fuente_limites  text,
  notas           text,
  version_csv     text,           -- fecha del CSV cargado
  cargado_en      timestamptz not null default now(),
  -- Respuesta del profesorado a «¿tiene tornillo de ajuste bajo la tapa del émbolo?» (6.5)
  ajuste_respuesta     text check (ajuste_respuesta in ('si', 'no')),
  ajuste_respuesta_por text,
  ajuste_respuesta_en  timestamptz,
  -- PIP-005: volumen bajo elegido según lo grabado (100 o 200 µl), para corregir el CSV
  v_bajo_elegido       numeric,
  v_bajo_elegido_por   text,
  v_bajo_elegido_en    timestamptz
);
alter table verif_pipetas_parametros enable row level security;
create policy "verif_pipetas_parametros_select" on verif_pipetas_parametros for select to authenticated using (true);

-- Preparación del curso (4): masas de S-A, S-B, S-C (y 2.º lote), D1, D2 y P1–P5, la
-- repetibilidad medida de las balanzas y los tubos congelados por bloque. Una por curso.
create table if not exists verif_preparaciones (
  id               text primary key,
  curso_academico  text not null unique,
  datos            jsonb not null default '{}',
  tubos            jsonb not null default '[]',   -- [{id, disolucion, bloque, m_vacio, m_lleno}]
  registrado_por   text,
  creado           timestamptz not null default now(),
  actualizado      timestamptz not null default now()
);
alter table verif_preparaciones enable row level security;
create policy "verif_preparaciones_select" on verif_preparaciones for select to authenticated using (true);

-- Sesiones de verificación (5): una por día; común a todas las pipetas de ese día.
-- `datos` es lo que se mide; `resultados`, lo que calcula el servidor al guardar.
create table if not exists verif_sesiones (
  id               text primary key,
  curso_academico  text not null,
  fecha            date not null,
  bloque           text,
  personas         text,           -- quien dirige y grupos (no se guardan nombres del alumnado)
  datos            jsonb not null default '{}',
  resultados       jsonb not null default '{}',
  registrado_por   text,
  creado           timestamptz not null default now(),
  actualizado      timestamptz not null default now()
);
create index if not exists idx_verif_sesiones_curso on verif_sesiones (curso_academico, fecha);
alter table verif_sesiones enable row level security;
create policy "verif_sesiones_select" on verif_sesiones for select to authenticated using (true);

-- Verificación de cada pipeta, dentro del registro de su revisión anual (o del bianual):
-- réplicas, sesiones, cálculo, límites usados y resultado (lo calcula el servidor).
alter table registro_mantenimientos add column if not exists verificacion jsonb;

-- Verificación EXTRAORDINARIA de una pipeta tras una reparación o un cambio de junta
-- (decisión de Paloma, 2026-11-25; plantilla de micropipetas 6.2 punto 4): fuera de
-- calendario, enlazada a la incidencia de la pipeta, sin cribado (10 réplicas a cada
-- volumen) y con los mismos cálculos. La pipeta solo vuelve a «Operativo» con resultado OK:
-- lo comprueba gestionar-incidencia al cerrar la incidencia. `verificacion` tiene la misma
-- forma que registro_mantenimientos.verificacion.
create table if not exists verif_extraordinarias (
  id               text primary key,
  id_equipo        text not null references equipos(id_activo),
  id_incidencia    text not null,
  curso_academico  text not null,
  estado           text not null default 'en_curso',   -- 'en_curso' | 'finalizada'
  verificacion     jsonb,
  resultado        text,                                -- clave de VP.RESULTADO (OK, RETIRAR…)
  fecha            date,
  realizado_por    text,
  creado           timestamptz not null default now(),
  actualizado      timestamptz not null default now()
);
create index if not exists idx_verif_extra_incidencia on verif_extraordinarias (id_incidencia);
alter table verif_extraordinarias enable row level security;
create policy "verif_extraordinarias_select" on verif_extraordinarias for select to authenticated using (true);
