-- CreateEnum
CREATE TYPE "EstadoUsuario" AS ENUM ('PENDIENTE', 'ACTIVO', 'TEMP_INACTIVO', 'INACTIVO');

-- CreateEnum
CREATE TYPE "TipoCategoriaServicio" AS ENUM ('CANCHA', 'PISCINA', 'GIMNASIO', 'ZONA_HUMEDA');

-- CreateEnum
CREATE TYPE "ModalidadServicio" AS ENUM ('EXCLUSIVA', 'AFORO');

-- CreateEnum
CREATE TYPE "TipoPiscina" AS ENUM ('PUBLICA', 'PRIVADA');

-- CreateEnum
CREATE TYPE "EstadoServicio" AS ENUM ('ACTIVO', 'INHABILITADO');

-- CreateEnum
CREATE TYPE "TipoPago" AS ENUM ('RESERVA', 'MEMBRESIA');

-- CreateEnum
CREATE TYPE "EstadoPago" AS ENUM ('PENDIENTE', 'APROBADO', 'FALLIDO');

-- CreateEnum
CREATE TYPE "CanalReserva" AS ENUM ('ONLINE', 'TAQUILLA');

-- CreateEnum
CREATE TYPE "EstadoReserva" AS ENUM ('PENDIENTE_PAGO', 'CONFIRMADA', 'EXPIRADA', 'CANCELADA_ADMINISTRATIVA');

-- CreateEnum
CREATE TYPE "EstadoTicket" AS ENUM ('EMITIDO', 'USADO');

-- CreateEnum
CREATE TYPE "ModoLectura" AS ENUM ('TURNO', 'CONSULTA');

-- CreateEnum
CREATE TYPE "ResultadoLectura" AS ENUM ('CONCEDIDO', 'DENEGADO_SERVICIO', 'DENEGADO_HORARIO', 'DENEGADO_USADO', 'CONSULTA');

-- CreateEnum
CREATE TYPE "PeriodicidadPlan" AS ENUM ('SEMANAL', 'MENSUAL', 'ANUAL');

-- CreateEnum
CREATE TYPE "EstadoMembresia" AS ENUM ('VIGENTE', 'VENCIDA', 'CANCELADA');

