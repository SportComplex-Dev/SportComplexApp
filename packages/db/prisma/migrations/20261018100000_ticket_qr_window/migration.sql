ALTER TABLE "ticket_qr"
ADD COLUMN "inicio_validez" TIMESTAMPTZ,
ADD COLUMN "fin_validez" TIMESTAMPTZ,
ADD CONSTRAINT "ticket_qr_validity_window_check"
CHECK (
  ("inicio_validez" IS NULL AND "fin_validez" IS NULL)
  OR ("inicio_validez" IS NOT NULL AND "fin_validez" IS NOT NULL AND "fin_validez" > "inicio_validez")
);
