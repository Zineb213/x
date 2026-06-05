-- Migration v5: scope composant pour formateur simple (Cours/TD/TP)

ALTER TABLE formateur_module_assignment
    ADD COLUMN IF NOT EXISTS component_scope text[] NULL;

-- Un formateur principal couvre tout le module, donc scope null
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fma_primary_scope_check'
    ) THEN
        ALTER TABLE formateur_module_assignment
            ADD CONSTRAINT fma_primary_scope_check
            CHECK (NOT is_primary OR component_scope IS NULL);
    END IF;
END $$;

-- Valeurs autorisées pour les formateurs simples
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fma_component_scope_values_check'
    ) THEN
        ALTER TABLE formateur_module_assignment
            ADD CONSTRAINT fma_component_scope_values_check
            CHECK (
                component_scope IS NULL OR
                component_scope <@ ARRAY['Cours','TD','TP']::text[]
            );
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_fma_component_scope ON formateur_module_assignment USING GIN(component_scope);
