-- Migration v14: dynamic school-defined levels instead of fixed enum/checks

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
