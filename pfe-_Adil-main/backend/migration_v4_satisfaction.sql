-- Migration v4: suivi de satisfaction

CREATE TABLE IF NOT EXISTS satisfaction_surveys (
    id SERIAL PRIMARY KEY,
    module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS satisfaction_responses (
    id SERIAL PRIMARY KEY,
    survey_id INTEGER NOT NULL REFERENCES satisfaction_surveys(id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating SMALLINT NOT NULL,
    comment TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT satisfaction_rating_check CHECK (rating >= 1 AND rating <= 5),
    CONSTRAINT unique_student_response_per_survey UNIQUE (survey_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_satisfaction_surveys_module
    ON satisfaction_surveys(module_id);

CREATE INDEX IF NOT EXISTS idx_satisfaction_surveys_active
    ON satisfaction_surveys(is_active);

CREATE INDEX IF NOT EXISTS idx_satisfaction_responses_survey
    ON satisfaction_responses(survey_id);

CREATE INDEX IF NOT EXISTS idx_satisfaction_responses_student
    ON satisfaction_responses(student_id);
