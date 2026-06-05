-- Schéma PostgreSQL aligné avec UML + besoin métier actuel
-- 1 communauté globale (unique) + chat groupes distincts

BEGIN;

-- =========================================================
-- ENUMS
-- =========================================================
DO $$ BEGIN
    CREATE TYPE niveau_enum AS ENUM ('L1', 'L2', 'L3');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE session_enum AS ENUM ('Normale', 'Rattrapage');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE role_global_enum AS ENUM ('ADMIN_GLOBAL', 'MODERATEUR', 'USER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE role_type_enum AS ENUM ('ADMIN', 'MEMBRE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE activity_type_enum AS ENUM ('PUBLICATION', 'COMMENTAIRE', 'PARTAGE', 'MESSAGE', 'AUTRE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE activite_type_recente_enum AS ENUM ('COURS', 'TD', 'EXAMEN', 'AUTRE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE file_type_enum AS ENUM ('IMAGE', 'VIDEO', 'PDF', 'DOCUMENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE vote_type_enum AS ENUM ('UPVOTE', 'DOWNVOTE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE resource_type_enum AS ENUM ('COURS', 'TD', 'TP', 'EXAMEN', 'CORRIGE', 'PLAYLIST');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE chat_type_enum AS ENUM ('PRV', 'GRP');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================
-- UTILISATEURS / NOTIFICATIONS / ACTIVITÉS
-- =========================================================
CREATE TABLE IF NOT EXISTS app_user (
    id              BIGSERIAL PRIMARY KEY,
    username        VARCHAR(100) NOT NULL,
    email           VARCHAR(255) UNIQUE,
    password_hash   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    photo_url       TEXT,
    bio             TEXT,
    role_global     role_global_enum NOT NULL DEFAULT 'USER',

    -- utile pour le front actuel
    nom             VARCHAR(120),
    prenom          VARCHAR(120),
    matricule       VARCHAR(80) UNIQUE,
    full_name       VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS notification (
    id              BIGSERIAL PRIMARY KEY,
    destinataire_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    content         TEXT NOT NULL,
    source_type     VARCHAR(50),
    source_id       BIGINT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_read         BOOLEAN NOT NULL DEFAULT FALSE
);

-- =========================================================
-- PLANNER HEBDOMADAIRE PERSONNALISE (PAR ETUDIANT)
-- =========================================================
CREATE TABLE IF NOT EXISTS weekly_planner_config (
    user_id            BIGINT PRIMARY KEY REFERENCES app_user(id) ON DELETE CASCADE,
    block_size_hours   SMALLINT NOT NULL DEFAULT 1 CHECK (block_size_hours IN (1, 2, 3)),
    start_minutes      SMALLINT NOT NULL DEFAULT 480,
    end_minutes        SMALLINT NOT NULL DEFAULT 1200,
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_planner_time_window CHECK (end_minutes > start_minutes)
);

CREATE TABLE IF NOT EXISTS weekly_planner_entry (
    id                 BIGSERIAL PRIMARY KEY,
    user_id            BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    day_index          SMALLINT NOT NULL CHECK (day_index BETWEEN 0 AND 6),
    start_minutes      SMALLINT NOT NULL,
    end_minutes        SMALLINT NOT NULL,
    title              VARCHAR(180) NOT NULL,
    details            TEXT,
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_planner_entry_window CHECK (end_minutes > start_minutes),
    CONSTRAINT uq_planner_slot UNIQUE (user_id, day_index, start_minutes, end_minutes)
);

CREATE INDEX IF NOT EXISTS idx_planner_user_day
ON weekly_planner_entry(user_id, day_index, start_minutes);

CREATE TABLE IF NOT EXISTS activity (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    type            activity_type_enum NOT NULL,
    date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    description     TEXT,
    source_type     VARCHAR(50),
    source_id       BIGINT
);

-- =========================================================
-- MODÉRATION (Log des actions admin/modérateur)
-- =========================================================
CREATE TABLE IF NOT EXISTS moderation_log (
    id              BIGSERIAL PRIMARY KEY,
    moderator_id    BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    contenu_type    VARCHAR(50) NOT NULL,
    contenu_id      BIGINT NOT NULL,
    action          VARCHAR(50) NOT NULL,
    raison          TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_moderation_moderator
ON moderation_log(moderator_id, created_at DESC);

-- =========================================================
-- RESSOURCES PÉDAGOGIQUES
-- (single-table inheritance)
-- =========================================================
CREATE TABLE IF NOT EXISTS ressource_pedagogique (
    id_ressource        BIGSERIAL PRIMARY KEY,
    resource_type       resource_type_enum NOT NULL,

    titre               VARCHAR(255) NOT NULL,
    description         TEXT,
    date_ajout          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    niveau              niveau_enum NOT NULL,
    module              VARCHAR(120) NOT NULL,
    id_auteur           BIGINT REFERENCES app_user(id) ON DELETE SET NULL,

    fichier_pdf         TEXT,
    logo_url            TEXT,
    nombre_chapitres    INTEGER,
    numero_serie        INTEGER,
    annee               INTEGER,
    session             session_enum,
    id_examen           BIGINT,
    url_youtube         TEXT,
    correction_target   VARCHAR(20),
    nombre_videos       INTEGER,

    is_archived         BOOLEAN NOT NULL DEFAULT FALSE,

    CONSTRAINT fk_corrige_examen
        FOREIGN KEY (id_examen) REFERENCES ressource_pedagogique(id_ressource) ON DELETE SET NULL,

    CONSTRAINT ck_resource_non_negative CHECK (
        (nombre_chapitres IS NULL OR nombre_chapitres >= 0)
        AND (numero_serie IS NULL OR numero_serie >= 0)
        AND (nombre_videos IS NULL OR nombre_videos >= 0)
    ),

    CONSTRAINT ck_resource_type_fields CHECK (
        (resource_type <> 'COURS' OR nombre_chapitres IS NOT NULL)
        AND (resource_type <> 'TD' OR numero_serie IS NOT NULL)
        AND (resource_type <> 'EXAMEN' OR (annee IS NOT NULL AND session IS NOT NULL))
        AND (resource_type <> 'PLAYLIST' OR url_youtube IS NOT NULL)
        AND (correction_target IS NULL OR correction_target IN ('TD', 'TP', 'EXAMEN'))
        AND (resource_type = 'CORRIGE' OR id_examen IS NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_corrige_par_examen
ON ressource_pedagogique(id_examen)
WHERE resource_type = 'CORRIGE' AND id_examen IS NOT NULL;

CREATE TABLE IF NOT EXISTS module_catalog (
    id              BIGSERIAL PRIMARY KEY,
    nom             VARCHAR(120) NOT NULL,
    niveau          niveau_enum NOT NULL,
    description     TEXT,
    logo_url        TEXT,
    created_by      BIGINT REFERENCES app_user(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_module_catalog UNIQUE (nom, niveau)
);

CREATE INDEX IF NOT EXISTS idx_module_catalog_niveau_nom
ON module_catalog(niveau, nom);

CREATE TABLE IF NOT EXISTS activite_recente (
    id              BIGSERIAL PRIMARY KEY,
    type            activite_type_recente_enum NOT NULL,
    date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ressource       VARCHAR(255) NOT NULL,
    module          VARCHAR(120) NOT NULL,
    niveau          niveau_enum NOT NULL,
    id_admin        BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE
);

-- =========================================================
-- ATTRIBUTION RESSOURCES AUX MODÉRATEURS
-- =========================================================
CREATE TABLE IF NOT EXISTS ressource_moderator (
    id              BIGSERIAL PRIMARY KEY,
    moderator_id    BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    module          VARCHAR(120) NOT NULL,
    niveau          niveau_enum NOT NULL,
    assigned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    assigned_by     BIGINT NOT NULL REFERENCES app_user(id) ON DELETE RESTRICT,
    
    UNIQUE(moderator_id, module, niveau)
);

CREATE INDEX IF NOT EXISTS idx_ressource_moderator_mod
ON ressource_moderator(moderator_id, niveau);

-- =========================================================
-- COMMUNAUTÉ GLOBALE UNIQUE + SOCIAL
-- =========================================================
CREATE TABLE IF NOT EXISTS communaute (
    id              SMALLINT PRIMARY KEY,
    nom             VARCHAR(120) NOT NULL UNIQUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_communaute_unique CHECK (id = 1)
);

INSERT INTO communaute(id, nom)
VALUES (1, 'Communaute Globale')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS publication (
    id              BIGSERIAL PRIMARY KEY,
    communaute_id   SMALLINT NOT NULL DEFAULT 1 REFERENCES communaute(id) ON DELETE RESTRICT,
    auteur_id       BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    content         TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    report_count    INTEGER NOT NULL DEFAULT 0 CHECK (report_count >= 0),
    is_deleted      BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS attachment (
    id              BIGSERIAL PRIMARY KEY,
    publication_id  BIGINT NOT NULL REFERENCES publication(id) ON DELETE CASCADE,
    file_url        TEXT NOT NULL,
    file_type       file_type_enum NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS commentaire (
    id              BIGSERIAL PRIMARY KEY,
    publication_id  BIGINT NOT NULL REFERENCES publication(id) ON DELETE CASCADE,
    auteur_id       BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    content         TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    report_count    INTEGER NOT NULL DEFAULT 0 CHECK (report_count >= 0),
    is_deleted      BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS vote (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    publication_id  BIGINT REFERENCES publication(id) ON DELETE CASCADE,
    commentaire_id  BIGINT REFERENCES commentaire(id) ON DELETE CASCADE,
    type            vote_type_enum NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ck_vote_cible CHECK (
        (publication_id IS NOT NULL AND commentaire_id IS NULL)
        OR
        (publication_id IS NULL AND commentaire_id IS NOT NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_vote_publication_user
ON vote(user_id, publication_id)
WHERE publication_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_vote_commentaire_user
ON vote(user_id, commentaire_id)
WHERE commentaire_id IS NOT NULL;

-- Partage depuis social vers utilisateur ou chat groupe
CREATE TABLE IF NOT EXISTS partage (
    id                          BIGSERIAL PRIMARY KEY,
    publication_id              BIGINT NOT NULL REFERENCES publication(id) ON DELETE CASCADE,
    expediteur_id               BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    destinataire_user_id        BIGINT REFERENCES app_user(id) ON DELETE CASCADE,
    destinataire_chat_grp_id    BIGINT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ck_partage_destination CHECK (
        (destinataire_user_id IS NOT NULL AND destinataire_chat_grp_id IS NULL)
        OR
        (destinataire_user_id IS NULL AND destinataire_chat_grp_id IS NOT NULL)
    )
);

-- =========================================================
-- CHAT
-- =========================================================
CREATE TABLE IF NOT EXISTS chat (
    id              BIGSERIAL PRIMARY KEY,
    chat_type       chat_type_enum NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by      BIGINT REFERENCES app_user(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS chat_prv (
    chat_id         BIGINT PRIMARY KEY REFERENCES chat(id) ON DELETE CASCADE,
    user_a_id       BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    user_b_id       BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    CONSTRAINT ck_chat_prv_users_diff CHECK (user_a_id <> user_b_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_chat_prv_pair
ON chat_prv (LEAST(user_a_id, user_b_id), GREATEST(user_a_id, user_b_id));

-- Chat groupe = créé par un utilisateur (admin par défaut)
CREATE TABLE IF NOT EXISTS chat_grp (
    chat_id         BIGINT PRIMARY KEY REFERENCES chat(id) ON DELETE CASCADE,
    nom             VARCHAR(150) NOT NULL,
    created_by      BIGINT NOT NULL REFERENCES app_user(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS chat_grp_admin (
    chat_id         BIGINT NOT NULL REFERENCES chat_grp(chat_id) ON DELETE CASCADE,
    user_id         BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    PRIMARY KEY (chat_id, user_id)
);

CREATE TABLE IF NOT EXISTS chat_grp_membre (
    chat_id         BIGINT NOT NULL REFERENCES chat_grp(chat_id) ON DELETE CASCADE,
    user_id         BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (chat_id, user_id)
);

CREATE TABLE IF NOT EXISTS message (
    id              BIGSERIAL PRIMARY KEY,
    chat_id         BIGINT NOT NULL REFERENCES chat(id) ON DELETE CASCADE,
    auteur_id       BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    content         TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    report_count    INTEGER NOT NULL DEFAULT 0 CHECK (report_count >= 0),
    is_deleted      BOOLEAN NOT NULL DEFAULT FALSE
);

-- FK partage -> chat_grp (après création de chat_grp)
DO $$ BEGIN
    ALTER TABLE partage
        ADD CONSTRAINT fk_partage_chat_grp
        FOREIGN KEY (destinataire_chat_grp_id)
        REFERENCES chat_grp(chat_id)
        ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Trigger: créateur chat groupe devient admin + membre automatiquement
CREATE OR REPLACE FUNCTION fn_chat_grp_creator_default_roles()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO chat_grp_admin(chat_id, user_id)
    VALUES (NEW.chat_id, NEW.created_by)
    ON CONFLICT DO NOTHING;

    INSERT INTO chat_grp_membre(chat_id, user_id)
    VALUES (NEW.chat_id, NEW.created_by)
    ON CONFLICT DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_chat_grp_creator_default_roles ON chat_grp;
CREATE TRIGGER trg_chat_grp_creator_default_roles
AFTER INSERT ON chat_grp
FOR EACH ROW
EXECUTE FUNCTION fn_chat_grp_creator_default_roles();

-- =========================================================
-- FONCTIONS MÉTIER : VOTE / PARTAGE
-- =========================================================
CREATE OR REPLACE FUNCTION upvote_publication(p_publication_id BIGINT, p_user_id BIGINT)
RETURNS BIGINT AS $$
DECLARE v_id BIGINT;
BEGIN
    INSERT INTO vote(user_id, publication_id, type)
    VALUES (p_user_id, p_publication_id, 'UPVOTE')
    ON CONFLICT (user_id, publication_id)
    WHERE publication_id IS NOT NULL
    DO UPDATE SET type = EXCLUDED.type, created_at = NOW()
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION downvote_publication(p_publication_id BIGINT, p_user_id BIGINT)
RETURNS BIGINT AS $$
DECLARE v_id BIGINT;
BEGIN
    INSERT INTO vote(user_id, publication_id, type)
    VALUES (p_user_id, p_publication_id, 'DOWNVOTE')
    ON CONFLICT (user_id, publication_id)
    WHERE publication_id IS NOT NULL
    DO UPDATE SET type = EXCLUDED.type, created_at = NOW()
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION upvote_commentaire(p_commentaire_id BIGINT, p_user_id BIGINT)
RETURNS BIGINT AS $$
DECLARE v_id BIGINT;
BEGIN
    INSERT INTO vote(user_id, commentaire_id, type)
    VALUES (p_user_id, p_commentaire_id, 'UPVOTE')
    ON CONFLICT (user_id, commentaire_id)
    WHERE commentaire_id IS NOT NULL
    DO UPDATE SET type = EXCLUDED.type, created_at = NOW()
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION downvote_commentaire(p_commentaire_id BIGINT, p_user_id BIGINT)
RETURNS BIGINT AS $$
DECLARE v_id BIGINT;
BEGIN
    INSERT INTO vote(user_id, commentaire_id, type)
    VALUES (p_user_id, p_commentaire_id, 'DOWNVOTE')
    ON CONFLICT (user_id, commentaire_id)
    WHERE commentaire_id IS NOT NULL
    DO UPDATE SET type = EXCLUDED.type, created_at = NOW()
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION annuler_vote(p_cible_type TEXT, p_cible_id BIGINT, p_user_id BIGINT)
RETURNS INTEGER AS $$
DECLARE v_deleted INTEGER;
BEGIN
    IF LOWER(p_cible_type) = 'publication' THEN
        DELETE FROM vote WHERE user_id = p_user_id AND publication_id = p_cible_id;
    ELSIF LOWER(p_cible_type) = 'commentaire' THEN
        DELETE FROM vote WHERE user_id = p_user_id AND commentaire_id = p_cible_id;
    ELSE
        RAISE EXCEPTION 'cible_type invalide: %, attendu publication|commentaire', p_cible_type;
    END IF;

    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION partager_vers_user(
    p_publication_id BIGINT,
    p_expediteur_id BIGINT,
    p_destinataire_user_id BIGINT
) RETURNS BIGINT AS $$
DECLARE v_id BIGINT;
BEGIN
    INSERT INTO partage(publication_id, expediteur_id, destinataire_user_id)
    VALUES (p_publication_id, p_expediteur_id, p_destinataire_user_id)
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION partager_vers_chatgroupe(
    p_publication_id BIGINT,
    p_expediteur_id BIGINT,
    p_destinataire_chat_grp_id BIGINT
) RETURNS BIGINT AS $$
DECLARE v_id BIGINT;
BEGIN
    INSERT INTO partage(publication_id, expediteur_id, destinataire_chat_grp_id)
    VALUES (p_publication_id, p_expediteur_id, p_destinataire_chat_grp_id)
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Alias conservé (si vous utilisez encore l'ancien nom côté app)
CREATE OR REPLACE FUNCTION partager_vers_groupe(
    p_publication_id BIGINT,
    p_expediteur_id BIGINT,
    p_destinataire_chat_grp_id BIGINT
) RETURNS BIGINT AS $$
BEGIN
    RETURN partager_vers_chatgroupe(p_publication_id, p_expediteur_id, p_destinataire_chat_grp_id);
END;
$$ LANGUAGE plpgsql;

-- =========================================================
-- INDEXES
-- =========================================================
CREATE INDEX IF NOT EXISTS idx_notification_destinataire ON notification(destinataire_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_user_date         ON activity(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_ressource_niveau_module    ON ressource_pedagogique(niveau, module);
CREATE INDEX IF NOT EXISTS idx_publication_comm_date      ON publication(communaute_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_publication_auteur_date    ON publication(auteur_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_commentaire_publication    ON commentaire(publication_id, created_at);
CREATE INDEX IF NOT EXISTS idx_partage_publication        ON partage(publication_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_chat_date          ON message(chat_id, created_at);

COMMIT;

-- Notes métier:
-- 1) Communauté unique: table communaute avec id=1.
-- 2) Tous les membres peuvent publier/commenter/voter dans cette communauté globale.
-- 3) Chat groupe séparé: créé par un utilisateur, admin+member par défaut via trigger.
-- 4) Suppression publication/commentaire/message par auteur OU ADMIN_GLOBAL: à contrôler côté service.
