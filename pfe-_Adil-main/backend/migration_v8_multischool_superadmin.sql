-- Migration v8: multi-ecole + role SUPER_ADMIN

-- 1) Add role SUPER_ADMIN in enum user_role
DO $$
BEGIN
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 2) Schools table
CREATE TABLE IF NOT EXISTS schools (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    code VARCHAR(30) NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3) Add school_id to users/modules/registration requests
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS school_id INTEGER REFERENCES schools(id) ON DELETE SET NULL;

ALTER TABLE modules
    ADD COLUMN IF NOT EXISTS school_id INTEGER REFERENCES schools(id) ON DELETE SET NULL;

ALTER TABLE student_registration_requests
    ADD COLUMN IF NOT EXISTS school_id INTEGER REFERENCES schools(id) ON DELETE SET NULL;

-- 4) Create default school and backfill legacy data
INSERT INTO schools (name, code)
SELECT 'Ecole Demo', 'DEMO'
WHERE NOT EXISTS (SELECT 1 FROM schools WHERE code = 'DEMO');

UPDATE users
SET school_id = (SELECT id FROM schools WHERE code = 'DEMO')
WHERE school_id IS NULL
  AND role_global IN ('ADMIN', 'FORMATEUR', 'FORMATEUR_SIMPLE', 'ETUDIANT');

UPDATE modules
SET school_id = (SELECT id FROM schools WHERE code = 'DEMO')
WHERE school_id IS NULL;

-- 5) Helpful indexes
CREATE INDEX IF NOT EXISTS idx_users_school_id ON users(school_id);
CREATE INDEX IF NOT EXISTS idx_modules_school_id ON modules(school_id);
CREATE INDEX IF NOT EXISTS idx_student_registration_requests_school_id ON student_registration_requests(school_id);
