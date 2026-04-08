-- =============================================================================
-- schema.sql — Mobilhospital Maintenance Module
-- Fuente de verdad absoluta del schema de base de datos
-- Motor: PostgreSQL 17 (Supabase)
-- Última sincronización: 2026-03-06 (fase6_mejoras_formulario_fisico)
--
-- Convenciones:
--   - PKs: UUID generado con gen_random_uuid()
--   - Fechas/horas con zona horaria: TIMESTAMPTZ
--   - Soft delete via campo `activo` BOOLEAN
--   - Nombres de columnas de hash: hash_firma_tecnico / hash_firma_cliente
-- =============================================================================

-- Habilitar extensión UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- FASE 1 — TABLAS MAESTRAS
-- Orden: clientes → contratos → categorias_equipo → tecnicos →
--        tipos_mantenimiento → insumos → ubicaciones
-- =============================================================================

-- -----------------------------------------------------------------------------
-- clientes
-- Empresas u organizaciones que contratan el servicio de mantenimiento
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clientes (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  razon_social    TEXT        NOT NULL,
  ruc             TEXT        UNIQUE,
  email           TEXT,
  telefono        TEXT,
  direccion       TEXT,
  activo          BOOLEAN     NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- contratos
-- Contrato de servicio entre Mobilhospital y un cliente
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contratos (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id        UUID        NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
  numero_contrato   TEXT        NOT NULL UNIQUE,
  fecha_inicio      DATE        NOT NULL,
  fecha_fin         DATE,
  tipo_contrato     TEXT        NOT NULL DEFAULT 'anual',
  observaciones     TEXT,
  activo            BOOLEAN     NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- categorias_equipo
-- Tipos de equipos hospitalarios (Cama, Camilla, etc.)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categorias_equipo (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      TEXT        NOT NULL UNIQUE,
  descripcion TEXT,
  activa      BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- tecnicos
-- Técnicos de mantenimiento. Vinculados a un usuario de Supabase Auth
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tecnicos (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  nombre      TEXT        NOT NULL,
  apellido    TEXT        NOT NULL,
  cedula      TEXT        UNIQUE,
  email       TEXT        NOT NULL UNIQUE,
  telefono    TEXT,
  activo      BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- tipos_mantenimiento
-- Define el tipo de mantenimiento y su periodicidad en días.
-- Datos semilla: Preventivo (365), Correctivo (0), Calibración (180), etc.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tipos_mantenimiento (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre            TEXT        NOT NULL UNIQUE,
  descripcion       TEXT,
  periodicidad_dias INT         NOT NULL DEFAULT 0,
  -- TRUE: tipo planificado con periodicidad fija (Preventivo, Preventivo-Correctivo)
  -- FALSE: tipo no planificado (Correctivo, Emergencia, Instalación, Retiro)
  es_planificado    BOOLEAN     NOT NULL DEFAULT false,
  activo            BOOLEAN     NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- insumos
-- Repuestos y materiales utilizados en el mantenimiento
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS insumos (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre         TEXT        NOT NULL,
  codigo         TEXT        UNIQUE,
  unidad_medida  TEXT        NOT NULL DEFAULT 'unidad',
  descripcion    TEXT,
  activo         BOOLEAN     NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- ubicaciones
-- Áreas o departamentos dentro de las instalaciones de un cliente
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ubicaciones (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id  UUID        NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
  nombre      TEXT        NOT NULL,
  descripcion TEXT,
  activa      BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- =============================================================================
-- FASE 2 — TABLA CENTRAL DE EQUIPOS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- equipos
-- Registro maestro de cada equipo hospitalario.
-- tipo_mantenimiento_id: FK al tipo de mantenimiento planificado por defecto
-- para este equipo. Sirve para calcular fechas de mantenimiento en
-- v_equipos_mantenimiento_vencido y en la vista de búsqueda de equipos.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS equipos (
  id                            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_mh                     TEXT        NOT NULL UNIQUE,
  numero_serie                  TEXT,
  activo_fijo                   TEXT,
  nombre                        TEXT        NOT NULL,
  marca                         TEXT,
  modelo                        TEXT,
  categoria_id                  UUID        NOT NULL REFERENCES categorias_equipo(id) ON DELETE RESTRICT,
  -- FK al tipo de mantenimiento por defecto del equipo (intencional: define periodicidad)
  tipo_mantenimiento_id         UUID        NOT NULL REFERENCES tipos_mantenimiento(id) ON DELETE RESTRICT,
  fecha_fabricacion             DATE,
  fecha_ultimo_mantenimiento    TIMESTAMPTZ,
  observaciones                 TEXT,
  activo                        BOOLEAN     NOT NULL DEFAULT true,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- equipo_contratos
-- Asignación de un equipo a un contrato con ubicación específica.
-- Un equipo solo puede tener UN registro con fecha_retiro NULL (contrato vigente).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS equipo_contratos (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  equipo_id        UUID        NOT NULL REFERENCES equipos(id) ON DELETE RESTRICT,
  contrato_id      UUID        NOT NULL REFERENCES contratos(id) ON DELETE RESTRICT,
  ubicacion_id     UUID        REFERENCES ubicaciones(id) ON DELETE SET NULL,
  fecha_asignacion DATE        NOT NULL DEFAULT CURRENT_DATE,
  fecha_retiro     DATE,
  observaciones    TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Constraint: un equipo solo puede tener un contrato vigente (sin fecha_retiro) a la vez
CREATE UNIQUE INDEX IF NOT EXISTS uidx_equipo_contrato_vigente
  ON equipo_contratos (equipo_id)
  WHERE fecha_retiro IS NULL;


-- =============================================================================
-- FASE 3 — TABLAS DE REPORTE
-- =============================================================================

-- -----------------------------------------------------------------------------
-- reportes_mantenimiento
-- Documento central del reporte técnico. Flujo de estado estricto:
--   borrador → pendiente_firma_tecnico → pendiente_firma_cliente → cerrado
-- Único retroceso permitido: → anulado
-- No puede cerrarse sin firma_tecnico y firma_cliente.
--
-- NOMBRES REALES EN SUPABASE (diferencia con diseño original):
--   hash_firma_tecnico  (NO firma_tecnico_hash)
--   hash_firma_cliente  (NO firma_cliente_hash)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reportes_mantenimiento (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  equipo_id               UUID        NOT NULL REFERENCES equipos(id) ON DELETE RESTRICT,
  tecnico_principal_id    UUID        NOT NULL REFERENCES tecnicos(id) ON DELETE RESTRICT,
  tipo_mantenimiento_id   UUID        NOT NULL REFERENCES tipos_mantenimiento(id) ON DELETE RESTRICT,

  estado_reporte          TEXT        NOT NULL DEFAULT 'borrador',
  CONSTRAINT ck_estado_reporte CHECK (estado_reporte IN (
    'borrador',
    'pendiente_firma_tecnico',
    'pendiente_firma_cliente',
    'cerrado',
    'anulado'
  )),

  fecha_inicio            TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_fin               TIMESTAMPTZ,
  diagnostico             TEXT,
  trabajo_realizado       TEXT,
  observaciones           TEXT,

  -- ── Firma del técnico
  -- firma_tecnico: path/URL en Supabase Storage (nunca base64 completo)
  firma_tecnico           TEXT,
  hash_firma_tecnico      VARCHAR(64),           -- SHA-256 del canvas en servidor
  fecha_firma_tecnico     TIMESTAMPTZ,

  -- ── Firma del cliente
  firma_cliente           TEXT,
  hash_firma_cliente      VARCHAR(64),
  fecha_firma_cliente     TIMESTAMPTZ,
  nombre_cliente_firma    TEXT,

  -- ── Sincronización offline
  dispositivo_origen      TEXT,
  sincronizado            BOOLEAN     NOT NULL DEFAULT false,
  fecha_sincronizacion    TIMESTAMPTZ,

  activo                  BOOLEAN     NOT NULL DEFAULT true,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- ── Campos del formulario físico (fase6 — 2026-03-06)
  hora_entrada            TIME,                  -- Hora de ingreso al sitio
  hora_salida             TIME,                  -- Hora de salida del sitio
  ciudad                  VARCHAR(100),
  solicitado_por          VARCHAR(150),          -- Persona de contacto en el cliente
  numero_reporte_fisico   VARCHAR(20),           -- Nro del reporte en papel (trazabilidad)
  motivo_visita           VARCHAR(30),
  CONSTRAINT ck_motivo_visita CHECK (motivo_visita IS NULL OR motivo_visita IN (
    'garantia', 'contrato', 'demo', 'emergencia', 'llamada', 'capacitacion'
  )),
  estado_equipo_post      VARCHAR(30),           -- Estado del equipo al cerrar el reporte
  CONSTRAINT ck_estado_equipo_post CHECK (estado_equipo_post IS NULL OR estado_equipo_post IN (
    'operativo', 'restringido', 'no_operativo', 'almacenado', 'dado_de_baja'
  )),

  -- ── Snapshots del equipo al momento del reporte (preserva historial)
  equipo_marca_snapshot   VARCHAR(100),
  equipo_modelo_snapshot  VARCHAR(100),
  equipo_serie_snapshot   VARCHAR(100),

-- ── Ubicación del reporte (fase7)
  ubicacion_id            UUID        REFERENCES ubicaciones(id) ON DELETE SET NULL,
  ubicacion_detalle       VARCHAR(200),

  -- ── Constraint de integridad: cierre requiere ambas firmas
  CONSTRAINT ck_reporte_cerrado_requiere_firmas CHECK (
    estado_reporte <> 'cerrado'
    OR (firma_tecnico IS NOT NULL AND firma_cliente IS NOT NULL)
  )
);

-- Índice único parcial: numero_reporte_fisico debe ser único solo cuando no es NULL
CREATE UNIQUE INDEX IF NOT EXISTS uidx_reporte_numero_fisico
  ON reportes_mantenimiento (numero_reporte_fisico)
  WHERE numero_reporte_fisico IS NOT NULL;

-- -----------------------------------------------------------------------------
-- reporte_accesorios (fase6 — 2026-03-06)
-- Accesorios y repuestos registrados en el reporte, clasificados según el
-- estado en que se encontraba el equipo al momento del registro.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reporte_accesorios (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  reporte_id              UUID        NOT NULL REFERENCES reportes_mantenimiento(id) ON DELETE CASCADE,
  descripcion             VARCHAR(200) NOT NULL,
  cantidad                NUMERIC(10,2) NOT NULL CHECK (cantidad > 0),
  estado_equipo_contexto  VARCHAR(20) NOT NULL
                            CHECK (estado_equipo_contexto IN ('operativo', 'restringido', 'no_operativo')),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE reporte_accesorios
  IS 'Accesorios y repuestos por estado del equipo en el momento del reporte.';

-- -----------------------------------------------------------------------------
-- reporte_tecnicos
-- Técnicos adicionales de apoyo en un reporte
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reporte_tecnicos (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  reporte_id  UUID        NOT NULL REFERENCES reportes_mantenimiento(id) ON DELETE CASCADE,
  tecnico_id  UUID        NOT NULL REFERENCES tecnicos(id) ON DELETE RESTRICT,
  rol         TEXT        NOT NULL DEFAULT 'apoyo',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (reporte_id, tecnico_id)
);

-- -----------------------------------------------------------------------------
-- actividades_checklist
-- Catálogo de actividades por categoría de equipo
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS actividades_checklist (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria_id UUID        NOT NULL REFERENCES categorias_equipo(id) ON DELETE RESTRICT,
  descripcion  TEXT        NOT NULL,
  orden        INT         NOT NULL DEFAULT 0,
  obligatoria  BOOLEAN     NOT NULL DEFAULT false,
  activa       BOOLEAN     NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- reporte_actividades
-- Actividades del checklist realizadas en un reporte específico
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reporte_actividades (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  reporte_id    UUID        NOT NULL REFERENCES reportes_mantenimiento(id) ON DELETE CASCADE,
  actividad_id  UUID        NOT NULL REFERENCES actividades_checklist(id) ON DELETE RESTRICT,
  completada    BOOLEAN     NOT NULL DEFAULT false,
  observacion   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (reporte_id, actividad_id)
);

-- -----------------------------------------------------------------------------
-- reporte_insumos_usados
-- Insumos efectivamente utilizados durante el mantenimiento
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reporte_insumos_usados (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  reporte_id  UUID        NOT NULL REFERENCES reportes_mantenimiento(id) ON DELETE CASCADE,
  insumo_id   UUID        NOT NULL REFERENCES insumos(id) ON DELETE RESTRICT,
  cantidad    NUMERIC     NOT NULL CHECK (cantidad > 0),
  observacion TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- reporte_insumos_requeridos
-- Insumos que se detectaron como necesarios pero no estaban disponibles
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reporte_insumos_requeridos (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  reporte_id  UUID        NOT NULL REFERENCES reportes_mantenimiento(id) ON DELETE CASCADE,
  insumo_id   UUID        NOT NULL REFERENCES insumos(id) ON DELETE RESTRICT,
  cantidad    NUMERIC     NOT NULL CHECK (cantidad > 0),
  urgente     BOOLEAN     NOT NULL DEFAULT false,
  observacion TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- sync_conflicts
-- Registro de conflictos detectados durante sincronización offline.
--
-- NOMBRES REALES EN SUPABASE (diferencia con diseño original):
--   detalle           (NO descripcion)
--   fecha_conflicto   (columna adicional, TIMESTAMPTZ NOT NULL DEFAULT now())
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sync_conflicts (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  reporte_id          UUID        REFERENCES reportes_mantenimiento(id) ON DELETE SET NULL,
  dispositivo_origen  TEXT        NOT NULL,
  fecha_conflicto     TIMESTAMPTZ NOT NULL DEFAULT now(),
  detalle             TEXT        NOT NULL,   -- descripción del conflicto
  payload_conflicto   JSONB,
  resuelto            BOOLEAN     NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- =============================================================================
-- FASE 4 — FUNCIÓN updated_at Y TRIGGERS
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Tablas maestras
CREATE OR REPLACE TRIGGER trg_clientes_updated_at
  BEFORE UPDATE ON clientes FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE OR REPLACE TRIGGER trg_contratos_updated_at
  BEFORE UPDATE ON contratos FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE OR REPLACE TRIGGER trg_categorias_equipo_updated_at
  BEFORE UPDATE ON categorias_equipo FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE OR REPLACE TRIGGER trg_tecnicos_updated_at
  BEFORE UPDATE ON tecnicos FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE OR REPLACE TRIGGER trg_tipos_mantenimiento_updated_at
  BEFORE UPDATE ON tipos_mantenimiento FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE OR REPLACE TRIGGER trg_insumos_updated_at
  BEFORE UPDATE ON insumos FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE OR REPLACE TRIGGER trg_ubicaciones_updated_at
  BEFORE UPDATE ON ubicaciones FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- Tablas de equipos
CREATE OR REPLACE TRIGGER trg_equipos_updated_at
  BEFORE UPDATE ON equipos FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE OR REPLACE TRIGGER trg_equipo_contratos_updated_at
  BEFORE UPDATE ON equipo_contratos FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- Tablas de reporte
CREATE OR REPLACE TRIGGER trg_reportes_mantenimiento_updated_at
  BEFORE UPDATE ON reportes_mantenimiento FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE OR REPLACE TRIGGER trg_actividades_checklist_updated_at
  BEFORE UPDATE ON actividades_checklist FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();


-- =============================================================================
-- FASE 5 — VISTAS
-- (Definiciones tomadas directamente de pg_views en Supabase — 2026-03-06)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- v_equipo_contrato_vigente
-- Contrato vigente de cada equipo con datos enriquecidos de categoría,
-- tipo de mantenimiento y cliente.
-- Nota: esta vista tiene MÁS columnas que el diseño original (marca, modelo,
-- equipo_activo, categoria_nombre, tipo_mantenimiento, periodicidad_dias,
-- fecha_ultimo_mantenimiento).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_equipo_contrato_vigente AS
  SELECT
    e.id                          AS equipo_id,
    e.codigo_mh,
    e.nombre                      AS equipo_nombre,
    e.numero_serie,
    e.activo_fijo,
    e.marca,
    e.modelo,
    e.activo                      AS equipo_activo,
    ce.nombre                     AS categoria_nombre,
    tm.nombre                     AS tipo_mantenimiento,
    tm.periodicidad_dias,
    e.fecha_ultimo_mantenimiento,
    ec.id                         AS equipo_contrato_id,
    ec.contrato_id,
    c.numero_contrato,
    c.cliente_id,
    cl.razon_social               AS cliente_nombre,
    ec.ubicacion_id,
    u.nombre                      AS ubicacion_nombre,
    ec.fecha_asignacion
  FROM equipos e
  JOIN equipo_contratos ec  ON ec.equipo_id = e.id AND ec.fecha_retiro IS NULL
  JOIN contratos c          ON c.id = ec.contrato_id
  JOIN clientes cl          ON cl.id = c.cliente_id
  JOIN categorias_equipo ce ON ce.id = e.categoria_id
  JOIN tipos_mantenimiento tm ON tm.id = e.tipo_mantenimiento_id
  LEFT JOIN ubicaciones u   ON u.id = ec.ubicacion_id;

-- -----------------------------------------------------------------------------
-- v_equipos_mantenimiento_vencido
-- Equipos activos con mantenimiento vencido o sin ejecutar.
-- Usa subconsulta para calcular el último mantenimiento CERRADO del equipo
-- (NO la columna fecha_ultimo_mantenimiento, que puede estar desactualizada).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_equipos_mantenimiento_vencido AS
  SELECT
    e.id                          AS equipo_id,
    e.codigo_mh,
    e.nombre                      AS equipo_nombre,
    tm.nombre                     AS tipo_mantenimiento,
    tm.periodicidad_dias,
    ult.fecha_ultimo_cerrado,
    (ult.fecha_ultimo_cerrado + (tm.periodicidad_dias || ' days')::INTERVAL)::DATE
                                  AS fecha_proximo_mantenimiento,
    cl.razon_social               AS cliente_nombre,
    u.nombre                      AS ubicacion_nombre
  FROM equipos e
  JOIN tipos_mantenimiento tm
    ON tm.id = e.tipo_mantenimiento_id AND tm.es_planificado = true
  LEFT JOIN (
    SELECT equipo_id, MAX(fecha_fin) AS fecha_ultimo_cerrado
    FROM reportes_mantenimiento
    WHERE estado_reporte = 'cerrado'
    GROUP BY equipo_id
  ) ult ON ult.equipo_id = e.id
  LEFT JOIN equipo_contratos ec ON ec.equipo_id = e.id AND ec.fecha_retiro IS NULL
  LEFT JOIN contratos c         ON c.id = ec.contrato_id
  LEFT JOIN clientes cl         ON cl.id = c.cliente_id
  LEFT JOIN ubicaciones u       ON u.id = ec.ubicacion_id
  WHERE e.activo = true
    AND tm.periodicidad_dias > 0
    AND (
      ult.fecha_ultimo_cerrado IS NULL
      OR (ult.fecha_ultimo_cerrado + (tm.periodicidad_dias || ' days')::INTERVAL) < now()
    );

-- -----------------------------------------------------------------------------
-- v_historial_equipo
-- Historial completo de asignaciones de contrato por equipo
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_historial_equipo AS
  SELECT
    e.id              AS equipo_id,
    e.codigo_mh,
    e.nombre          AS equipo_nombre,
    ec.id             AS equipo_contrato_id,
    ec.contrato_id,
    c.numero_contrato,
    cl.razon_social   AS cliente_nombre,
    u.nombre          AS ubicacion_nombre,
    ec.fecha_asignacion,
    ec.fecha_retiro,
    ec.observaciones
  FROM equipos e
  JOIN equipo_contratos ec  ON ec.equipo_id = e.id
  JOIN contratos c          ON c.id = ec.contrato_id
  JOIN clientes cl          ON cl.id = c.cliente_id
  LEFT JOIN ubicaciones u   ON u.id = ec.ubicacion_id
  ORDER BY e.codigo_mh, ec.fecha_asignacion DESC;

-- -----------------------------------------------------------------------------
-- v_historial_ubicaciones_equipo (fase7)
-- Historial de ubicaciones de equipos basado en los reportes cerrados.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_historial_ubicaciones_equipo AS
  SELECT
    rm.equipo_id,
    e.codigo_mh,
    e.nombre          AS equipo_nombre,
    u.nombre          AS ubicacion_nombre,
    rm.ubicacion_detalle,
    rm.fecha_inicio   AS fecha_registro,
    rm.estado_reporte,
    t.nombre || ' ' || t.apellido AS tecnico_nombre
  FROM reportes_mantenimiento rm
  JOIN equipos      e ON e.id = rm.equipo_id
  JOIN tecnicos     t ON t.id = rm.tecnico_principal_id
  LEFT JOIN ubicaciones u ON u.id = rm.ubicacion_id
  WHERE rm.estado_reporte IN ('pendiente_firma_cliente', 'cerrado')
  ORDER BY rm.equipo_id, rm.fecha_inicio DESC;

-- -----------------------------------------------------------------------------
-- v_correctivos_por_marca_modelo (fase6 — 2026-03-06)
-- Ranking de marcas/modelos con más intervenciones correctivas cerradas.
-- Niveles: crítico ≥5, alerta ≥3, normal <3
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_correctivos_por_marca_modelo AS
  SELECT
    e.marca,
    e.modelo,
    cat.nombre                                                  AS nombre_categoria,
    COUNT(rm.id)                                                AS total_correctivos,
    COUNT(DISTINCT e.id)                                        AS equipos_afectados,
    ROUND(COUNT(rm.id)::NUMERIC / NULLIF(COUNT(DISTINCT e.id), 0), 2)
                                                                AS promedio_correctivos_por_equipo,
    MAX(rm.fecha_inicio)                                        AS ultimo_correctivo,
    CASE
      WHEN COUNT(rm.id) >= 5 THEN 'critico'
      WHEN COUNT(rm.id) >= 3 THEN 'alerta'
      ELSE 'normal'
    END                                                         AS nivel_alerta
  FROM reportes_mantenimiento rm
  JOIN equipos             e   ON e.id  = rm.equipo_id
  JOIN categorias_equipo   cat ON cat.id = e.categoria_id
  JOIN tipos_mantenimiento tm  ON tm.id  = rm.tipo_mantenimiento_id
  WHERE tm.nombre IN ('Correctivo', 'Preventivo-Correctivo')
    AND rm.estado_reporte = 'cerrado'
  GROUP BY e.marca, e.modelo, cat.nombre
  ORDER BY total_correctivos DESC;

COMMENT ON VIEW v_correctivos_por_marca_modelo
  IS 'Ranking de marcas y modelos con más intervenciones correctivas cerradas. Útil para detectar equipos problemáticos.';

-- -----------------------------------------------------------------------------
-- v_duracion_intervenciones (fase6 — 2026-03-06)
-- Duración en minutos de cada intervención cerrada.
-- Requiere hora_entrada y hora_salida en el reporte.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_duracion_intervenciones AS
  SELECT
    rm.id                                                       AS id_reporte,
    e.codigo_mh,
    e.marca,
    e.modelo,
    tm.nombre                                                   AS nombre_tipo,
    rm.fecha_inicio                                             AS fecha_ejecucion,
    rm.hora_entrada,
    rm.hora_salida,
    CASE
      WHEN rm.hora_entrada IS NOT NULL AND rm.hora_salida IS NOT NULL
      THEN EXTRACT(EPOCH FROM (rm.hora_salida - rm.hora_entrada)) / 60
      ELSE NULL
    END                                                         AS duracion_minutos,
    t.nombre || ' ' || t.apellido                               AS tecnico_responsable,
    cl.razon_social                                             AS cliente_nombre
  FROM reportes_mantenimiento rm
  JOIN equipos             e   ON e.id  = rm.equipo_id
  JOIN tipos_mantenimiento tm  ON tm.id = rm.tipo_mantenimiento_id
  JOIN tecnicos            t   ON t.id  = rm.tecnico_principal_id
  LEFT JOIN equipo_contratos ec ON ec.equipo_id = e.id AND ec.fecha_retiro IS NULL
  LEFT JOIN contratos      c   ON c.id = ec.contrato_id
  LEFT JOIN clientes       cl  ON cl.id = c.cliente_id
  WHERE rm.estado_reporte = 'cerrado';

COMMENT ON VIEW v_duracion_intervenciones
  IS 'Duración en minutos de cada intervención cerrada. Permite analizar eficiencia por técnico y tipo.';


-- =============================================================================
-- FASE 6 — SEEDERS
-- =============================================================================

-- Tipos de mantenimiento base — 6 tipos oficiales del sistema
INSERT INTO tipos_mantenimiento (nombre, descripcion, periodicidad_dias, es_planificado) VALUES
  ('Preventivo',            'Mantenimiento planificado periódico para prevenir fallas',          365, true),
  ('Correctivo',            'Mantenimiento por falla o daño detectado en campo',                   0, false),
  ('Preventivo-Correctivo', 'Mantenimiento planificado que incluye corrección de fallas',        365, true),
  ('Emergencia',            'Intervención urgente no planificada por falla crítica del equipo',    0, false),
  ('Instalación',           'Puesta en marcha e instalación de equipo nuevo',                     0, false),
  ('Retiro',                'Retiro definitivo o temporal del equipo de servicio',                 0, false)
ON CONFLICT (nombre) DO NOTHING;

-- Categorías de equipos de ejemplo
INSERT INTO categorias_equipo (id, nombre, descripcion) VALUES
  (gen_random_uuid(), 'Cama hospitalaria',  'Camas de hospitalización estándar y eléctricas'),
  (gen_random_uuid(), 'Camilla',            'Camillas de transporte y examinación'),
  (gen_random_uuid(), 'Coche de paro',      'Carros de emergencia y reanimación'),
  (gen_random_uuid(), 'Silla de ruedas',    'Sillas de ruedas manuales y mecánicas')
ON CONFLICT (nombre) DO NOTHING;

-- =============================================================================
-- FASE 7 — CONSTRAINTS POST-CREACIÓN (reportes_mantenimiento)
-- Verificados y presentes en Supabase. Sincronizado: 2026-03-09
-- =============================================================================

ALTER TABLE reportes_mantenimiento
  ADD CONSTRAINT ck_estado_reporte CHECK (
    estado_reporte = ANY (
      ARRAY['borrador','pendiente_firma_tecnico','pendiente_firma_cliente','cerrado','anulado']
    )
  );

ALTER TABLE reportes_mantenimiento
  ADD CONSTRAINT ck_motivo_visita CHECK (
    motivo_visita IS NULL OR motivo_visita = ANY (
      ARRAY['garantia','contrato','demo','emergencia','llamada','capacitacion']
    )
  );

ALTER TABLE reportes_mantenimiento
  ADD CONSTRAINT ck_estado_equipo_post CHECK (
    estado_equipo_post IS NULL OR estado_equipo_post = ANY (
      ARRAY['operativo','restringido','no_operativo','almacenado','dado_de_baja']
    )
  );

ALTER TABLE reportes_mantenimiento
  ADD CONSTRAINT ck_reporte_cerrado_requiere_firmas CHECK (
    estado_reporte <> 'cerrado'
    OR (firma_tecnico IS NOT NULL AND firma_cliente IS NOT NULL)
  );

-- =============================================================================
-- FASE 8 — FUNCIONES RPC (transacciones críticas)
-- Sincronizado: 2026-03-09
-- =============================================================================

-- Reasigna un equipo a un nuevo contrato de forma atómica.
-- Cierra la asignación vigente (fecha_retiro = hoy) antes de insertar la nueva.
CREATE OR REPLACE FUNCTION reasignar_equipo_contrato(
    p_equipo_id UUID,
    p_contrato_id UUID,
    p_ubicacion_id UUID,
    p_fecha_asignacion DATE
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE equipo_contratos
    SET fecha_retiro = CURRENT_DATE
    WHERE equipo_id = p_equipo_id
      AND fecha_retiro IS NULL;

    INSERT INTO equipo_contratos (equipo_id, contrato_id, ubicacion_id, fecha_asignacion)
    VALUES (p_equipo_id, p_contrato_id, p_ubicacion_id, p_fecha_asignacion);
END;
$$;
