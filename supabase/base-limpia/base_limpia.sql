-- ============================================================
-- GestionLab — LÍNEA BASE para instalar desde cero (solo estructura, sin datos)
-- ============================================================
-- Generado por tools/base-limpia/sacar_base_limpia.py a partir de la base real.
-- ⚠ NO EDITAR A MANO: se vuelve a sacar con el script. Ver supabase/base-limpia/README.md.
--
-- Cómo se aplica: en un proyecto de Supabase VACÍO, pegar entero en el editor SQL y
-- ejecutar (o con psql -f). Va en una sola transacción: si algo falla, no queda nada
-- a medias.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Extensiones
-- ------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
DROP EXTENSION IF EXISTS "pg_graphql";

-- ------------------------------------------------------------
-- 2. Esquema public (pg_dump --schema-only)
-- ------------------------------------------------------------
--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.12

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--



--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role AS ENUM (
    'Administrador',
    'Gestor',
    'Profesor',
    'Alumno'
);


--
-- Name: rls_auto_enable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


--
-- Name: rol_sesion(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rol_sesion() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select rol::text from public.users where id = auth.uid() and activo
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: adiciones_residuo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.adiciones_residuo (
    id_adicion text NOT NULL,
    id_contenedor text NOT NULL,
    id_residuo text,
    fecha timestamp with time zone DEFAULT now() NOT NULL,
    usuario text,
    observaciones text,
    descripcion_libre text
);


--
-- Name: atributos_material; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.atributos_material (
    id_ficha text NOT NULL,
    categoria text NOT NULL,
    tipo_base text NOT NULL,
    orden integer DEFAULT 0 NOT NULL,
    atributos jsonb DEFAULT '[]'::jsonb NOT NULL,
    activa boolean DEFAULT true NOT NULL,
    nombre_base text
);


--
-- Name: cajas_congelado; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cajas_congelado (
    id_caja text NOT NULL,
    nombre text NOT NULL,
    id_equipo text NOT NULL,
    compartimento text,
    filas integer DEFAULT 9 NOT NULL,
    columnas integer DEFAULT 9 NOT NULL,
    descripcion text,
    activa boolean DEFAULT true NOT NULL,
    creado_por text,
    fecha_creacion timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cajas_congelado_columnas_check CHECK (((columnas >= 1) AND (columnas <= 26))),
    CONSTRAINT cajas_congelado_filas_check CHECK (((filas >= 1) AND (filas <= 26)))
);


--
-- Name: ciclos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ciclos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: config_reservas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.config_reservas (
    id_equipo text NOT NULL,
    politica text NOT NULL,
    params_template jsonb,
    max_horas numeric,
    antelacion_min_horas numeric
);


--
-- Name: consultas_residuo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.consultas_residuo (
    id_consulta text NOT NULL,
    fecha timestamp with time zone DEFAULT now() NOT NULL,
    usuario text,
    descripcion text,
    ubicacion_dejado text,
    estado text DEFAULT 'Pendiente'::text NOT NULL,
    categoria_ia text,
    guia_provisional text,
    prioridad text DEFAULT 'Normal'::text NOT NULL
);


--
-- Name: contenedores_residuo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contenedores_residuo (
    id_contenedor text NOT NULL,
    categoria text NOT NULL,
    lab text,
    zona text,
    nivel text,
    estado text DEFAULT 'activo'::text NOT NULL,
    fecha_apertura date,
    fecha_cierre date,
    fecha_actualizacion timestamp with time zone,
    actualizado_por text,
    formato text
);


--
-- Name: credenciales_grupo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credenciales_grupo (
    id_usuario text NOT NULL,
    password_cifrada text NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_por text
);


--
-- Name: TABLE credenciales_grupo; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.credenciales_grupo IS 'Copia cifrada (AES-256-GCM) de la contraseña de cada cuenta de GRUPO del alumnado, para que el profesorado pueda consultarla. Solo accesible con service_role desde gestionar-usuario. Nunca contraseñas de personas.';


--
-- Name: documentos_proveedor; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documentos_proveedor (
    id_documento text NOT NULL,
    pedido text NOT NULL,
    nombre_archivo text NOT NULL,
    path text NOT NULL,
    tamano_bytes integer,
    fecha_subida timestamp with time zone DEFAULT now() NOT NULL,
    datos_extraidos jsonb,
    extraido_en timestamp with time zone
);


--
-- Name: equipos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.equipos (
    id_activo text NOT NULL,
    tipo_equipo text NOT NULL,
    marca text,
    modelo text,
    numero_serie text,
    ubicacion text,
    responsable text,
    fecha_adquisicion text,
    origen_financiacion text,
    proveedor_compra text,
    proveedor_servicio_tecnico text,
    estado_operativo text,
    manual_ficha_tecnica text,
    observaciones text,
    coste numeric,
    protocolo_uso text,
    tipo_mantenimiento text,
    mes_inicio_temporada integer,
    mes_fin_temporada integer,
    modulos_responsables text,
    evaluaciones_uso text
);


--
-- Name: COLUMN equipos.evaluaciones_uso; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.equipos.evaluaciones_uso IS 'Evaluaciones del curso en que se usa el equipo: "1", "1,2", "1,2,3"... Vacío = todo el curso. Sustituye a mes_inicio/fin_temporada (2026-10-26).';


--
-- Name: evaluaciones_curso; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.evaluaciones_curso (
    curso_academico text NOT NULL,
    numero integer NOT NULL,
    fecha_inicio date NOT NULL,
    fecha_fin date NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT evaluaciones_curso_check CHECK ((fecha_fin >= fecha_inicio)),
    CONSTRAINT evaluaciones_curso_numero_check CHECK (((numero >= 1) AND (numero <= 3)))
);


--
-- Name: excepciones_residuo_ia; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.excepciones_residuo_ia (
    id_excepcion text NOT NULL,
    id_contenedor text,
    categoria_contenedor text,
    id_residuo text,
    descripcion_libre text,
    motivo_ia text,
    usuario text,
    fecha timestamp with time zone DEFAULT now() NOT NULL,
    estado text DEFAULT 'pendiente'::text NOT NULL,
    revisado_por text,
    fecha_revision timestamp with time zone
);


--
-- Name: historico_precio; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.historico_precio (
    id_historico text NOT NULL,
    nombre_material text,
    id_pedido text,
    proveedor text,
    fecha date,
    precio_unitario numeric,
    id_material text,
    id_linea text
);


--
-- Name: incidencias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.incidencias (
    id_incidencia text NOT NULL,
    id_equipo text NOT NULL,
    reportado_por text,
    fecha_hora timestamp with time zone DEFAULT now() NOT NULL,
    descripcion_problema text,
    impacto text,
    urgencia text,
    estado text,
    intervencion_generada text,
    relacionada_con text
);


--
-- Name: intervenciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.intervenciones (
    id_intervencion text NOT NULL,
    id_equipo text NOT NULL,
    tipo text,
    origen text,
    fecha_planificada date,
    fecha_realizacion date,
    realizado_por text,
    tecnico_externo text,
    proveedor text,
    descripcion_actuacion text,
    resultado text,
    equipo_operativo_tras_intervencion boolean,
    url_adjunto text,
    factura_asociada text,
    actualiza_proximo_preventivo boolean,
    observaciones text,
    nombre_adjunto text,
    estado text,
    fecha_estimada_resolucion date,
    coste_intervencion numeric,
    actuacion_finalizada boolean DEFAULT false NOT NULL,
    lugar_intervencion text,
    fecha_retirada date,
    fecha_devolucion date
);


--
-- Name: lineas_pedido; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lineas_pedido (
    id_linea text NOT NULL,
    pedido text NOT NULL,
    material text,
    cantidad_pedida numeric,
    cantidad_recibida numeric DEFAULT 0 NOT NULL,
    estado_linea text,
    observaciones text,
    precio_unitario numeric,
    id_equipo text,
    unidad text,
    id_material text,
    presupuesto_pendiente boolean DEFAULT false NOT NULL,
    material_comun boolean,
    conceptos_factura jsonb,
    sin_inventario boolean DEFAULT false NOT NULL,
    tipo_linea text DEFAULT 'Material'::text NOT NULL,
    id_intervencion text,
    albaranes text,
    CONSTRAINT lineas_pedido_tipo_linea_check CHECK ((tipo_linea = ANY (ARRAY['Material'::text, 'Equipo'::text, 'Servicio'::text])))
);


--
-- Name: material; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.material (
    id_material text NOT NULL,
    nombre text NOT NULL,
    categoria text,
    referencia_proveedor text,
    proveedor text,
    unidad text,
    ubicacion text,
    stock_actual numeric,
    stock_minimo numeric,
    stock_optimo numeric,
    observaciones text,
    gestion_automatica boolean DEFAULT false NOT NULL,
    unidades_extra text,
    atributos jsonb DEFAULT '{}'::jsonb NOT NULL,
    material_comun boolean DEFAULT false NOT NULL,
    reutilizable boolean DEFAULT false NOT NULL
);


--
-- Name: material_ubicaciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.material_ubicaciones (
    id text NOT NULL,
    id_material text NOT NULL,
    id_ubicacion text NOT NULL,
    stock_local numeric DEFAULT 0 NOT NULL,
    stock_minimo_local numeric,
    stock_optimo_local numeric,
    id_lote_padre text,
    unidad_lote text,
    requiere_esteril boolean DEFAULT false NOT NULL
);


--
-- Name: modulo_ciclo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.modulo_ciclo (
    ciclo_id uuid NOT NULL,
    modulo_id uuid NOT NULL
);


--
-- Name: modulos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.modulos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre text NOT NULL,
    lab_teoria text,
    lab_practicas text,
    horas_semanales integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: movimientos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.movimientos (
    id_movimiento text NOT NULL,
    material text,
    tipo text,
    cantidad numeric,
    usuario text,
    fecha timestamp with time zone DEFAULT now() NOT NULL,
    motivo text,
    observaciones text,
    id_material text
);


--
-- Name: muestras_congeladas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.muestras_congeladas (
    id_muestra text NOT NULL,
    id_lote text NOT NULL,
    tipo text NOT NULL,
    nombre text NOT NULL,
    abreviatura text,
    id_caja text NOT NULL,
    posicion text NOT NULL,
    formato text NOT NULL,
    cantidad_inicial numeric,
    cantidad_actual numeric,
    unidad text,
    descongelaciones integer DEFAULT 0 NOT NULL,
    pase integer,
    id_lote_origen text,
    fecha_congelacion date,
    caducidad date,
    id_material text,
    datos jsonb DEFAULT '{}'::jsonb NOT NULL,
    observaciones text,
    estado text DEFAULT 'Disponible'::text NOT NULL,
    fecha_baja date,
    motivo_baja text,
    creado_por text,
    fecha_alta timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT muestras_congeladas_estado_check CHECK ((estado = ANY (ARRAY['Disponible'::text, 'Agotada'::text, 'Descartada'::text]))),
    CONSTRAINT muestras_congeladas_formato_check CHECK ((formato = ANY (ARRAY['Bolitas'::text, 'Tubo'::text, 'Volumen'::text]))),
    CONSTRAINT muestras_congeladas_tipo_check CHECK ((tipo = ANY (ARRAY['Cepa'::text, 'Línea celular'::text, 'Ácido nucleico'::text, 'Suero o plasma'::text, 'Reactivo'::text])))
);


--
-- Name: pedidos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pedidos (
    id_pedido text NOT NULL,
    nombre_lista text,
    proveedor text,
    fecha_creacion date,
    fecha_presupuesto date,
    fecha_aprobacion date,
    fecha_pedido_enviado date,
    fecha_recepcion_completa date,
    fecha_factura date,
    estado text DEFAULT 'Abierto'::text NOT NULL,
    numero_presupuesto text,
    numero_factura text,
    observaciones text,
    doc_hoja_generada boolean DEFAULT false NOT NULL,
    doc_enviada_jefatura boolean DEFAULT false NOT NULL,
    ciclo text,
    modulo text,
    tipo text DEFAULT 'Material'::text NOT NULL,
    gasto_extra_concepto text,
    gasto_extra_importe numeric,
    doc_hoja_path text,
    trebello_pedido_id text,
    fecha_envio_trebello timestamp with time zone,
    trebello_pedido_comun_id text,
    hoja_factura jsonb
);


--
-- Name: pedidos_token; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pedidos_token (
    id_pedido text NOT NULL,
    token text NOT NULL
);


--
-- Name: planes_mantenimiento; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.planes_mantenimiento (
    id_plan text NOT NULL,
    id_equipo text NOT NULL,
    tipo_intervencion text,
    periodicidad text,
    activo boolean DEFAULT true NOT NULL,
    operacion text,
    instrucciones text,
    solo_profesorado boolean DEFAULT false NOT NULL,
    curso_inicio text,
    CONSTRAINT planes_mantenimiento_curso_inicio_formato CHECK (((curso_inicio IS NULL) OR (curso_inicio ~ '^[0-9]{4}-[0-9]{4}$'::text)))
);


--
-- Name: COLUMN planes_mantenimiento.solo_profesorado; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.planes_mantenimiento.solo_profesorado IS 'Excepción: reserva este plan al profesorado. Por defecto los mantenimientos internos los realiza el alumnado y el profesorado da el visto bueno; los externos quedan fuera por tipo_intervencion.';


--
-- Name: propuestas_material; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.propuestas_material (
    id_propuesta text NOT NULL,
    categoria text NOT NULL,
    tipo_base text,
    nombre_base text,
    atributos jsonb DEFAULT '{}'::jsonb NOT NULL,
    texto_etiqueta text,
    nombre_generado text,
    unidad text,
    cantidad numeric,
    id_ubicacion text,
    foto_path text,
    id_material_sugerido text,
    ia_extraido jsonb,
    ia_avisos text,
    propuesto_por text,
    email_propuesto_por text,
    observaciones text,
    fecha timestamp with time zone DEFAULT now() NOT NULL,
    estado text DEFAULT 'pendiente'::text NOT NULL,
    revisado_por text,
    fecha_revision timestamp with time zone,
    notas_revision text,
    id_material_creado text
);


--
-- Name: propuestas_ubicacion_equipo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.propuestas_ubicacion_equipo (
    id_propuesta text NOT NULL,
    id_equipo text NOT NULL,
    id_ubicacion text,
    no_encontrado boolean DEFAULT false NOT NULL,
    ubicacion_anterior text,
    propuesto_por text,
    email_propuesto_por text,
    observaciones text,
    fecha timestamp with time zone DEFAULT now() NOT NULL,
    estado text DEFAULT 'pendiente'::text NOT NULL,
    revisado_por text,
    fecha_revision timestamp with time zone,
    notas_revision text
);


--
-- Name: proveedores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.proveedores (
    id_proveedor text NOT NULL,
    nombre_proveedor text NOT NULL,
    tipo_proveedor text,
    persona_contacto text,
    email_contacto text,
    telefono text,
    web text,
    observaciones text,
    activo boolean DEFAULT true NOT NULL
);


--
-- Name: registro_mantenimientos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.registro_mantenimientos (
    id_registro text NOT NULL,
    id_plan text NOT NULL,
    id_equipo text NOT NULL,
    curso_academico text,
    periodo text,
    fecha_realizacion date,
    realizado_por text,
    supervisado_por text,
    observaciones text,
    estado text DEFAULT 'finalizado'::text NOT NULL,
    pasos jsonb,
    fecha_inicio date,
    iniciado_por text,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    aplazado_a date,
    verificacion jsonb,
    resultado text
);


--
-- Name: registros_autoclave; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.registros_autoclave (
    id_registro text NOT NULL,
    id_equipo text NOT NULL,
    usuario text,
    fecha date NOT NULL,
    hora_inicio time without time zone,
    hora_fin time without time zone,
    programa_ciclo text,
    tipo_carga text,
    resultado_control text,
    incidencias text,
    estado text DEFAULT 'Cerrada'::text NOT NULL,
    temperatura_max numeric,
    presion_max numeric,
    cinta_indicadora text,
    integrador_quimico text,
    indicador_biologico text,
    resultado_biologico text,
    fecha_lectura_biologico date,
    biologico_leido_por text,
    correcciones jsonb DEFAULT '[]'::jsonb NOT NULL
);


--
-- Name: registros_cabina; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.registros_cabina (
    id_registro text NOT NULL,
    id_equipo text NOT NULL,
    usuario text,
    fecha date NOT NULL,
    hora_inicio time without time zone,
    hora_fin time without time zone,
    practica_tecnica text,
    nivel_riesgo text,
    verificacion_previa text,
    descontaminacion_posterior text,
    incidencias text,
    estado text DEFAULT 'Abierta'::text NOT NULL,
    grupo_riesgo text,
    desinfeccion_inicial text,
    minutos_uv integer,
    correcciones jsonb DEFAULT '[]'::jsonb NOT NULL
);


--
-- Name: registros_vitrina; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.registros_vitrina (
    id_registro text NOT NULL,
    id_equipo text NOT NULL,
    usuario text,
    fecha date NOT NULL,
    hora_inicio time without time zone,
    hora_fin time without time zone,
    practica_tecnica text,
    productos_quimicos text,
    verificacion_previa text,
    limpieza_posterior text,
    incidencias text,
    estado text DEFAULT 'Abierta'::text NOT NULL,
    correcciones jsonb DEFAULT '[]'::jsonb NOT NULL
);


--
-- Name: reservas_equipos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reservas_equipos (
    id_reserva text NOT NULL,
    id_equipo text NOT NULL,
    usuario text,
    fecha_inicio timestamp with time zone NOT NULL,
    fecha_fin timestamp with time zone NOT NULL,
    condiciones jsonb,
    proposito text,
    estado text DEFAULT 'Confirmada'::text NOT NULL,
    aprobado_por text,
    observaciones_admin text,
    inicio_real timestamp with time zone,
    fin_real timestamp with time zone
);


--
-- Name: revisiones_inventario; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.revisiones_inventario (
    id_revision text NOT NULL,
    fecha timestamp with time zone DEFAULT now() NOT NULL,
    id_material text,
    nombre_material text,
    stock_app numeric,
    stock_real numeric,
    diferencia numeric,
    usuario text,
    observaciones text,
    id_lote text,
    id_ubicacion text
);


--
-- Name: solicitudes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.solicitudes (
    id_solicitud text NOT NULL,
    material text,
    cantidad_solicitada numeric,
    solicitante text,
    fecha timestamp with time zone DEFAULT now() NOT NULL,
    motivo text,
    proveedor_requerido text,
    estado text DEFAULT 'Pendiente'::text NOT NULL,
    lista_pedido text,
    observaciones text,
    snooze_hasta date,
    id_material text,
    compra_fecha date,
    compra_importe numeric,
    compra_nota text,
    tipo text DEFAULT 'Material'::text NOT NULL
);


--
-- Name: tareas_intervencion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tareas_intervencion (
    id_tarea text NOT NULL,
    id_intervencion text NOT NULL,
    descripcion text,
    resultado text,
    operativo boolean,
    observaciones text
);


--
-- Name: tareas_personales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tareas_personales (
    id_tarea text NOT NULL,
    email text NOT NULL,
    texto text NOT NULL,
    fecha_limite date,
    completada boolean DEFAULT false NOT NULL,
    fecha_creacion timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tipos_residuo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tipos_residuo (
    id_residuo text NOT NULL,
    nombre text NOT NULL,
    descripcion text,
    riesgo text,
    contenedor_tipo text,
    lab text,
    zona text
);


--
-- Name: ubicaciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ubicaciones (
    id_ubicacion text NOT NULL,
    laboratorio_aula text,
    zona text,
    subzona text,
    descripcion_completa text,
    activa boolean DEFAULT true NOT NULL
);


--
-- Name: user_modulos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_modulos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    modulo_id uuid NOT NULL,
    curso_academico text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    gestionlab_id text,
    nombre text NOT NULL,
    email text NOT NULL,
    rol public.user_role DEFAULT 'Alumno'::public.user_role NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    ciclo_principal_id uuid,
    puede_revisar_inventario boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: usos_muestra; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usos_muestra (
    id_uso text NOT NULL,
    id_muestra text NOT NULL,
    id_lote text NOT NULL,
    evento text DEFAULT 'Uso'::text NOT NULL,
    fecha timestamp with time zone DEFAULT now() NOT NULL,
    autor text,
    motivo text,
    cantidad numeric,
    restante numeric,
    unidad text,
    id_lote_nuevo text,
    CONSTRAINT usos_muestra_evento_check CHECK ((evento = ANY (ARRAY['Uso'::text, 'Nuevo stock'::text, 'Descarte'::text, 'Ajuste'::text])))
);


--
-- Name: usuarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuarios (
    id_usuario text NOT NULL,
    nombre text NOT NULL,
    email text NOT NULL,
    rol text DEFAULT 'Alumno'::text NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    ubicaciones_asignadas text,
    modulo text,
    ciclo_principal text,
    puede_revisar_inventario boolean DEFAULT false NOT NULL,
    grupos_asignados text
);


--
-- Name: COLUMN usuarios.grupos_asignados; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.usuarios.grupos_asignados IS 'IDs de las cuentas de GRUPO del alumnado que lleva este docente, separados por coma. Se asigna a mano desde el modal de usuario.';


--
-- Name: verif_extraordinarias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.verif_extraordinarias (
    id text NOT NULL,
    id_equipo text NOT NULL,
    id_incidencia text NOT NULL,
    curso_academico text NOT NULL,
    estado text DEFAULT 'en_curso'::text NOT NULL,
    verificacion jsonb,
    resultado text,
    fecha date,
    realizado_por text,
    creado timestamp with time zone DEFAULT now() NOT NULL,
    actualizado timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: verif_pipetas_parametros; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.verif_pipetas_parametros (
    id_activo text NOT NULL,
    archivo text,
    marca_modelo text,
    multicanal boolean DEFAULT false NOT NULL,
    estado text,
    rango text,
    origen_rango text,
    confirmar text,
    ajuste_usuario text,
    v_nominal numeric,
    metodo_nominal text,
    patron_nominal text,
    masa_nominal_g numeric,
    es_nominal_pct numeric,
    cv_nominal_pct numeric,
    v_bajo numeric,
    metodo_bajo text,
    patron_bajo text,
    masa_bajo_g numeric,
    es_bajo_pct numeric,
    cv_bajo_pct numeric,
    fuente_limites text,
    notas text,
    version_csv text,
    cargado_en timestamp with time zone DEFAULT now() NOT NULL,
    ajuste_respuesta text,
    ajuste_respuesta_por text,
    ajuste_respuesta_en timestamp with time zone,
    v_bajo_elegido numeric,
    v_bajo_elegido_por text,
    v_bajo_elegido_en timestamp with time zone,
    CONSTRAINT verif_pipetas_parametros_ajuste_respuesta_check CHECK ((ajuste_respuesta = ANY (ARRAY['si'::text, 'no'::text])))
);


--
-- Name: verif_preparaciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.verif_preparaciones (
    id text NOT NULL,
    curso_academico text NOT NULL,
    datos jsonb DEFAULT '{}'::jsonb NOT NULL,
    tubos jsonb DEFAULT '[]'::jsonb NOT NULL,
    registrado_por text,
    creado timestamp with time zone DEFAULT now() NOT NULL,
    actualizado timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: verif_sesiones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.verif_sesiones (
    id text NOT NULL,
    curso_academico text NOT NULL,
    fecha date NOT NULL,
    bloque text,
    personas text,
    datos jsonb DEFAULT '{}'::jsonb NOT NULL,
    resultados jsonb DEFAULT '{}'::jsonb NOT NULL,
    registrado_por text,
    creado timestamp with time zone DEFAULT now() NOT NULL,
    actualizado timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: adiciones_residuo adiciones_residuo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adiciones_residuo
    ADD CONSTRAINT adiciones_residuo_pkey PRIMARY KEY (id_adicion);


--
-- Name: atributos_material atributos_material_categoria_tipo_base_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atributos_material
    ADD CONSTRAINT atributos_material_categoria_tipo_base_key UNIQUE (categoria, tipo_base);


--
-- Name: atributos_material atributos_material_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atributos_material
    ADD CONSTRAINT atributos_material_pkey PRIMARY KEY (id_ficha);


--
-- Name: cajas_congelado cajas_congelado_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cajas_congelado
    ADD CONSTRAINT cajas_congelado_pkey PRIMARY KEY (id_caja);


--
-- Name: ciclos ciclos_nombre_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ciclos
    ADD CONSTRAINT ciclos_nombre_key UNIQUE (nombre);


--
-- Name: ciclos ciclos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ciclos
    ADD CONSTRAINT ciclos_pkey PRIMARY KEY (id);


--
-- Name: config_reservas config_reservas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.config_reservas
    ADD CONSTRAINT config_reservas_pkey PRIMARY KEY (id_equipo);


--
-- Name: consultas_residuo consultas_residuo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consultas_residuo
    ADD CONSTRAINT consultas_residuo_pkey PRIMARY KEY (id_consulta);


--
-- Name: contenedores_residuo contenedores_residuo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contenedores_residuo
    ADD CONSTRAINT contenedores_residuo_pkey PRIMARY KEY (id_contenedor);


--
-- Name: credenciales_grupo credenciales_grupo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credenciales_grupo
    ADD CONSTRAINT credenciales_grupo_pkey PRIMARY KEY (id_usuario);


--
-- Name: documentos_proveedor documentos_proveedor_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_proveedor
    ADD CONSTRAINT documentos_proveedor_pkey PRIMARY KEY (id_documento);


--
-- Name: equipos equipos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipos
    ADD CONSTRAINT equipos_pkey PRIMARY KEY (id_activo);


--
-- Name: evaluaciones_curso evaluaciones_curso_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluaciones_curso
    ADD CONSTRAINT evaluaciones_curso_pkey PRIMARY KEY (curso_academico, numero);


--
-- Name: excepciones_residuo_ia excepciones_residuo_ia_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.excepciones_residuo_ia
    ADD CONSTRAINT excepciones_residuo_ia_pkey PRIMARY KEY (id_excepcion);


--
-- Name: historico_precio historico_precio_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historico_precio
    ADD CONSTRAINT historico_precio_pkey PRIMARY KEY (id_historico);


--
-- Name: incidencias incidencias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidencias
    ADD CONSTRAINT incidencias_pkey PRIMARY KEY (id_incidencia);


--
-- Name: intervenciones intervenciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intervenciones
    ADD CONSTRAINT intervenciones_pkey PRIMARY KEY (id_intervencion);


--
-- Name: lineas_pedido lineas_pedido_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lineas_pedido
    ADD CONSTRAINT lineas_pedido_pkey PRIMARY KEY (id_linea);


--
-- Name: material material_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material
    ADD CONSTRAINT material_pkey PRIMARY KEY (id_material);


--
-- Name: material_ubicaciones material_ubicaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_ubicaciones
    ADD CONSTRAINT material_ubicaciones_pkey PRIMARY KEY (id);


--
-- Name: modulo_ciclo modulo_ciclo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modulo_ciclo
    ADD CONSTRAINT modulo_ciclo_pkey PRIMARY KEY (ciclo_id, modulo_id);


--
-- Name: modulos modulos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modulos
    ADD CONSTRAINT modulos_pkey PRIMARY KEY (id);


--
-- Name: movimientos movimientos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimientos
    ADD CONSTRAINT movimientos_pkey PRIMARY KEY (id_movimiento);


--
-- Name: muestras_congeladas muestras_congeladas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.muestras_congeladas
    ADD CONSTRAINT muestras_congeladas_pkey PRIMARY KEY (id_muestra);


--
-- Name: pedidos pedidos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedidos
    ADD CONSTRAINT pedidos_pkey PRIMARY KEY (id_pedido);


--
-- Name: pedidos_token pedidos_token_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedidos_token
    ADD CONSTRAINT pedidos_token_pkey PRIMARY KEY (id_pedido);


--
-- Name: planes_mantenimiento planes_mantenimiento_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planes_mantenimiento
    ADD CONSTRAINT planes_mantenimiento_pkey PRIMARY KEY (id_plan);


--
-- Name: propuestas_material propuestas_material_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.propuestas_material
    ADD CONSTRAINT propuestas_material_pkey PRIMARY KEY (id_propuesta);


--
-- Name: propuestas_ubicacion_equipo propuestas_ubicacion_equipo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.propuestas_ubicacion_equipo
    ADD CONSTRAINT propuestas_ubicacion_equipo_pkey PRIMARY KEY (id_propuesta);


--
-- Name: proveedores proveedores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proveedores
    ADD CONSTRAINT proveedores_pkey PRIMARY KEY (id_proveedor);


--
-- Name: registro_mantenimientos registro_mantenimientos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registro_mantenimientos
    ADD CONSTRAINT registro_mantenimientos_pkey PRIMARY KEY (id_registro);


--
-- Name: registros_autoclave registros_autoclave_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registros_autoclave
    ADD CONSTRAINT registros_autoclave_pkey PRIMARY KEY (id_registro);


--
-- Name: registros_cabina registros_cabina_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registros_cabina
    ADD CONSTRAINT registros_cabina_pkey PRIMARY KEY (id_registro);


--
-- Name: registros_vitrina registros_vitrina_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registros_vitrina
    ADD CONSTRAINT registros_vitrina_pkey PRIMARY KEY (id_registro);


--
-- Name: reservas_equipos reservas_equipos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservas_equipos
    ADD CONSTRAINT reservas_equipos_pkey PRIMARY KEY (id_reserva);


--
-- Name: revisiones_inventario revisiones_inventario_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revisiones_inventario
    ADD CONSTRAINT revisiones_inventario_pkey PRIMARY KEY (id_revision);


--
-- Name: solicitudes solicitudes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes
    ADD CONSTRAINT solicitudes_pkey PRIMARY KEY (id_solicitud);


--
-- Name: tareas_intervencion tareas_intervencion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tareas_intervencion
    ADD CONSTRAINT tareas_intervencion_pkey PRIMARY KEY (id_tarea);


--
-- Name: tareas_personales tareas_personales_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tareas_personales
    ADD CONSTRAINT tareas_personales_pkey PRIMARY KEY (id_tarea);


--
-- Name: tipos_residuo tipos_residuo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tipos_residuo
    ADD CONSTRAINT tipos_residuo_pkey PRIMARY KEY (id_residuo);


--
-- Name: ubicaciones ubicaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ubicaciones
    ADD CONSTRAINT ubicaciones_pkey PRIMARY KEY (id_ubicacion);


--
-- Name: user_modulos user_modulos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_modulos
    ADD CONSTRAINT user_modulos_pkey PRIMARY KEY (id);


--
-- Name: user_modulos user_modulos_user_id_modulo_id_curso_academico_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_modulos
    ADD CONSTRAINT user_modulos_user_id_modulo_id_curso_academico_key UNIQUE (user_id, modulo_id, curso_academico);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_gestionlab_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_gestionlab_id_key UNIQUE (gestionlab_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: usos_muestra usos_muestra_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usos_muestra
    ADD CONSTRAINT usos_muestra_pkey PRIMARY KEY (id_uso);


--
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id_usuario);


--
-- Name: verif_extraordinarias verif_extraordinarias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verif_extraordinarias
    ADD CONSTRAINT verif_extraordinarias_pkey PRIMARY KEY (id);


--
-- Name: verif_pipetas_parametros verif_pipetas_parametros_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verif_pipetas_parametros
    ADD CONSTRAINT verif_pipetas_parametros_pkey PRIMARY KEY (id_activo);


--
-- Name: verif_preparaciones verif_preparaciones_curso_academico_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verif_preparaciones
    ADD CONSTRAINT verif_preparaciones_curso_academico_key UNIQUE (curso_academico);


--
-- Name: verif_preparaciones verif_preparaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verif_preparaciones
    ADD CONSTRAINT verif_preparaciones_pkey PRIMARY KEY (id);


--
-- Name: verif_sesiones verif_sesiones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verif_sesiones
    ADD CONSTRAINT verif_sesiones_pkey PRIMARY KEY (id);


--
-- Name: idx_atributos_material_categoria; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_atributos_material_categoria ON public.atributos_material USING btree (categoria);


--
-- Name: idx_cajas_congelado_equipo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cajas_congelado_equipo ON public.cajas_congelado USING btree (id_equipo);


--
-- Name: idx_historico_precio_id_material; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_historico_precio_id_material ON public.historico_precio USING btree (id_material);


--
-- Name: idx_historico_precio_pedido_linea; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_historico_precio_pedido_linea ON public.historico_precio USING btree (id_pedido, id_linea);


--
-- Name: idx_lineas_pedido_id_intervencion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lineas_pedido_id_intervencion ON public.lineas_pedido USING btree (id_intervencion);


--
-- Name: idx_lineas_pedido_id_material; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lineas_pedido_id_material ON public.lineas_pedido USING btree (id_material);


--
-- Name: idx_movimientos_id_material; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_movimientos_id_material ON public.movimientos USING btree (id_material);


--
-- Name: idx_muestras_congeladas_caja; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_muestras_congeladas_caja ON public.muestras_congeladas USING btree (id_caja);


--
-- Name: idx_muestras_congeladas_lote; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_muestras_congeladas_lote ON public.muestras_congeladas USING btree (id_lote);


--
-- Name: idx_muestras_congeladas_origen; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_muestras_congeladas_origen ON public.muestras_congeladas USING btree (id_lote_origen);


--
-- Name: idx_propuestas_material_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_propuestas_material_estado ON public.propuestas_material USING btree (estado);


--
-- Name: idx_propuestas_material_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_propuestas_material_fecha ON public.propuestas_material USING btree (fecha DESC);


--
-- Name: idx_propuestas_ubic_equipo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_propuestas_ubic_equipo ON public.propuestas_ubicacion_equipo USING btree (id_equipo);


--
-- Name: idx_propuestas_ubic_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_propuestas_ubic_estado ON public.propuestas_ubicacion_equipo USING btree (estado);


--
-- Name: idx_solicitudes_id_material; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_solicitudes_id_material ON public.solicitudes USING btree (id_material);


--
-- Name: idx_usos_muestra_lote; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usos_muestra_lote ON public.usos_muestra USING btree (id_lote);


--
-- Name: idx_usos_muestra_muestra; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usos_muestra_muestra ON public.usos_muestra USING btree (id_muestra);


--
-- Name: idx_verif_extra_incidencia; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_verif_extra_incidencia ON public.verif_extraordinarias USING btree (id_incidencia);


--
-- Name: idx_verif_sesiones_curso; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_verif_sesiones_curso ON public.verif_sesiones USING btree (curso_academico, fecha);


--
-- Name: uq_muestras_congeladas_casilla; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_muestras_congeladas_casilla ON public.muestras_congeladas USING btree (id_caja, posicion) WHERE (estado = 'Disponible'::text);


--
-- Name: adiciones_residuo adiciones_residuo_id_contenedor_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adiciones_residuo
    ADD CONSTRAINT adiciones_residuo_id_contenedor_fkey FOREIGN KEY (id_contenedor) REFERENCES public.contenedores_residuo(id_contenedor) ON DELETE CASCADE;


--
-- Name: adiciones_residuo adiciones_residuo_id_residuo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adiciones_residuo
    ADD CONSTRAINT adiciones_residuo_id_residuo_fkey FOREIGN KEY (id_residuo) REFERENCES public.tipos_residuo(id_residuo);


--
-- Name: cajas_congelado cajas_congelado_id_equipo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cajas_congelado
    ADD CONSTRAINT cajas_congelado_id_equipo_fkey FOREIGN KEY (id_equipo) REFERENCES public.equipos(id_activo) ON UPDATE CASCADE;


--
-- Name: config_reservas config_reservas_id_equipo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.config_reservas
    ADD CONSTRAINT config_reservas_id_equipo_fkey FOREIGN KEY (id_equipo) REFERENCES public.equipos(id_activo) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: credenciales_grupo credenciales_grupo_id_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credenciales_grupo
    ADD CONSTRAINT credenciales_grupo_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id_usuario) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: documentos_proveedor documentos_proveedor_pedido_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_proveedor
    ADD CONSTRAINT documentos_proveedor_pedido_fkey FOREIGN KEY (pedido) REFERENCES public.pedidos(id_pedido) ON DELETE CASCADE;


--
-- Name: excepciones_residuo_ia excepciones_residuo_ia_id_contenedor_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.excepciones_residuo_ia
    ADD CONSTRAINT excepciones_residuo_ia_id_contenedor_fkey FOREIGN KEY (id_contenedor) REFERENCES public.contenedores_residuo(id_contenedor) ON DELETE SET NULL;


--
-- Name: excepciones_residuo_ia excepciones_residuo_ia_id_residuo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.excepciones_residuo_ia
    ADD CONSTRAINT excepciones_residuo_ia_id_residuo_fkey FOREIGN KEY (id_residuo) REFERENCES public.tipos_residuo(id_residuo) ON DELETE SET NULL;


--
-- Name: historico_precio historico_precio_id_material_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historico_precio
    ADD CONSTRAINT historico_precio_id_material_fkey FOREIGN KEY (id_material) REFERENCES public.material(id_material) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: historico_precio historico_precio_id_pedido_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historico_precio
    ADD CONSTRAINT historico_precio_id_pedido_fkey FOREIGN KEY (id_pedido) REFERENCES public.pedidos(id_pedido) ON DELETE SET NULL;


--
-- Name: incidencias incidencias_id_equipo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidencias
    ADD CONSTRAINT incidencias_id_equipo_fkey FOREIGN KEY (id_equipo) REFERENCES public.equipos(id_activo) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: incidencias incidencias_intervencion_generada_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidencias
    ADD CONSTRAINT incidencias_intervencion_generada_fkey FOREIGN KEY (intervencion_generada) REFERENCES public.intervenciones(id_intervencion);


--
-- Name: incidencias incidencias_relacionada_con_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidencias
    ADD CONSTRAINT incidencias_relacionada_con_fkey FOREIGN KEY (relacionada_con) REFERENCES public.incidencias(id_incidencia);


--
-- Name: intervenciones intervenciones_id_equipo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intervenciones
    ADD CONSTRAINT intervenciones_id_equipo_fkey FOREIGN KEY (id_equipo) REFERENCES public.equipos(id_activo) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: lineas_pedido lineas_pedido_id_equipo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lineas_pedido
    ADD CONSTRAINT lineas_pedido_id_equipo_fkey FOREIGN KEY (id_equipo) REFERENCES public.equipos(id_activo) ON UPDATE CASCADE;


--
-- Name: lineas_pedido lineas_pedido_id_intervencion_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lineas_pedido
    ADD CONSTRAINT lineas_pedido_id_intervencion_fkey FOREIGN KEY (id_intervencion) REFERENCES public.intervenciones(id_intervencion) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: lineas_pedido lineas_pedido_id_material_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lineas_pedido
    ADD CONSTRAINT lineas_pedido_id_material_fkey FOREIGN KEY (id_material) REFERENCES public.material(id_material) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: lineas_pedido lineas_pedido_pedido_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lineas_pedido
    ADD CONSTRAINT lineas_pedido_pedido_fkey FOREIGN KEY (pedido) REFERENCES public.pedidos(id_pedido) ON DELETE CASCADE;


--
-- Name: material_ubicaciones material_ubicaciones_id_lote_padre_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_ubicaciones
    ADD CONSTRAINT material_ubicaciones_id_lote_padre_fkey FOREIGN KEY (id_lote_padre) REFERENCES public.material_ubicaciones(id);


--
-- Name: material_ubicaciones material_ubicaciones_id_material_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_ubicaciones
    ADD CONSTRAINT material_ubicaciones_id_material_fkey FOREIGN KEY (id_material) REFERENCES public.material(id_material) ON DELETE CASCADE;


--
-- Name: material_ubicaciones material_ubicaciones_id_ubicacion_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_ubicaciones
    ADD CONSTRAINT material_ubicaciones_id_ubicacion_fkey FOREIGN KEY (id_ubicacion) REFERENCES public.ubicaciones(id_ubicacion) ON UPDATE CASCADE;


--
-- Name: modulo_ciclo modulo_ciclo_ciclo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modulo_ciclo
    ADD CONSTRAINT modulo_ciclo_ciclo_id_fkey FOREIGN KEY (ciclo_id) REFERENCES public.ciclos(id) ON DELETE CASCADE;


--
-- Name: modulo_ciclo modulo_ciclo_modulo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modulo_ciclo
    ADD CONSTRAINT modulo_ciclo_modulo_id_fkey FOREIGN KEY (modulo_id) REFERENCES public.modulos(id) ON DELETE CASCADE;


--
-- Name: movimientos movimientos_id_material_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimientos
    ADD CONSTRAINT movimientos_id_material_fkey FOREIGN KEY (id_material) REFERENCES public.material(id_material) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: muestras_congeladas muestras_congeladas_id_caja_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.muestras_congeladas
    ADD CONSTRAINT muestras_congeladas_id_caja_fkey FOREIGN KEY (id_caja) REFERENCES public.cajas_congelado(id_caja) ON UPDATE CASCADE;


--
-- Name: muestras_congeladas muestras_congeladas_id_material_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.muestras_congeladas
    ADD CONSTRAINT muestras_congeladas_id_material_fkey FOREIGN KEY (id_material) REFERENCES public.material(id_material) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: pedidos_token pedidos_token_id_pedido_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedidos_token
    ADD CONSTRAINT pedidos_token_id_pedido_fkey FOREIGN KEY (id_pedido) REFERENCES public.pedidos(id_pedido) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: planes_mantenimiento planes_mantenimiento_id_equipo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planes_mantenimiento
    ADD CONSTRAINT planes_mantenimiento_id_equipo_fkey FOREIGN KEY (id_equipo) REFERENCES public.equipos(id_activo) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: propuestas_material propuestas_material_id_material_creado_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.propuestas_material
    ADD CONSTRAINT propuestas_material_id_material_creado_fkey FOREIGN KEY (id_material_creado) REFERENCES public.material(id_material) ON DELETE SET NULL;


--
-- Name: propuestas_material propuestas_material_id_material_sugerido_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.propuestas_material
    ADD CONSTRAINT propuestas_material_id_material_sugerido_fkey FOREIGN KEY (id_material_sugerido) REFERENCES public.material(id_material) ON DELETE SET NULL;


--
-- Name: propuestas_material propuestas_material_id_ubicacion_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.propuestas_material
    ADD CONSTRAINT propuestas_material_id_ubicacion_fkey FOREIGN KEY (id_ubicacion) REFERENCES public.ubicaciones(id_ubicacion) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: propuestas_ubicacion_equipo propuestas_ubicacion_equipo_id_equipo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.propuestas_ubicacion_equipo
    ADD CONSTRAINT propuestas_ubicacion_equipo_id_equipo_fkey FOREIGN KEY (id_equipo) REFERENCES public.equipos(id_activo) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: propuestas_ubicacion_equipo propuestas_ubicacion_equipo_id_ubicacion_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.propuestas_ubicacion_equipo
    ADD CONSTRAINT propuestas_ubicacion_equipo_id_ubicacion_fkey FOREIGN KEY (id_ubicacion) REFERENCES public.ubicaciones(id_ubicacion) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: registro_mantenimientos registro_mantenimientos_id_equipo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registro_mantenimientos
    ADD CONSTRAINT registro_mantenimientos_id_equipo_fkey FOREIGN KEY (id_equipo) REFERENCES public.equipos(id_activo) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: registro_mantenimientos registro_mantenimientos_id_plan_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registro_mantenimientos
    ADD CONSTRAINT registro_mantenimientos_id_plan_fkey FOREIGN KEY (id_plan) REFERENCES public.planes_mantenimiento(id_plan) ON DELETE CASCADE;


--
-- Name: registros_autoclave registros_autoclave_id_equipo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registros_autoclave
    ADD CONSTRAINT registros_autoclave_id_equipo_fkey FOREIGN KEY (id_equipo) REFERENCES public.equipos(id_activo) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: registros_cabina registros_cabina_id_equipo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registros_cabina
    ADD CONSTRAINT registros_cabina_id_equipo_fkey FOREIGN KEY (id_equipo) REFERENCES public.equipos(id_activo) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: registros_vitrina registros_vitrina_id_equipo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registros_vitrina
    ADD CONSTRAINT registros_vitrina_id_equipo_fkey FOREIGN KEY (id_equipo) REFERENCES public.equipos(id_activo) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: reservas_equipos reservas_equipos_id_equipo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservas_equipos
    ADD CONSTRAINT reservas_equipos_id_equipo_fkey FOREIGN KEY (id_equipo) REFERENCES public.equipos(id_activo) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: revisiones_inventario revisiones_inventario_id_material_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revisiones_inventario
    ADD CONSTRAINT revisiones_inventario_id_material_fkey FOREIGN KEY (id_material) REFERENCES public.material(id_material);


--
-- Name: solicitudes solicitudes_id_material_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes
    ADD CONSTRAINT solicitudes_id_material_fkey FOREIGN KEY (id_material) REFERENCES public.material(id_material) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: solicitudes solicitudes_lista_pedido_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes
    ADD CONSTRAINT solicitudes_lista_pedido_fkey FOREIGN KEY (lista_pedido) REFERENCES public.pedidos(id_pedido) ON DELETE SET NULL;


--
-- Name: tareas_intervencion tareas_intervencion_id_intervencion_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tareas_intervencion
    ADD CONSTRAINT tareas_intervencion_id_intervencion_fkey FOREIGN KEY (id_intervencion) REFERENCES public.intervenciones(id_intervencion) ON DELETE CASCADE;


--
-- Name: user_modulos user_modulos_modulo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_modulos
    ADD CONSTRAINT user_modulos_modulo_id_fkey FOREIGN KEY (modulo_id) REFERENCES public.modulos(id) ON DELETE CASCADE;


--
-- Name: user_modulos user_modulos_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_modulos
    ADD CONSTRAINT user_modulos_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_ciclo_principal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_ciclo_principal_id_fkey FOREIGN KEY (ciclo_principal_id) REFERENCES public.ciclos(id);


--
-- Name: users users_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: usos_muestra usos_muestra_id_muestra_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usos_muestra
    ADD CONSTRAINT usos_muestra_id_muestra_fkey FOREIGN KEY (id_muestra) REFERENCES public.muestras_congeladas(id_muestra) ON DELETE CASCADE;


--
-- Name: verif_extraordinarias verif_extraordinarias_id_equipo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verif_extraordinarias
    ADD CONSTRAINT verif_extraordinarias_id_equipo_fkey FOREIGN KEY (id_equipo) REFERENCES public.equipos(id_activo);


--
-- Name: verif_pipetas_parametros verif_pipetas_parametros_id_activo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verif_pipetas_parametros
    ADD CONSTRAINT verif_pipetas_parametros_id_activo_fkey FOREIGN KEY (id_activo) REFERENCES public.equipos(id_activo) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: adiciones_residuo; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.adiciones_residuo ENABLE ROW LEVEL SECURITY;

--
-- Name: adiciones_residuo adiciones_residuo_select_anon; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY adiciones_residuo_select_anon ON public.adiciones_residuo FOR SELECT TO authenticated USING (true);


--
-- Name: atributos_material; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.atributos_material ENABLE ROW LEVEL SECURITY;

--
-- Name: atributos_material atributos_material_select_anon; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atributos_material_select_anon ON public.atributos_material FOR SELECT TO authenticated USING (true);


--
-- Name: cajas_congelado; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cajas_congelado ENABLE ROW LEVEL SECURITY;

--
-- Name: cajas_congelado cajas_congelado_select_anon; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cajas_congelado_select_anon ON public.cajas_congelado FOR SELECT TO authenticated USING (true);


--
-- Name: ciclos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ciclos ENABLE ROW LEVEL SECURITY;

--
-- Name: config_reservas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.config_reservas ENABLE ROW LEVEL SECURITY;

--
-- Name: config_reservas config_reservas_select_anon; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY config_reservas_select_anon ON public.config_reservas FOR SELECT TO authenticated USING (true);


--
-- Name: consultas_residuo; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.consultas_residuo ENABLE ROW LEVEL SECURITY;

--
-- Name: consultas_residuo consultas_residuo_select_anon; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY consultas_residuo_select_anon ON public.consultas_residuo FOR SELECT TO authenticated USING (true);


--
-- Name: contenedores_residuo; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contenedores_residuo ENABLE ROW LEVEL SECURITY;

--
-- Name: contenedores_residuo contenedores_residuo_select_anon; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contenedores_residuo_select_anon ON public.contenedores_residuo FOR SELECT TO authenticated USING (true);


--
-- Name: credenciales_grupo; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.credenciales_grupo ENABLE ROW LEVEL SECURITY;

--
-- Name: documentos_proveedor; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.documentos_proveedor ENABLE ROW LEVEL SECURITY;

--
-- Name: documentos_proveedor documentos_proveedor_select_personal; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY documentos_proveedor_select_personal ON public.documentos_proveedor FOR SELECT TO authenticated USING ((COALESCE(public.rol_sesion(), 'Alumno'::text) <> 'Alumno'::text));


--
-- Name: equipos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.equipos ENABLE ROW LEVEL SECURITY;

--
-- Name: equipos equipos_select_anon; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY equipos_select_anon ON public.equipos FOR SELECT TO authenticated USING (true);


--
-- Name: evaluaciones_curso; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.evaluaciones_curso ENABLE ROW LEVEL SECURITY;

--
-- Name: evaluaciones_curso evaluaciones_curso_select_anon; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY evaluaciones_curso_select_anon ON public.evaluaciones_curso FOR SELECT TO authenticated USING (true);


--
-- Name: excepciones_residuo_ia; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.excepciones_residuo_ia ENABLE ROW LEVEL SECURITY;

--
-- Name: excepciones_residuo_ia excepciones_residuo_ia_select_anon; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY excepciones_residuo_ia_select_anon ON public.excepciones_residuo_ia FOR SELECT TO authenticated USING (true);


--
-- Name: historico_precio; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.historico_precio ENABLE ROW LEVEL SECURITY;

--
-- Name: historico_precio historico_precio_select_personal; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY historico_precio_select_personal ON public.historico_precio FOR SELECT TO authenticated USING ((COALESCE(public.rol_sesion(), 'Alumno'::text) <> 'Alumno'::text));


--
-- Name: incidencias; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.incidencias ENABLE ROW LEVEL SECURITY;

--
-- Name: incidencias incidencias_select_anon; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY incidencias_select_anon ON public.incidencias FOR SELECT TO authenticated USING (true);


--
-- Name: intervenciones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.intervenciones ENABLE ROW LEVEL SECURITY;

--
-- Name: intervenciones intervenciones_select_anon; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY intervenciones_select_anon ON public.intervenciones FOR SELECT TO authenticated USING (true);


--
-- Name: lineas_pedido; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lineas_pedido ENABLE ROW LEVEL SECURITY;

--
-- Name: lineas_pedido lineas_pedido_select_personal; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lineas_pedido_select_personal ON public.lineas_pedido FOR SELECT TO authenticated USING ((COALESCE(public.rol_sesion(), 'Alumno'::text) <> 'Alumno'::text));


--
-- Name: material; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.material ENABLE ROW LEVEL SECURITY;

--
-- Name: material material_select_anon; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY material_select_anon ON public.material FOR SELECT TO authenticated USING (true);


--
-- Name: material_ubicaciones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.material_ubicaciones ENABLE ROW LEVEL SECURITY;

--
-- Name: material_ubicaciones material_ubicaciones_select_anon; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY material_ubicaciones_select_anon ON public.material_ubicaciones FOR SELECT TO authenticated USING (true);


--
-- Name: modulo_ciclo; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.modulo_ciclo ENABLE ROW LEVEL SECURITY;

--
-- Name: modulos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.modulos ENABLE ROW LEVEL SECURITY;

--
-- Name: movimientos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.movimientos ENABLE ROW LEVEL SECURITY;

--
-- Name: movimientos movimientos_select_anon; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY movimientos_select_anon ON public.movimientos FOR SELECT TO authenticated USING (true);


--
-- Name: muestras_congeladas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.muestras_congeladas ENABLE ROW LEVEL SECURITY;

--
-- Name: muestras_congeladas muestras_congeladas_select_anon; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY muestras_congeladas_select_anon ON public.muestras_congeladas FOR SELECT TO authenticated USING (true);


--
-- Name: pedidos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;

--
-- Name: pedidos pedidos_select_personal; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pedidos_select_personal ON public.pedidos FOR SELECT TO authenticated USING ((COALESCE(public.rol_sesion(), 'Alumno'::text) <> 'Alumno'::text));


--
-- Name: pedidos_token; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pedidos_token ENABLE ROW LEVEL SECURITY;

--
-- Name: planes_mantenimiento; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.planes_mantenimiento ENABLE ROW LEVEL SECURITY;

--
-- Name: planes_mantenimiento planes_mantenimiento_select_anon; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY planes_mantenimiento_select_anon ON public.planes_mantenimiento FOR SELECT TO authenticated USING (true);


--
-- Name: propuestas_material; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.propuestas_material ENABLE ROW LEVEL SECURITY;

--
-- Name: propuestas_material propuestas_material_select_anon; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY propuestas_material_select_anon ON public.propuestas_material FOR SELECT TO authenticated USING (true);


--
-- Name: propuestas_ubicacion_equipo; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.propuestas_ubicacion_equipo ENABLE ROW LEVEL SECURITY;

--
-- Name: propuestas_ubicacion_equipo propuestas_ubicacion_equipo_select_anon; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY propuestas_ubicacion_equipo_select_anon ON public.propuestas_ubicacion_equipo FOR SELECT TO authenticated USING (true);


--
-- Name: proveedores; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.proveedores ENABLE ROW LEVEL SECURITY;

--
-- Name: proveedores proveedores_select_personal; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY proveedores_select_personal ON public.proveedores FOR SELECT TO authenticated USING ((COALESCE(public.rol_sesion(), 'Alumno'::text) <> 'Alumno'::text));


--
-- Name: registro_mantenimientos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.registro_mantenimientos ENABLE ROW LEVEL SECURITY;

--
-- Name: registro_mantenimientos registro_mantenimientos_select_anon; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY registro_mantenimientos_select_anon ON public.registro_mantenimientos FOR SELECT TO authenticated USING (true);


--
-- Name: registros_autoclave; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.registros_autoclave ENABLE ROW LEVEL SECURITY;

--
-- Name: registros_autoclave registros_autoclave_select_anon; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY registros_autoclave_select_anon ON public.registros_autoclave FOR SELECT TO authenticated USING (true);


--
-- Name: registros_cabina; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.registros_cabina ENABLE ROW LEVEL SECURITY;

--
-- Name: registros_cabina registros_cabina_select_anon; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY registros_cabina_select_anon ON public.registros_cabina FOR SELECT TO authenticated USING (true);


--
-- Name: registros_vitrina; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.registros_vitrina ENABLE ROW LEVEL SECURITY;

--
-- Name: registros_vitrina registros_vitrina_select_anon; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY registros_vitrina_select_anon ON public.registros_vitrina FOR SELECT TO authenticated USING (true);


--
-- Name: reservas_equipos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reservas_equipos ENABLE ROW LEVEL SECURITY;

--
-- Name: reservas_equipos reservas_equipos_select_anon; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY reservas_equipos_select_anon ON public.reservas_equipos FOR SELECT TO authenticated USING (true);


--
-- Name: revisiones_inventario; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.revisiones_inventario ENABLE ROW LEVEL SECURITY;

--
-- Name: revisiones_inventario revisiones_inventario_select_anon; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY revisiones_inventario_select_anon ON public.revisiones_inventario FOR SELECT TO authenticated USING (true);


--
-- Name: solicitudes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.solicitudes ENABLE ROW LEVEL SECURITY;

--
-- Name: solicitudes solicitudes_select_personal; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY solicitudes_select_personal ON public.solicitudes FOR SELECT TO authenticated USING ((COALESCE(public.rol_sesion(), 'Alumno'::text) <> 'Alumno'::text));


--
-- Name: tareas_intervencion; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tareas_intervencion ENABLE ROW LEVEL SECURITY;

--
-- Name: tareas_intervencion tareas_intervencion_select_anon; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tareas_intervencion_select_anon ON public.tareas_intervencion FOR SELECT TO authenticated USING (true);


--
-- Name: tareas_personales; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tareas_personales ENABLE ROW LEVEL SECURITY;

--
-- Name: tareas_personales tareas_personales_select_propias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tareas_personales_select_propias ON public.tareas_personales FOR SELECT TO authenticated USING ((lower(email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))));


--
-- Name: tipos_residuo; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tipos_residuo ENABLE ROW LEVEL SECURITY;

--
-- Name: tipos_residuo tipos_residuo_select_anon; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tipos_residuo_select_anon ON public.tipos_residuo FOR SELECT TO authenticated USING (true);


--
-- Name: ubicaciones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ubicaciones ENABLE ROW LEVEL SECURITY;

--
-- Name: ubicaciones ubicaciones_select_anon; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ubicaciones_select_anon ON public.ubicaciones FOR SELECT TO authenticated USING (true);


--
-- Name: user_modulos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_modulos ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- Name: usos_muestra; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.usos_muestra ENABLE ROW LEVEL SECURITY;

--
-- Name: usos_muestra usos_muestra_select_anon; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY usos_muestra_select_anon ON public.usos_muestra FOR SELECT TO authenticated USING (true);


--
-- Name: usuarios; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

--
-- Name: usuarios usuarios_select_por_rol; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY usuarios_select_por_rol ON public.usuarios FOR SELECT TO authenticated USING (((COALESCE(public.rol_sesion(), 'Alumno'::text) <> 'Alumno'::text) OR (lower(email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text)))));


--
-- Name: verif_extraordinarias; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.verif_extraordinarias ENABLE ROW LEVEL SECURITY;

--
-- Name: verif_extraordinarias verif_extraordinarias_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY verif_extraordinarias_select ON public.verif_extraordinarias FOR SELECT TO authenticated USING (true);


--
-- Name: verif_pipetas_parametros; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.verif_pipetas_parametros ENABLE ROW LEVEL SECURITY;

--
-- Name: verif_pipetas_parametros verif_pipetas_parametros_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY verif_pipetas_parametros_select ON public.verif_pipetas_parametros FOR SELECT TO authenticated USING (true);


--
-- Name: verif_preparaciones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.verif_preparaciones ENABLE ROW LEVEL SECURITY;

--
-- Name: verif_preparaciones verif_preparaciones_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY verif_preparaciones_select ON public.verif_preparaciones FOR SELECT TO authenticated USING (true);


--
-- Name: verif_sesiones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.verif_sesiones ENABLE ROW LEVEL SECURITY;

--
-- Name: verif_sesiones verif_sesiones_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY verif_sesiones_select ON public.verif_sesiones FOR SELECT TO authenticated USING (true);


--
-- Permisos: en Supabase los objetos nuevos nacen con todos los permisos para la API
-- (también anon). Se quitan aquí y los GRANT de abajo dejan los de la base real,
-- salvo los de anon, que no tiene ninguno. Sin esto, anon volvería a poder leer las
-- tablas.
--

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated, service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated, service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION rol_sesion(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.rol_sesion() FROM PUBLIC;
GRANT ALL ON FUNCTION public.rol_sesion() TO authenticated;


--
-- Name: TABLE adiciones_residuo; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.adiciones_residuo TO authenticated;
GRANT ALL ON TABLE public.adiciones_residuo TO service_role;


--
-- Name: TABLE atributos_material; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.atributos_material TO authenticated;
GRANT ALL ON TABLE public.atributos_material TO service_role;


--
-- Name: TABLE cajas_congelado; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.cajas_congelado TO authenticated;
GRANT ALL ON TABLE public.cajas_congelado TO service_role;


--
-- Name: TABLE ciclos; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.ciclos TO authenticated;
GRANT ALL ON TABLE public.ciclos TO service_role;


--
-- Name: TABLE config_reservas; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.config_reservas TO authenticated;
GRANT ALL ON TABLE public.config_reservas TO service_role;


--
-- Name: TABLE consultas_residuo; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.consultas_residuo TO authenticated;
GRANT ALL ON TABLE public.consultas_residuo TO service_role;


--
-- Name: TABLE contenedores_residuo; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.contenedores_residuo TO authenticated;
GRANT ALL ON TABLE public.contenedores_residuo TO service_role;


--
-- Name: TABLE credenciales_grupo; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.credenciales_grupo TO service_role;


--
-- Name: TABLE documentos_proveedor; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.documentos_proveedor TO authenticated;
GRANT ALL ON TABLE public.documentos_proveedor TO service_role;


--
-- Name: TABLE equipos; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.equipos TO authenticated;
GRANT ALL ON TABLE public.equipos TO service_role;


--
-- Name: TABLE evaluaciones_curso; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.evaluaciones_curso TO authenticated;
GRANT ALL ON TABLE public.evaluaciones_curso TO service_role;


--
-- Name: TABLE excepciones_residuo_ia; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.excepciones_residuo_ia TO authenticated;
GRANT ALL ON TABLE public.excepciones_residuo_ia TO service_role;


--
-- Name: TABLE historico_precio; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.historico_precio TO authenticated;
GRANT ALL ON TABLE public.historico_precio TO service_role;


--
-- Name: TABLE incidencias; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.incidencias TO authenticated;
GRANT ALL ON TABLE public.incidencias TO service_role;


--
-- Name: TABLE intervenciones; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.intervenciones TO authenticated;
GRANT ALL ON TABLE public.intervenciones TO service_role;


--
-- Name: TABLE lineas_pedido; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.lineas_pedido TO authenticated;
GRANT ALL ON TABLE public.lineas_pedido TO service_role;


--
-- Name: TABLE material; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.material TO authenticated;
GRANT ALL ON TABLE public.material TO service_role;


--
-- Name: TABLE material_ubicaciones; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.material_ubicaciones TO authenticated;
GRANT ALL ON TABLE public.material_ubicaciones TO service_role;


--
-- Name: TABLE modulo_ciclo; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.modulo_ciclo TO authenticated;
GRANT ALL ON TABLE public.modulo_ciclo TO service_role;


--
-- Name: TABLE modulos; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.modulos TO authenticated;
GRANT ALL ON TABLE public.modulos TO service_role;


--
-- Name: TABLE movimientos; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.movimientos TO authenticated;
GRANT ALL ON TABLE public.movimientos TO service_role;


--
-- Name: TABLE muestras_congeladas; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.muestras_congeladas TO authenticated;
GRANT ALL ON TABLE public.muestras_congeladas TO service_role;


--
-- Name: TABLE pedidos; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.pedidos TO authenticated;
GRANT ALL ON TABLE public.pedidos TO service_role;


--
-- Name: TABLE pedidos_token; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.pedidos_token TO service_role;


--
-- Name: TABLE planes_mantenimiento; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.planes_mantenimiento TO authenticated;
GRANT ALL ON TABLE public.planes_mantenimiento TO service_role;


--
-- Name: TABLE propuestas_material; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.propuestas_material TO authenticated;
GRANT ALL ON TABLE public.propuestas_material TO service_role;


--
-- Name: TABLE propuestas_ubicacion_equipo; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.propuestas_ubicacion_equipo TO authenticated;
GRANT ALL ON TABLE public.propuestas_ubicacion_equipo TO service_role;


--
-- Name: TABLE proveedores; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.proveedores TO authenticated;
GRANT ALL ON TABLE public.proveedores TO service_role;


--
-- Name: TABLE registro_mantenimientos; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.registro_mantenimientos TO authenticated;
GRANT ALL ON TABLE public.registro_mantenimientos TO service_role;


--
-- Name: TABLE registros_autoclave; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.registros_autoclave TO authenticated;
GRANT ALL ON TABLE public.registros_autoclave TO service_role;


--
-- Name: TABLE registros_cabina; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.registros_cabina TO authenticated;
GRANT ALL ON TABLE public.registros_cabina TO service_role;


--
-- Name: TABLE registros_vitrina; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.registros_vitrina TO authenticated;
GRANT ALL ON TABLE public.registros_vitrina TO service_role;


--
-- Name: TABLE reservas_equipos; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.reservas_equipos TO authenticated;
GRANT ALL ON TABLE public.reservas_equipos TO service_role;


--
-- Name: TABLE revisiones_inventario; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.revisiones_inventario TO authenticated;
GRANT ALL ON TABLE public.revisiones_inventario TO service_role;


--
-- Name: TABLE solicitudes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.solicitudes TO authenticated;
GRANT ALL ON TABLE public.solicitudes TO service_role;


--
-- Name: TABLE tareas_intervencion; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tareas_intervencion TO authenticated;
GRANT ALL ON TABLE public.tareas_intervencion TO service_role;


--
-- Name: TABLE tareas_personales; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tareas_personales TO authenticated;
GRANT ALL ON TABLE public.tareas_personales TO service_role;


--
-- Name: TABLE tipos_residuo; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tipos_residuo TO authenticated;
GRANT ALL ON TABLE public.tipos_residuo TO service_role;


--
-- Name: TABLE ubicaciones; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.ubicaciones TO authenticated;
GRANT ALL ON TABLE public.ubicaciones TO service_role;


--
-- Name: TABLE user_modulos; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_modulos TO authenticated;
GRANT ALL ON TABLE public.user_modulos TO service_role;


--
-- Name: TABLE users; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.users TO authenticated;
GRANT ALL ON TABLE public.users TO service_role;


--
-- Name: TABLE usos_muestra; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.usos_muestra TO authenticated;
GRANT ALL ON TABLE public.usos_muestra TO service_role;


--
-- Name: TABLE usuarios; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.usuarios TO authenticated;
GRANT ALL ON TABLE public.usuarios TO service_role;


--
-- Name: TABLE verif_extraordinarias; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.verif_extraordinarias TO authenticated;
GRANT ALL ON TABLE public.verif_extraordinarias TO service_role;


--
-- Name: TABLE verif_pipetas_parametros; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.verif_pipetas_parametros TO authenticated;
GRANT ALL ON TABLE public.verif_pipetas_parametros TO service_role;


--
-- Name: TABLE verif_preparaciones; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.verif_preparaciones TO authenticated;
GRANT ALL ON TABLE public.verif_preparaciones TO service_role;


--
-- Name: TABLE verif_sesiones; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.verif_sesiones TO authenticated;
GRANT ALL ON TABLE public.verif_sesiones TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- PostgreSQL database dump complete
--



-- ------------------------------------------------------------
-- 3. Storage: buckets (configuración, sin archivos) y políticas
-- ------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('documentos', 'documentos', false, 10485760, ARRAY['application/pdf', 'image/jpeg', 'image/png', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']::text[])
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('videos', 'videos', false, 52428800, ARRAY['video/mp4', 'text/vtt']::text[])
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "videos_select_authenticated" ON storage.objects;
CREATE POLICY "videos_select_authenticated" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING ((bucket_id = 'videos'::text));

-- ------------------------------------------------------------
-- 4. Disparadores de eventos propios
-- ------------------------------------------------------------
SET search_path = public, pg_catalog;
DROP EVENT TRIGGER IF EXISTS ensure_rls;
CREATE EVENT TRIGGER ensure_rls ON ddl_command_end WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  EXECUTE FUNCTION public.rls_auto_enable();

-- ------------------------------------------------------------
-- 5. Realtime
-- ------------------------------------------------------------
-- (ninguna tabla publicada)

-- ------------------------------------------------------------
-- 6. Datos de partida (los únicos datos de la base limpia)
-- ------------------------------------------------------------
-- atributos_material: 18 filas
INSERT INTO public.atributos_material (id_ficha, categoria, tipo_base, orden, atributos, activa, nombre_base) VALUES ('FAT_colo_colorantes_y_tinciones', 'Colorante y tinción', 'Colorantes y tinciones', 15, '[{"tipo": "opcion", "clave": "presentacion", "nombre": {"sep": "coma", "sufijo": "", "prefijo": ""}, "etiqueta": "Presentación", "opciones": ["solución", "polvo"], "obligatorio": false}, {"tipo": "numero", "clave": "concentracion", "nombre": {"sep": "coma", "sufijo": "%", "prefijo": ""}, "unidad": "%", "etiqueta": "Concentración", "obligatorio": false}]'::jsonb, true, NULL)
  ON CONFLICT (id_ficha) DO NOTHING;
INSERT INTO public.atributos_material (id_ficha, categoria, tipo_base, orden, atributos, activa, nombre_base) VALUES ('FAT_colo_medios_de_montaje', 'Colorante y tinción', 'Medios de montaje', 16, '[{"tipo": "opcion", "clave": "tipo_medio", "nombre": {"sep": "coma", "sufijo": "", "prefijo": ""}, "etiqueta": "Tipo de medio", "opciones": ["acuoso", "resina", "fluorescencia"], "obligatorio": true}]'::jsonb, true, NULL)
  ON CONFLICT (id_ficha) DO NOTHING;
INSERT INTO public.atributos_material (id_ficha, categoria, tipo_base, orden, atributos, activa, nombre_base) VALUES ('FAT_epi_guantes', 'EPI y seguridad', 'Guantes', 13, '[{"tipo": "opcion", "clave": "material", "nombre": {"sep": "espacio", "sufijo": "", "prefijo": ""}, "etiqueta": "Material", "opciones": ["nitrilo", "látex", "vinilo"], "obligatorio": true}, {"tipo": "opcion", "clave": "talla", "nombre": {"sep": "coma", "sufijo": "", "prefijo": "talla "}, "etiqueta": "Talla", "opciones": ["XS", "S", "M", "L", "XL"], "obligatorio": true}, {"tipo": "booleano", "clave": "con_polvo", "nombre": {"sep": "coma", "sufijo": "", "prefijo": "", "textoSi": "con polvo"}, "etiqueta": "Con polvo", "obligatorio": false}]'::jsonb, true, 'Guantes')
  ON CONFLICT (id_ficha) DO NOTHING;
INSERT INTO public.atributos_material (id_ficha, categoria, tipo_base, orden, atributos, activa, nombre_base) VALUES ('FAT_kit_kits', 'Kit diagnóstico', 'Kits', 17, '[{"tipo": "numero", "clave": "determinaciones", "nombre": {"sep": "omitir", "sufijo": "", "prefijo": ""}, "unidad": "", "etiqueta": "Nº de determinaciones o usos", "obligatorio": false}]'::jsonb, true, NULL)
  ON CONFLICT (id_ficha) DO NOTHING;
INSERT INTO public.atributos_material (id_ficha, categoria, tipo_base, orden, atributos, activa, nombre_base) VALUES ('FAT_mate_c_maras_de_recuento', 'Material de vidrio', 'Cámaras de recuento', 12, '[{"tipo": "texto", "clave": "modelo", "nombre": {"sep": "coma", "sufijo": "", "prefijo": ""}, "etiqueta": "Modelo", "obligatorio": true}]'::jsonb, true, 'Cámara')
  ON CONFLICT (id_ficha) DO NOTHING;
INSERT INTO public.atributos_material (id_ficha, categoria, tipo_base, orden, atributos, activa, nombre_base) VALUES ('FAT_mate_cristalizadores', 'Material de vidrio', 'Cristalizadores', 11, '[{"tipo": "numero", "clave": "diametro", "nombre": {"sep": "coma", "sufijo": " mm", "prefijo": ""}, "unidad": "mm", "etiqueta": "Diámetro", "obligatorio": true}]'::jsonb, true, 'Cristalizador')
  ON CONFLICT (id_ficha) DO NOTHING;
INSERT INTO public.atributos_material (id_ficha, categoria, tipo_base, orden, atributos, activa, nombre_base) VALUES ('FAT_mate_flask_cultivo_celular', 'Material fungible', 'Flask cultivo celular', 8, '[{"tipo": "opcion", "clave": "superficie", "nombre": {"sep": "coma", "sufijo": "", "prefijo": ""}, "etiqueta": "Superficie", "opciones": ["T25", "T75", "T175"], "obligatorio": true}, {"tipo": "opcion", "clave": "tapon", "nombre": {"sep": "coma", "sufijo": "", "prefijo": ""}, "etiqueta": "Tipo de tapón", "opciones": ["tapón con filtro", "tapón normal"], "obligatorio": false}]'::jsonb, true, 'Flask cultivo celular')
  ON CONFLICT (id_ficha) DO NOTHING;
INSERT INTO public.atributos_material (id_ficha, categoria, tipo_base, orden, atributos, activa, nombre_base) VALUES ('FAT_mate_jeringuillas', 'Material fungible', 'Jeringuillas', 9, '[{"tipo": "booleano", "clave": "esteril", "nombre": {"sep": "espacio", "sufijo": "", "prefijo": "", "textoSi": "estériles"}, "etiqueta": "Estériles", "obligatorio": false}, {"tipo": "numero", "clave": "volumen", "nombre": {"sep": "coma", "sufijo": " mL", "prefijo": ""}, "unidad": "mL", "etiqueta": "Volumen", "obligatorio": true}]'::jsonb, true, 'Jeringuillas')
  ON CONFLICT (id_ficha) DO NOTHING;
INSERT INTO public.atributos_material (id_ficha, categoria, tipo_base, orden, atributos, activa, nombre_base) VALUES ('FAT_mate_pinzas', 'Material fungible', 'Pinzas', 10, '[{"tipo": "booleano", "clave": "esteril", "nombre": {"sep": "espacio", "sufijo": "", "prefijo": "", "textoSi": "estériles"}, "etiqueta": "Estériles", "obligatorio": false}, {"tipo": "texto", "clave": "material", "nombre": {"sep": "coma", "sufijo": "", "prefijo": ""}, "etiqueta": "Material", "obligatorio": false}]'::jsonb, true, 'Pinzas')
  ON CONFLICT (id_ficha) DO NOTHING;
INSERT INTO public.atributos_material (id_ficha, categoria, tipo_base, orden, atributos, activa, nombre_base) VALUES ('FAT_mate_pipetas_serol_gicas', 'Material fungible', 'Pipetas serológicas', 5, '[{"tipo": "booleano", "clave": "esteril", "nombre": {"sep": "espacio", "sufijo": "", "prefijo": "", "textoSi": "estériles"}, "etiqueta": "Estériles", "obligatorio": false}, {"tipo": "numero", "clave": "volumen", "nombre": {"sep": "coma", "sufijo": " mL", "prefijo": ""}, "unidad": "mL", "etiqueta": "Volumen", "obligatorio": true}]'::jsonb, true, 'Pipetas serológicas')
  ON CONFLICT (id_ficha) DO NOTHING;
INSERT INTO public.atributos_material (id_ficha, categoria, tipo_base, orden, atributos, activa, nombre_base) VALUES ('FAT_mate_placas_petri', 'Material fungible', 'Placas Petri', 7, '[{"tipo": "booleano", "clave": "esteril", "nombre": {"sep": "espacio", "sufijo": "", "prefijo": "", "textoSi": "estériles"}, "etiqueta": "Estériles", "obligatorio": false}, {"tipo": "numero", "clave": "diametro", "nombre": {"sep": "coma", "sufijo": " mm", "prefijo": ""}, "unidad": "mm", "etiqueta": "Diámetro", "obligatorio": true}]'::jsonb, true, 'Placas Petri')
  ON CONFLICT (id_ficha) DO NOTHING;
INSERT INTO public.atributos_material (id_ficha, categoria, tipo_base, orden, atributos, activa, nombre_base) VALUES ('FAT_mate_puntas_de_micropipeta', 'Material fungible', 'Puntas de micropipeta', 6, '[{"tipo": "booleano", "clave": "esteril", "nombre": {"sep": "espacio", "sufijo": "", "prefijo": "", "textoSi": "estériles"}, "etiqueta": "Estériles", "obligatorio": false}, {"tipo": "numero", "clave": "volumen", "nombre": {"sep": "coma", "sufijo": " µL", "prefijo": ""}, "unidad": "µL", "etiqueta": "Volumen", "obligatorio": true}, {"tipo": "booleano", "clave": "con_filtro", "nombre": {"sep": "coma", "sufijo": "", "prefijo": "", "textoSi": "con filtro"}, "etiqueta": "Con filtro", "obligatorio": false}]'::jsonb, true, 'Puntas micropipeta')
  ON CONFLICT (id_ficha) DO NOTHING;
INSERT INTO public.atributos_material (id_ficha, categoria, tipo_base, orden, atributos, activa, nombre_base) VALUES ('FAT_pape_papel_secante', 'Papel y filtración', 'Papel secante', 14, '[{"tipo": "opcion", "clave": "formato", "nombre": {"sep": "coma", "sufijo": "", "prefijo": ""}, "etiqueta": "Formato", "opciones": ["rollo", "hoja"], "obligatorio": true}, {"tipo": "texto", "clave": "tamano", "nombre": {"sep": "espacio", "sufijo": "", "prefijo": ""}, "etiqueta": "Tamaño", "obligatorio": false}]'::jsonb, true, 'Papel secante')
  ON CONFLICT (id_ficha) DO NOTHING;
INSERT INTO public.atributos_material (id_ficha, categoria, tipo_base, orden, atributos, activa, nombre_base) VALUES ('FAT_reac_cidos_y_bases', 'Reactivo químico', 'Ácidos y bases', 0, '[{"tipo": "texto", "clave": "formula", "nombre": {"sep": "coma", "sufijo": "", "prefijo": ""}, "etiqueta": "Fórmula", "obligatorio": true}, {"tipo": "numero", "clave": "concentracion", "nombre": {"sep": "coma", "sufijo": "%", "prefijo": ""}, "unidad": "%", "etiqueta": "Concentración", "obligatorio": true}, {"tipo": "texto", "clave": "pureza", "nombre": {"sep": "omitir", "sufijo": "", "prefijo": ""}, "etiqueta": "Grado de pureza", "obligatorio": false}]'::jsonb, true, NULL)
  ON CONFLICT (id_ficha) DO NOTHING;
INSERT INTO public.atributos_material (id_ficha, categoria, tipo_base, orden, atributos, activa, nombre_base) VALUES ('FAT_reac_disolventes', 'Reactivo químico', 'Disolventes', 1, '[{"tipo": "numero", "clave": "concentracion", "nombre": {"sep": "coma", "sufijo": "%", "prefijo": ""}, "unidad": "%", "etiqueta": "Concentración", "obligatorio": true}]'::jsonb, true, NULL)
  ON CONFLICT (id_ficha) DO NOTHING;
INSERT INTO public.atributos_material (id_ficha, categoria, tipo_base, orden, atributos, activa, nombre_base) VALUES ('FAT_reac_indicadores', 'Reactivo químico', 'Indicadores', 3, '[{"tipo": "opcion", "clave": "presentacion", "nombre": {"sep": "coma", "sufijo": "", "prefijo": ""}, "etiqueta": "Presentación", "opciones": ["solución", "polvo"], "obligatorio": false}, {"tipo": "numero", "clave": "concentracion", "nombre": {"sep": "coma", "sufijo": "%", "prefijo": ""}, "unidad": "%", "etiqueta": "Concentración", "obligatorio": false}]'::jsonb, true, NULL)
  ON CONFLICT (id_ficha) DO NOTHING;
INSERT INTO public.atributos_material (id_ficha, categoria, tipo_base, orden, atributos, activa, nombre_base) VALUES ('FAT_reac_reactivos_en_ampolla', 'Reactivo químico', 'Reactivos en ampolla', 4, '[]'::jsonb, true, NULL)
  ON CONFLICT (id_ficha) DO NOTHING;
INSERT INTO public.atributos_material (id_ficha, categoria, tipo_base, orden, atributos, activa, nombre_base) VALUES ('FAT_reac_s_lidos', 'Reactivo químico', 'Sólidos', 2, '[{"tipo": "texto", "clave": "pureza", "nombre": {"sep": "omitir", "sufijo": "", "prefijo": ""}, "etiqueta": "Pureza", "obligatorio": false}]'::jsonb, true, NULL)
  ON CONFLICT (id_ficha) DO NOTHING;

COMMIT;
