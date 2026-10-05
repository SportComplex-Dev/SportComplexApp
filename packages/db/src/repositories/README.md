# Repositorio de Tokens de Verificación

## `verification-tokens.ts` — Acceso a Datos TokenVerificacion

### Propósito
Provee CRUD tipado y mínimo para `TokenVerificacion` usado por flujos de auth (TSK-BE-03).

### Referencia de Esquema (`prisma/schema.prisma`)
```prisma
model TokenVerificacion {
  id        String    @id @default(uuid()) @db.Uuid
  usuarioId String    @map("usuario_id") @db.Uuid
  tokenHash String    @unique @map("token_hash") @db.VarChar(255)
  creadoEn  DateTime  @default(now()) @map("creado_en") @db.Timestamptz
  expiraEn  DateTime  @map("expira_en") @db.Timestamptz
  usadoEn   DateTime? @map("usado_en") @db.Timestamptz

  usuario Usuario @relation(fields: [usuarioId], references: [id], onDelete: Cascade)

  @@map("token_verificacion")
}
```

### Exportaciones

| Función | Firma | Descripción |
|---------|-------|-------------|
| `createToken` | `(usuarioId, tokenHash, expiraEn) => Promise<TokenVerificacion>` | Inserta nuevo token; `creado_en` auto-se a `now()` |
| `findLatestByUsuarioId` | `(usuarioId) => Promise<TokenVerificacion \| null>` | Busca el token **sin usar** (`usadoEn = null`) más reciente ordenado por `creado_en DESC` |
| `markUsed` | `(id) => Promise<TokenVerificacion>` | Establece `usado_en = now()` (invalidación suave) |

### Patrones de Uso

#### Crear en registro / reenvío
```typescript
import { createToken } from "@sportcomplex/db/repositories/verification-tokens";

const token = await createToken(
  usuario.id,
  tokenHash,           // Hash Argon2id del código de 6 dígitos
  new Date(Date.now() + 15 * 60 * 1000) // expira_en = now + 15min
);
```

#### Buscar último para rate limit / verificar
```typescript
import { findLatestByUsuarioId } from "@sportcomplex/db/repositories/verification-tokens";

const latest = await findLatestByUsuarioId(usuarioId);
// Retorna null si no existe token sin usar
```

#### Invalidar en verificación / reenvío
```typescript
import { markUsed } from "@sportcomplex/db/repositories/verification-tokens";

await markUsed(token.id); // Soft delete — preserva rastro de auditoría
```

### Decisiones de Diseño
- **Invalidación suave (`usado_en`)** en vez de borrado duro — preserva rastro de auditoría para revisiones de seguridad
- **Restricción única en `token_hash`** — previene hashes duplicados accidentales (extremadamente improbable con Argon2id + salt)
- **Índice implícito en `(usuario_id, creado_en)`** — vía `orderBy: { creadoEn: 'desc' }` + `where: { usadoEn: null }`
- **Cascade delete en Usuario** — tokens eliminados cuando se borra el usuario