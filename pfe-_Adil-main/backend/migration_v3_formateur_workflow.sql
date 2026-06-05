-- Migration v3: formateur principal/simple + validation des ressources

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'user_role' AND e.enumlabel = 'FORMATEUR_SIMPLE'
    ) THEN
        ALTER TYPE user_role ADD VALUE 'FORMATEUR_SIMPLE';
    END IF;
END $$;

ALTER TABLE ressource_pedagogique
    ADD COLUMN IF NOT EXISTS approval_status varchar(20) NOT NULL DEFAULT 'APPROVED',
    ADD COLUMN IF NOT EXISTS approved_by integer NULL,
    ADD COLUMN IF NOT EXISTS approved_at timestamp without time zone NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'resources_approval_status_check'
    ) THEN
        ALTER TABLE ressource_pedagogique
            ADD CONSTRAINT resources_approval_status_check
            CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED'));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ressource_pedagogique_approved_by_fkey'
    ) THEN
        ALTER TABLE ressource_pedagogique
            ADD CONSTRAINT ressource_pedagogique_approved_by_fkey
            FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_resources_approval_status
    ON ressource_pedagogique(approval_status);

-- Un seul formateur principal par module
CREATE UNIQUE INDEX IF NOT EXISTS uniq_primary_formateur_per_module
    ON formateur_module_assignment(module_id)
    WHERE is_primary = true;
