-- seeds/create_formateurs.sql
-- Creates two trainer accounts (formateur principal and formateur simple)
-- Password for both accounts: yacine77
-- Requires: access to the `eduplatform` database and the pgcrypto extension

BEGIN;

-- Ensure pgcrypto is available for crypt/gen_salt
CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO public.users (matricule, email, password_hash, nom, prenom, role_global, is_active, created_at, updated_at)
VALUES
  ('FP20260605', 'formateur.principal@example.com', crypt('yacine77', gen_salt('bf', 10)), 'Principal', 'Formateur', 'FORMATEUR', true, now(), now()),
  ('FS20260605', 'formateur.simple@example.com',    crypt('yacine77', gen_salt('bf', 10)), 'Simple',    'Formateur', 'FORMATEUR_SIMPLE', true, now(), now());

-- Reset sequence to max id (safe if sequence exists)
SELECT setval('public.users_id_seq', COALESCE((SELECT MAX(id) FROM public.users), 1), true);

COMMIT;
