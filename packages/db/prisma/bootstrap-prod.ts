import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Cargar variables de entorno locales de web o db
dotenv.config();
if (typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile(path.resolve(__dirname, "../../../apps/web/.env.local"));
  } catch {}
  try {
    process.loadEnvFile(path.resolve(__dirname, "../../../apps/web/.env"));
  } catch {}
  try {
    process.loadEnvFile(path.resolve(__dirname, "../.env"));
  } catch {}
}

import { PeriodicidadPlan, EstadoUsuario } from "@prisma/client";
import { prisma } from "../src/client.js";

async function hashArgon2id(password: string): Promise<string> {
  const { hash } = await import("@node-rs/argon2");
  return hash(password, {
    algorithm: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

interface SupabaseAuthUser {
  id: string;
  email?: string;
}

async function syncSupabaseAuthUser(
  supabaseUrl: string,
  serviceKey: string,
  email: string,
  password: string,
  rotatePassword = false
): Promise<{ success: boolean; action: "created" | "updated" | "exists" | "skipped"; detail?: string }> {
  const adminHeaders = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
  };

  const normalizedEmail = email.toLowerCase().trim();

  // 1. Buscar usuario existente en Supabase Auth
  let existingUser: SupabaseAuthUser | null = null;
  const perPage = 1000;
  for (let page = 1; ; page += 1) {
    const listRes = await fetch(`${supabaseUrl}/auth/v1/admin/users?page=${page}&per_page=${perPage}`, {
      headers: adminHeaders,
    });

    if (!listRes.ok) {
      const errText = await listRes.text();
      throw new Error(`Admin list Supabase Auth falló (${listRes.status}): ${errText}`);
    }

    const body = (await listRes.json()) as { users?: SupabaseAuthUser[] };
    const batch = body.users ?? [];
    const match = batch.find((u) => u.email?.toLowerCase() === normalizedEmail);
    if (match) {
      existingUser = match;
      break;
    }
    if (batch.length < perPage) break;
  }

  // 2. Crear si no existe
  if (!existingUser) {
    const createRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: { role: "ADMIN", name: "Administrador de Producción" },
      }),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      return { success: false, action: "skipped", detail: `Error al crear en Supabase Auth (${createRes.status}): ${errText}` };
    }

    return { success: true, action: "created" };
  }

  // 3. Actualizar contraseña si se solicitó explícitamente (--rotate-password)
  if (rotatePassword) {
    const updateRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${existingUser.id}`, {
      method: "PUT",
      headers: adminHeaders,
      body: JSON.stringify({ password }),
    });

    if (!updateRes.ok) {
      const errText = await updateRes.text();
      return { success: false, action: "skipped", detail: `Error al rotar contraseña en Supabase Auth (${updateRes.status}): ${errText}` };
    }

    return { success: true, action: "updated" };
  }

  return { success: true, action: "exists" };
}

async function main() {
  console.log("Iniciando bootstrap de producción (bootstrap:prod)...");

  // Criterio 1: Falla de manera segura si SEED_ADMIN_PASSWORD no está definida
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminPassword || adminPassword.trim() === "") {
    console.error("❌ ERROR CRÍTICO [SCRUM-209]: La variable de entorno SEED_ADMIN_PASSWORD es obligatoria y no está definida.");
    process.exit(1);
  }

  const adminEmail = (process.env.SEED_ADMIN_EMAIL || "admin@sportcomplex.lat").toLowerCase().trim();
  const rotatePassword = process.argv.includes("--rotate-password") || process.argv.includes("--reset");

  const supabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  // Criterio 4: Altas en Supabase Auth vía Admin API con script auditado sin adivinanzas
  if (supabaseUrl && serviceKey) {
    console.log(`Verificando/sincronizando identidad en Supabase Auth Admin API (${adminEmail})...`);
    try {
      const authResult = await syncSupabaseAuthUser(supabaseUrl, serviceKey, adminEmail, adminPassword, rotatePassword);
      if (authResult.action === "created") {
        console.log(`✅ Identidad creada en Supabase Auth con email confirmado (${adminEmail}).`);
      } else if (authResult.action === "updated") {
        console.log(`✅ Contraseña de identidad en Supabase Auth rotada exitosamente (${adminEmail}).`);
      } else if (authResult.action === "exists") {
        console.log(`ℹ️ Identidad preexistente en Supabase Auth preservada (${adminEmail}). Use --rotate-password para actualizarla.`);
      }
    } catch (authError) {
      console.error("❌ Error al interactuar con Supabase Auth Admin API:", authError);
      process.exit(1);
    }
  } else {
    console.warn("⚠️ AVISO [SCRUM-209 CA-04]: SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY no están configuradas.");
    console.warn("   Para garantizar el inicio de sesión del administrador en producción, configure estas variables.");
    if (process.env.NODE_ENV === "production") {
      console.error("❌ ERROR CRÍTICO: No se puede omitir Supabase Auth Admin API en entorno de producción.");
      process.exit(1);
    }
  }

  // 1. Roles del sistema (Idempotente)
  const roles = ["ADMIN", "VENDEDOR", "LECTOR", "CLIENTE"];
  for (const nombreRol of roles) {
    await prisma.rol.upsert({
      where: { nombre: nombreRol },
      update: {},
      create: { nombre: nombreRol },
    });
  }
  console.log("✅ Roles del sistema verificados/creados: ADMIN, VENDEDOR, LECTOR, CLIENTE");

  // 2. Planes oficiales de membresía (Idempotente - Sin datos de juguete)
  const planes = [
    {
      nombre: "Plan Semanal Básico",
      periodicidad: PeriodicidadPlan.SEMANAL,
      precio: 50.00,
      descuentoPct: 30.00,
      activo: true,
    },
    {
      nombre: "Plan Mensual Estándar",
      periodicidad: PeriodicidadPlan.MENSUAL,
      precio: 180.00,
      descuentoPct: 30.00,
      activo: true,
    },
    {
      nombre: "Plan Anual Premium",
      periodicidad: PeriodicidadPlan.ANUAL,
      precio: 1800.00,
      descuentoPct: 30.00,
      activo: true,
    },
  ];

  for (const plan of planes) {
    const existing = await prisma.planMembresia.findFirst({
      where: { nombre: plan.nombre },
    });

    if (!existing) {
      await prisma.planMembresia.create({
        data: plan,
      });
    } else {
      await prisma.planMembresia.update({
        where: { id: existing.id },
        data: { precio: plan.precio, descuentoPct: plan.descuentoPct, activo: plan.activo },
      });
    }
  }
  console.log("✅ Planes oficiales de membresía sincronizados (30% descuento)");

  // 3. Cuenta de Administrador Inicial de Producción (Idempotente en PostgreSQL)
  const rolAdmin = await prisma.rol.findUnique({ where: { nombre: "ADMIN" } });
  if (!rolAdmin) {
    throw new Error("Rol ADMIN no encontrado tras el upsert.");
  }

  const passwordHash = await hashArgon2id(adminPassword);

  const existingAdmin = await prisma.usuario.findUnique({
    where: { correo: adminEmail },
  });

  if (!existingAdmin) {
    await prisma.usuario.create({
      data: {
        nombre: "Administrador de Producción",
        correo: adminEmail,
        passwordHash,
        rolId: rolAdmin.id,
        estado: EstadoUsuario.ACTIVO,
      },
    });
    console.log(`✅ Cuenta de administrador creada en tabla 'usuario' (${adminEmail}) con hash Argon2id.`);
  } else {
    const updateData: { estado: EstadoUsuario; rolId: number; deletedAt: null; passwordHash?: string } = {
      estado: EstadoUsuario.ACTIVO,
      rolId: rolAdmin.id,
      deletedAt: null,
    };
    if (rotatePassword) {
      updateData.passwordHash = passwordHash;
      console.log(`✅ Contraseña de administrador actualizada en tabla 'usuario' (${adminEmail}).`);
    } else {
      console.log(`ℹ️ Cuenta de administrador ya existe en tabla 'usuario' (${adminEmail}). Se validó estado ACTIVO y rol ADMIN.`);
    }

    await prisma.usuario.update({
      where: { correo: adminEmail },
      data: updateData,
    });
  }

  console.log("🚀 Bootstrap de producción completado con éxito (cero datos de prueba insertados).");
}

main()
  .catch((e) => {
    console.error("❌ Error durante el bootstrap de producción:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
