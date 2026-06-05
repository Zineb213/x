-- Migration v6: Support pour composants custom par module et assignment_type (PRINCIPAL/SIMPLE)

-- Ajouter colonne components à la table modules (array de texte)
ALTER TABLE modules
    ADD COLUMN IF NOT EXISTS components text[] DEFAULT ARRAY['Cours', 'TD', 'TP'];

UPDATE modules
SET components = ARRAY['Cours', 'TD', 'TP']
WHERE components IS NULL OR array_length(components, 1) IS NULL;

-- Ajouter colonne assignment_type à formateur_module_assignment
ALTER TABLE formateur_module_assignment
    ADD COLUMN IF NOT EXISTS assignment_type VARCHAR(20) CHECK (assignment_type IN ('PRINCIPAL', 'SIMPLE'));

-- Migrer les données is_primary -> assignment_type
UPDATE formateur_module_assignment
SET assignment_type = CASE 
    WHEN is_primary = true THEN 'PRINCIPAL'
    ELSE 'SIMPLE'
END
WHERE assignment_type IS NULL;

UPDATE formateur_module_assignment
SET component_scope = ARRAY['Cours', 'TD', 'TP']
WHERE assignment_type = 'SIMPLE'
    AND (component_scope IS NULL OR array_length(component_scope, 1) IS NULL);

-- Rendre assignment_type NOT NULL après migration
ALTER TABLE formateur_module_assignment
    ALTER COLUMN assignment_type SET NOT NULL;

-- Supprimer les anciennes contraintes hardcoded
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fma_primary_scope_check'
    ) THEN
        ALTER TABLE formateur_module_assignment
            DROP CONSTRAINT fma_primary_scope_check;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fma_component_scope_values_check'
    ) THEN
        ALTER TABLE formateur_module_assignment
            DROP CONSTRAINT fma_component_scope_values_check;
    END IF;
END $$;

-- Nouvelle contrainte : si PRINCIPAL, component_scope doit être NULL
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fma_type_scope_check'
    ) THEN
        ALTER TABLE formateur_module_assignment
            ADD CONSTRAINT fma_type_scope_check
            CHECK (
                (assignment_type = 'PRINCIPAL' AND component_scope IS NULL) OR
                (assignment_type = 'SIMPLE' AND component_scope IS NOT NULL)
            );
    END IF;
END $$;

-- Index pour assignment_type
CREATE INDEX IF NOT EXISTS idx_fma_assignment_type ON formateur_module_assignment(assignment_type);

-- Assurer l'unicité : un seul PRINCIPAL par module
CREATE UNIQUE INDEX IF NOT EXISTS idx_fma_one_principal_per_module 
ON formateur_module_assignment(module_id) 
WHERE assignment_type = 'PRINCIPAL';

-- Créer index sur module.components
CREATE INDEX IF NOT EXISTS idx_modules_components ON modules USING GIN(components);
