-- ============================================================
-- GestionLab — primera cuenta de Administración (instalación nueva)
-- ============================================================
-- Sin esta cuenta no se puede entrar en la app. Se hace desde el navegador:
--
--   1. Supabase → Authentication → Users → «Add user» → «Create new user»:
--      email y contraseña de la persona que administra, con «Auto Confirm User»
--      marcado.
--   2. Supabase → SQL Editor: pegar este archivo, cambiar el email y el nombre de
--      las dos líneas marcadas con  <<<  y pulsar «Run».
--
-- Se puede repetir sin miedo: si la cuenta ya existe, la deja como Administración.
-- ============================================================

do $$
declare
  v_email  text := lower(trim('admin@ejemplo.org'));     -- <<< el email del paso 1
  v_nombre text := trim('Nombre Apellido');              -- <<< nombre y primer apellido
  v_id     uuid;
begin
  select id into v_id from auth.users where lower(email) = v_email;
  if v_id is null then
    raise exception 'No hay ningún login con el email %. Créalo antes en Authentication → Users → Add user.', v_email;
  end if;

  -- Perfil: es lo que miran las reglas de acceso (rol_sesion) y las funciones del servidor.
  insert into public.users (id, nombre, email, rol, activo)
  values (v_id, v_nombre, v_email, 'Administrador', true)
  on conflict (id) do update set rol = 'Administrador', activo = true;

  -- Catálogo de usuarios de la app.
  if exists (select 1 from public.usuarios where lower(email) = v_email) then
    update public.usuarios set rol = 'Administrador', activo = true where lower(email) = v_email;
  else
    insert into public.usuarios (id_usuario, nombre, email, rol, activo)
    values ('USR' || upper(substr(md5(random()::text), 1, 6)), v_nombre, v_email, 'Administrador', true);
  end if;

  raise notice 'Hecho: % ya puede entrar como Administración.', v_email;
end $$;