-- CreateTable
CREATE TABLE "rol" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(30) NOT NULL,

    CONSTRAINT "rol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario" (
    "id" UUID NOT NULL,
    "rol_id" INTEGER NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "correo" VARCHAR(150) NOT NULL,
    "password_hash" VARCHAR(255),
    "google_sub" VARCHAR(100),
    "estado" "EstadoUsuario" NOT NULL DEFAULT 'PENDIENTE',
    "deleted_at" TIMESTAMPTZ,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "token_verificacion" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expira_en" TIMESTAMPTZ NOT NULL,
    "usado_en" TIMESTAMPTZ,

    CONSTRAINT "token_verificacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categoria_servicio" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(60) NOT NULL,
    "tipo" "TipoCategoriaServicio" NOT NULL,

    CONSTRAINT "categoria_servicio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "servicio" (
    "id" SERIAL NOT NULL,
    "categoria_id" INTEGER NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "capacidad_maxima" INTEGER NOT NULL,
    "tarifa" DECIMAL(12,2) NOT NULL,
    "modalidad" "ModalidadServicio" NOT NULL,
    "tipo_piscina" "TipoPiscina",
    "estado" "EstadoServicio" NOT NULL DEFAULT 'ACTIVO',

    CONSTRAINT "servicio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "franja_horaria" (
    "id" SERIAL NOT NULL,
    "servicio_id" INTEGER NOT NULL,
    "dia_semana" SMALLINT NOT NULL,
    "hora_inicio" TIME NOT NULL,
    "hora_fin" TIME NOT NULL,

    CONSTRAINT "franja_horaria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disponibilidad" (
    "id" BIGSERIAL NOT NULL,
    "servicio_id" INTEGER NOT NULL,
    "franja_id" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "cupos_totales" INTEGER NOT NULL,
    "cupos_ocupados" INTEGER NOT NULL DEFAULT 0,
    "bloqueada_mantenimiento" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "disponibilidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "festivo" (
    "fecha" DATE NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "anio" SMALLINT NOT NULL,

    CONSTRAINT "festivo_pkey" PRIMARY KEY ("fecha")
);

-- CreateTable
CREATE TABLE "pago" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "membresia_id" INTEGER,
    "tipo" "TipoPago" NOT NULL,
    "stripe_payment_intent_id" VARCHAR(100) NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "estado" "EstadoPago" NOT NULL,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reserva" (
    "id" UUID NOT NULL,
    "disponibilidad_id" BIGINT NOT NULL,
    "titular_id" UUID NOT NULL,
    "vendedor_id" UUID,
    "pago_id" UUID,
    "membresia_id" INTEGER,
    "inhabilitacion_id" INTEGER,
    "cantidad_cupos" INTEGER NOT NULL,
    "canal" "CanalReserva" NOT NULL,
    "estado" "EstadoReserva" NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "descuento_pct" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "total" DECIMAL(12,2) NOT NULL,
    "expira_en" TIMESTAMPTZ,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reserva_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_qr" (
    "id" UUID NOT NULL,
    "reserva_id" UUID NOT NULL,
    "codigo_uuid" UUID NOT NULL,
    "usado_por" UUID,
    "estado" "EstadoTicket" NOT NULL,
    "emitido_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usado_en" TIMESTAMPTZ,

    CONSTRAINT "ticket_qr_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asignacion_puesto" (
    "id" SERIAL NOT NULL,
    "empleado_id" UUID NOT NULL,
    "servicio_id" INTEGER NOT NULL,
    "inicio_turno" TIMESTAMPTZ NOT NULL,
    "fin_turno" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "asignacion_puesto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lectura_acceso" (
    "id" BIGSERIAL NOT NULL,
    "ticket_id" UUID NOT NULL,
    "empleado_id" UUID NOT NULL,
    "asignacion_id" INTEGER,
    "modo" "ModoLectura" NOT NULL,
    "resultado" "ResultadoLectura" NOT NULL,
    "fecha_hora" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lectura_acceso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_membresia" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(60) NOT NULL,
    "periodicidad" "PeriodicidadPlan" NOT NULL,
    "precio" DECIMAL(12,2) NOT NULL,
    "descuento_pct" DECIMAL(5,2) NOT NULL DEFAULT 30.00,
    "stripe_price_id" VARCHAR(100),
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "plan_membresia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membresia" (
    "id" SERIAL NOT NULL,
    "usuario_id" UUID NOT NULL,
    "plan_id" INTEGER NOT NULL,
    "estado" "EstadoMembresia" NOT NULL,
    "fechaInicio" DATE NOT NULL,
    "proxima_renovacion" DATE NOT NULL,
    "stripe_subscription_id" VARCHAR(100),

    CONSTRAINT "membresia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inhabilitacion_servicio" (
    "id" SERIAL NOT NULL,
    "servicio_id" INTEGER NOT NULL,
    "admin_id" UUID NOT NULL,
    "motivo" VARCHAR(255) NOT NULL,
    "fecha_inicio" TIMESTAMPTZ NOT NULL,
    "fecha_fin" TIMESTAMPTZ,
    "webhook_enviado_en" TIMESTAMPTZ,

    CONSTRAINT "inhabilitacion_servicio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rol_nombre_key" ON "rol"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_correo_key" ON "usuario"("correo");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_google_sub_key" ON "usuario"("google_sub");

-- CreateIndex
CREATE UNIQUE INDEX "token_verificacion_token_hash_key" ON "token_verificacion"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "categoria_servicio_nombre_key" ON "categoria_servicio"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "servicio_nombre_key" ON "servicio"("nombre");

-- CreateIndex
CREATE INDEX "disponibilidad_fecha_servicio_id_idx" ON "disponibilidad"("fecha", "servicio_id");

-- CreateIndex
CREATE UNIQUE INDEX "disponibilidad_servicio_id_franja_id_fecha_key" ON "disponibilidad"("servicio_id", "franja_id", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "pago_stripe_payment_intent_id_key" ON "pago"("stripe_payment_intent_id");

-- CreateIndex
CREATE INDEX "reserva_titular_id_estado_idx" ON "reserva"("titular_id", "estado");

-- CreateIndex
CREATE INDEX "reserva_expira_en_idx" ON "reserva"("expira_en");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_qr_reserva_id_key" ON "ticket_qr"("reserva_id");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_qr_codigo_uuid_key" ON "ticket_qr"("codigo_uuid");

-- CreateIndex
CREATE INDEX "lectura_acceso_fecha_hora_idx" ON "lectura_acceso"("fecha_hora");

-- CreateIndex
CREATE UNIQUE INDEX "plan_membresia_stripe_price_id_key" ON "plan_membresia"("stripe_price_id");

-- CreateIndex
CREATE UNIQUE INDEX "membresia_stripe_subscription_id_key" ON "membresia"("stripe_subscription_id");

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "rol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_verificacion" ADD CONSTRAINT "token_verificacion_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servicio" ADD CONSTRAINT "servicio_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categoria_servicio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "franja_horaria" ADD CONSTRAINT "franja_horaria_servicio_id_fkey" FOREIGN KEY ("servicio_id") REFERENCES "servicio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disponibilidad" ADD CONSTRAINT "disponibilidad_servicio_id_fkey" FOREIGN KEY ("servicio_id") REFERENCES "servicio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disponibilidad" ADD CONSTRAINT "disponibilidad_franja_id_fkey" FOREIGN KEY ("franja_id") REFERENCES "franja_horaria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pago" ADD CONSTRAINT "pago_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pago" ADD CONSTRAINT "pago_membresia_id_fkey" FOREIGN KEY ("membresia_id") REFERENCES "membresia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reserva" ADD CONSTRAINT "reserva_disponibilidad_id_fkey" FOREIGN KEY ("disponibilidad_id") REFERENCES "disponibilidad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reserva" ADD CONSTRAINT "reserva_titular_id_fkey" FOREIGN KEY ("titular_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reserva" ADD CONSTRAINT "reserva_vendedor_id_fkey" FOREIGN KEY ("vendedor_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reserva" ADD CONSTRAINT "reserva_pago_id_fkey" FOREIGN KEY ("pago_id") REFERENCES "pago"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reserva" ADD CONSTRAINT "reserva_membresia_id_fkey" FOREIGN KEY ("membresia_id") REFERENCES "membresia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reserva" ADD CONSTRAINT "reserva_inhabilitacion_id_fkey" FOREIGN KEY ("inhabilitacion_id") REFERENCES "inhabilitacion_servicio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_qr" ADD CONSTRAINT "ticket_qr_reserva_id_fkey" FOREIGN KEY ("reserva_id") REFERENCES "reserva"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_qr" ADD CONSTRAINT "ticket_qr_usado_por_fkey" FOREIGN KEY ("usado_por") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignacion_puesto" ADD CONSTRAINT "asignacion_puesto_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignacion_puesto" ADD CONSTRAINT "asignacion_puesto_servicio_id_fkey" FOREIGN KEY ("servicio_id") REFERENCES "servicio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lectura_acceso" ADD CONSTRAINT "lectura_acceso_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "ticket_qr"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lectura_acceso" ADD CONSTRAINT "lectura_acceso_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lectura_acceso" ADD CONSTRAINT "lectura_acceso_asignacion_id_fkey" FOREIGN KEY ("asignacion_id") REFERENCES "asignacion_puesto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membresia" ADD CONSTRAINT "membresia_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membresia" ADD CONSTRAINT "membresia_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plan_membresia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inhabilitacion_servicio" ADD CONSTRAINT "inhabilitacion_servicio_servicio_id_fkey" FOREIGN KEY ("servicio_id") REFERENCES "servicio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inhabilitacion_servicio" ADD CONSTRAINT "inhabilitacion_servicio_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
