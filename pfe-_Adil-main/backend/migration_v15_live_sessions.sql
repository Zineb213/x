-- Migration v15 : Live Sessions
-- Permet aux formateurs de créer des sessions live (Zoom, Meet, etc.)
-- et d'informer leurs étudiants en temps quasi-réel

CREATE TABLE IF NOT EXISTS live_sessions (
    id            SERIAL PRIMARY KEY,
    formateur_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    module_id     INTEGER REFERENCES modules(id) ON DELETE SET NULL,
    title         VARCHAR(200) NOT NULL,
    description   TEXT,
    meeting_link  VARCHAR(500) NOT NULL,
    status        VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED'
                  CHECK (status IN ('SCHEDULED', 'LIVE', 'ENDED')),
    scheduled_at  TIMESTAMPTZ,
    started_at    TIMESTAMPTZ,
    ended_at      TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_sessions_formateur ON live_sessions(formateur_id);
CREATE INDEX IF NOT EXISTS idx_live_sessions_status    ON live_sessions(status);
CREATE INDEX IF NOT EXISTS idx_live_sessions_module    ON live_sessions(module_id);
