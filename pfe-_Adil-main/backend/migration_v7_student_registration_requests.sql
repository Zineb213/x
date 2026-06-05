-- Migration v7: demandes d'inscription etudiant avec validation admin

CREATE TABLE IF NOT EXISTS student_registration_requests (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    nom VARCHAR(120) NOT NULL,
    prenom VARCHAR(120) NOT NULL,
    niveau VARCHAR(2) NOT NULL CHECK (niveau IN ('L1', 'L2', 'L3', 'M1', 'M2')),
    password_hash TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP,
    reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    review_comment TEXT,
    approved_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_student_registrations_status_requested
ON student_registration_requests(status, requested_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_student_registrations_pending_email
ON student_registration_requests(email)
WHERE status = 'PENDING';
