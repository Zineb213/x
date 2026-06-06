-- Migration v14: dynamic school-defined levels instead of fixed enum/checks

DROP VIEW IF EXISTS public.student_enrollments_view;

ALTER TABLE modules
    ALTER COLUMN niveau TYPE VARCHAR(50)
    USING niveau::text;

ALTER TABLE users
    ALTER COLUMN niveau TYPE VARCHAR(50)
    USING niveau::text;

ALTER TABLE student_registration_requests
    ALTER COLUMN niveau TYPE VARCHAR(50);

ALTER TABLE student_registration_requests
    DROP CONSTRAINT IF EXISTS student_registration_requests_niveau_check;

CREATE VIEW public.student_enrollments_view AS
 SELECT e.id AS enrollment_id,
    e.etudiant_id AS student_id,
    u.email AS student_email,
    u.nom AS student_nom,
    u.prenom AS student_prenom,
    u.niveau AS student_niveau,
    m.id AS module_id,
    m.code AS module_code,
    m.nom AS module_nom,
    m.niveau AS module_niveau,
    e.enrolled_at,
    e.status
   FROM ((public.etudiant_module_enrollment e
     JOIN public.users u ON ((e.etudiant_id = u.id)))
     JOIN public.modules m ON ((e.module_id = m.id)));

ALTER VIEW public.student_enrollments_view OWNER TO postgres;
