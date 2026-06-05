-- Migration v13: student group enrollment workflow (niveau -> module -> formateur -> groupe)

CREATE TABLE IF NOT EXISTS course_groups (
    id SERIAL PRIMARY KEY,
    school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    formateur_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    group_name VARCHAR(120) NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 30,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_course_groups_capacity CHECK (capacity > 0)
);

CREATE INDEX IF NOT EXISTS idx_course_groups_school_id ON course_groups(school_id);
CREATE INDEX IF NOT EXISTS idx_course_groups_module_id ON course_groups(module_id);
CREATE INDEX IF NOT EXISTS idx_course_groups_formateur_id ON course_groups(formateur_id);

CREATE TABLE IF NOT EXISTS course_group_slots (
    id SERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL REFERENCES course_groups(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_course_group_slots_day CHECK (day_of_week BETWEEN 1 AND 7),
    CONSTRAINT chk_course_group_slots_time CHECK (start_time < end_time)
);

CREATE INDEX IF NOT EXISTS idx_course_group_slots_group_id ON course_group_slots(group_id);
CREATE INDEX IF NOT EXISTS idx_course_group_slots_day_time ON course_group_slots(day_of_week, start_time, end_time);

CREATE TABLE IF NOT EXISTS student_group_enrollments (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    group_id INTEGER NOT NULL REFERENCES course_groups(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    enrolled_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_student_group_enrollments_status CHECK (status IN ('ACTIVE', 'CANCELLED')),
    CONSTRAINT uq_student_module_group_enrollment UNIQUE (student_id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_student_group_enrollments_student_id ON student_group_enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_student_group_enrollments_group_id ON student_group_enrollments(group_id);
CREATE INDEX IF NOT EXISTS idx_student_group_enrollments_status ON student_group_enrollments(status);
