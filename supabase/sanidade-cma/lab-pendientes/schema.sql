-- Pendientes del laboratorio (GestionLab · página pública con enlace)
-- Proyecto Supabase compartido «sanidade-cma» (el mismo que GestionLab usa para ciclos y módulos).
-- Todas las tablas tienen RLS activado y NINGUNA política: solo las lee y escribe la Edge
-- Function «lab-pendientes» con la service_role key, después de comprobar el token del enlace.

create table if not exists public.lab_pendientes_config (
  clave       text primary key,
  valor       jsonb not null,
  actualizado timestamptz not null default now()
);
comment on table public.lab_pendientes_config is
  'Pendientes del laboratorio (GestionLab): configuración de la página pública — secciones y decisiones ya tomadas. Solo la usa la Edge Function lab-pendientes.';

create table if not exists public.lab_pendientes (
  id          text primary key check (id ~ '^[a-z0-9-]{1,40}$'),
  seccion     text not null,
  orden       double precision not null default 0,
  tipo        text not null default 'etiqueta'
              check (tipo in ('etiqueta','decision','documento','compra','gestion')),
  titulo      text not null check (char_length(titulo) between 1 and 300),
  detalle     text not null default '' check (char_length(detalle) <= 6000),
  equipos     text[] not null default '{}',
  labs        text[] not null default '{}',
  importante  boolean not null default false,
  estado      text not null default 'pendiente'
              check (estado in ('pendiente','en_curso','hecho','descartado')),
  origen      text not null default 'claude' check (origen in ('claude','enlace')),
  creado_por  text not null default '' check (char_length(creado_por) <= 80),
  archivada   boolean not null default false,  -- borrado lógico: no se muestra en la página
  creado      timestamptz not null default now(),
  actualizado timestamptz not null default now()
);
comment on table public.lab_pendientes is
  'Pendientes del laboratorio (GestionLab): una fila por tarea (identificar equipos, decisiones, compras…). La página pendientes.html de GestionLab las muestra por enlace con token.';

create table if not exists public.lab_pendientes_notas (
  id           uuid primary key default gen_random_uuid(),
  pendiente_id text not null references public.lab_pendientes(id) on delete cascade,
  tipo         text not null default 'nota' check (tipo in ('nota','respuesta','estado')),
  autor        text not null default '' check (char_length(autor) <= 80),
  texto        text not null default '' check (char_length(texto) <= 20000),
  adjuntos     jsonb not null default '[]'::jsonb check (jsonb_typeof(adjuntos) = 'array'),
  borrada      boolean not null default false,
  creado       timestamptz not null default now()
);
create index if not exists lab_pendientes_notas_pendiente_idx
  on public.lab_pendientes_notas (pendiente_id, creado);
comment on table public.lab_pendientes_notas is
  'Pendientes del laboratorio (GestionLab): hilo de cada tarea. tipo=nota (escrita desde la página, con adjuntos en el bucket lab-pendientes), respuesta (de Claude) o estado (cambio de estado). borrada=true es un borrado lógico.';

create table if not exists public.lab_pendientes_enlaces (
  id         uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  etiqueta   text not null default '',
  activo     boolean not null default true,
  creado     timestamptz not null default now(),
  revocado   timestamptz
);
comment on table public.lab_pendientes_enlaces is
  'Pendientes del laboratorio (GestionLab): enlaces de acceso sin cuenta. Solo se guarda el SHA-256 del token; el enlace completo lo tiene Paloma. Revocar = activo false.';

alter table public.lab_pendientes_config  enable row level security;
alter table public.lab_pendientes         enable row level security;
alter table public.lab_pendientes_notas   enable row level security;
alter table public.lab_pendientes_enlaces enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lab-pendientes', 'lab-pendientes', false, 20971520,
  array[
    'image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif',
    'application/pdf','video/mp4','video/webm','video/quicktime','text/plain','text/csv',
    'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.oasis.opendocument.text','application/vnd.oasis.opendocument.spreadsheet'
  ]
)
on conflict (id) do nothing;
