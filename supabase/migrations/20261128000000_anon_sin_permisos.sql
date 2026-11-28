-- ============================================================
-- anon, sin ningún permiso sobre las tablas de public
-- ============================================================
-- Sin sesión no se lee ni se escribe nada: la app lo hace todo con sesión, y las
-- páginas públicas (pedido del proveedor) van por Edge Functions. Probado el
-- 2026-11-28 en gestionlab-prueba, donde anon no tiene ningún permiso: la app entra,
-- lee y guarda.
--
-- En la base real quedaban REFERENCES, TRIGGER, TRUNCATE y MAINTAIN en 45 tablas,
-- puestos por Supabase por defecto, y una regla que se los daba a cada tabla nueva
-- creada como postgres. En una instalación nueva no hacen nada (la migración base ya
-- no los da).
-- Copia de lo que había en la real: scripts/copias/permisos_anon_antes_2026-11-28.sql
-- (fuera de git).
-- ============================================================

revoke references, trigger, truncate, maintain on all tables in schema public from anon;

alter default privileges for role postgres in schema public
  revoke references, trigger, truncate, maintain on tables from anon;
