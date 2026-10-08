/**
 * TSK-BD-08 — Runner del job de expiración TTL.
 * Uso: `pnpm --filter @sportcomplex/db db:expire`
 * Programar cada minuto vía cron del SO / contenedor / pg_cron alternativo.
 */
import { expireReservasVencidas } from "../repositories/expirations.js";

const batchSize = Number.parseInt(process.env.EXPIRE_BATCH_SIZE ?? "500", 10);

expireReservasVencidas({
  batchSize: Number.isFinite(batchSize) ? batchSize : 500,
})
  .then((r) => {
    console.log(
      JSON.stringify({
        job: "expire-reservas",
        expiredCount: r.expiredCount,
        releasedCupos: r.releasedCupos,
        skippedDueToLock: r.skippedDueToLock,
      }),
    );
    process.exit(0);
  })
  .catch((err) => {
    console.error("[expire-reservas] fallo:", err);
    process.exit(1);
  });
