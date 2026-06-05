-- Migration v9: Super Admin billing controls + academic years

-- 1) Extend schools with payment and suspension metadata
ALTER TABLE schools
    ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    ADD COLUMN IF NOT EXISTS next_due_date DATE,
    ADD COLUMN IF NOT EXISTS suspended_reason TEXT,
    ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP;

ALTER TABLE schools
    DROP CONSTRAINT IF EXISTS schools_payment_status_check;

ALTER TABLE schools
    ADD CONSTRAINT schools_payment_status_check
    CHECK (payment_status IN ('PAID', 'PENDING', 'OVERDUE'));

-- 2) Academic years table (platform level)
CREATE TABLE IF NOT EXISTS academic_years (
    id SERIAL PRIMARY KEY,
    label VARCHAR(20) NOT NULL UNIQUE,
    start_year INTEGER NOT NULL,
    end_year INTEGER NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_academic_year_range CHECK (end_year = start_year + 1)
);

CREATE INDEX IF NOT EXISTS idx_academic_years_active ON academic_years(is_active);

-- 3) Seed current and next academic year if missing
DO $$
DECLARE
    current_year INTEGER := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
    next_year INTEGER := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER + 1;
    current_label VARCHAR(20) := CONCAT(current_year, '-', current_year + 1);
    next_label VARCHAR(20) := CONCAT(next_year, '-', next_year + 1);
BEGIN
    INSERT INTO academic_years (label, start_year, end_year, is_active)
    VALUES (current_label, current_year, current_year + 1, true)
    ON CONFLICT (label) DO NOTHING;

    INSERT INTO academic_years (label, start_year, end_year, is_active)
    VALUES (next_label, next_year, next_year + 1, false)
    ON CONFLICT (label) DO NOTHING;

    UPDATE academic_years
    SET is_active = (label = current_label)
    WHERE label IN (current_label, next_label)
      AND NOT EXISTS (
          SELECT 1
          FROM academic_years a2
          WHERE a2.is_active = true
      );
END $$;
