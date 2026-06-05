-- Migration v12: payment tolerance and payment audit fields

ALTER TABLE schools
    ADD COLUMN IF NOT EXISTS payment_grace_days INTEGER NOT NULL DEFAULT 10,
    ADD COLUMN IF NOT EXISTS last_payment_at TIMESTAMP;

UPDATE schools
SET payment_grace_days = 10
WHERE payment_grace_days IS NULL OR payment_grace_days < 0;
