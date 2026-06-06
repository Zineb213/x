-- =============================================
-- MIGRATION SCRIPT: ADD NEW FEATURES TO EXISTING DATABASE
-- This script ONLY ADDS new tables and columns
-- NO DATA WILL BE LOST
-- Run with: sudo -u postgres psql -d eduplatform -f migrate_to_v2.sql
-- =============================================

-- =============================================
-- NEW ENUM TYPES
-- =============================================

DO $$ BEGIN
    CREATE TYPE community_role AS ENUM ('MEMBER', 'MODERATOR', 'ADMIN');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE progress_status AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE action_type AS ENUM ('COMPLETE_RESOURCE', 'COMPLETE_MODULE', 'JOIN_COMMUNITY', 'POST_COMMUNITY', 'DAILY_LOGIN');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- =============================================
-- 1. CATEGORIES TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    slug VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    icon VARCHAR(100),
    color VARCHAR(20),
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- 2. COMMUNITIES TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS communities (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    category_id INT REFERENCES categories(id) ON DELETE SET NULL,
    image_url VARCHAR(500),
    banner_url VARCHAR(500),
    member_count INT DEFAULT 0,
    resource_count INT DEFAULT 0,
    post_count INT DEFAULT 0,
    created_by INT REFERENCES users(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- 3. COMMUNITY_MEMBERS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS community_members (
    id SERIAL PRIMARY KEY,
    community_id INT NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role community_role DEFAULT 'MEMBER',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(community_id, user_id)
);

-- =============================================
-- 4. STUDENT_PROGRESS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS student_progress (
    id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    module_id INT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    resource_id INT NOT NULL REFERENCES ressource_pedagogique(id) ON DELETE CASCADE,
    status progress_status DEFAULT 'NOT_STARTED',
    progress_percent INT DEFAULT 0,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    time_spent INT DEFAULT 0,
    UNIQUE(student_id, module_id, resource_id)
);

-- =============================================
-- 5. STUDENT_LEVELS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS student_levels (
    id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    current_level INT DEFAULT 1,
    total_xp INT DEFAULT 0,
    resources_completed INT DEFAULT 0,
    modules_completed INT DEFAULT 0,
    current_streak INT DEFAULT 0,
    longest_streak INT DEFAULT 0,
    last_activity_date DATE,
    UNIQUE(student_id)
);

-- =============================================
-- 6. XP_RULES TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS xp_rules (
    id SERIAL PRIMARY KEY,
    action_type action_type UNIQUE NOT NULL,
    xp_points INT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE
);

-- =============================================
-- 7. BADGES TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS badges (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(100),
    xp_required INT,
    modules_completed_required INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- 8. STUDENT_BADGES TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS student_badges (
    id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    badge_id INT NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
    earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, badge_id)
);

-- =============================================
-- 9. NOTIFICATIONS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    link VARCHAR(500),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- ADD NEW COLUMNS TO EXISTING TABLES
-- =============================================

-- Add columns to modules
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='modules' AND column_name='components') THEN
        ALTER TABLE modules ADD COLUMN components text[] DEFAULT ARRAY['Cours', 'TD', 'TP'];
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='modules' AND column_name='category_id') THEN
        ALTER TABLE modules ADD COLUMN category_id INT REFERENCES categories(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='modules' AND column_name='xp_reward') THEN
        ALTER TABLE modules ADD COLUMN xp_reward INT DEFAULT 50;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='modules' AND column_name='display_order') THEN
        ALTER TABLE modules ADD COLUMN display_order INT DEFAULT 0;
    END IF;
END $$;

-- Add columns to users
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='total_xp') THEN
        ALTER TABLE users ADD COLUMN total_xp INT DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='current_level') THEN
        ALTER TABLE users ADD COLUMN current_level INT DEFAULT 1;
    END IF;
END $$;

-- Add columns to conversations
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='conversations' AND column_name='community_id') THEN
        ALTER TABLE conversations ADD COLUMN community_id INT REFERENCES communities(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='conversations' AND column_name='is_community_chat') THEN
        ALTER TABLE conversations ADD COLUMN is_community_chat BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Add read_by to messages
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='read_by') THEN
        ALTER TABLE messages ADD COLUMN read_by JSONB DEFAULT '[]';
    END IF;
END $$;

-- =============================================
-- ADD CONVERSATION TYPE 'COMMUNITY' TO EXISTING ENUM
-- =============================================

DO $$ 
BEGIN
    ALTER TYPE conversation_type ADD VALUE IF NOT EXISTS 'COMMUNITY';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- =============================================
-- INDEXES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_communities_category ON communities(category_id);
CREATE INDEX IF NOT EXISTS idx_communities_slug ON communities(slug);
CREATE INDEX IF NOT EXISTS idx_community_members_user ON community_members(user_id);
CREATE INDEX IF NOT EXISTS idx_community_members_community ON community_members(community_id);
CREATE INDEX IF NOT EXISTS idx_modules_category ON modules(category_id);
CREATE INDEX IF NOT EXISTS idx_student_progress_student ON student_progress(student_id);
CREATE INDEX IF NOT EXISTS idx_student_progress_module ON student_progress(module_id);
CREATE INDEX IF NOT EXISTS idx_student_progress_status ON student_progress(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_community ON conversations(community_id);

-- =============================================
-- INSERT INITIAL DATA (Only if empty)
-- =============================================

-- Insert Categories
INSERT INTO categories (name, slug, description, icon, color, display_order)
SELECT * FROM (VALUES
    ('Python', 'python', 'Développement Python - De débutant à expert', 'fab fa-python', '#3776AB', 1),
    ('PHP', 'php', 'Développement PHP - Sites web dynamiques', 'fab fa-php', '#777BB4', 2),
    ('Node.js', 'nodejs', 'Node.js - JavaScript côté serveur', 'fab fa-node-js', '#339933', 3),
    ('React.js', 'reactjs', 'React.js - Interfaces utilisateur modernes', 'fab fa-react', '#61DAFB', 4)
) AS v(name, slug, description, icon, color, display_order)
WHERE NOT EXISTS (SELECT 1 FROM categories LIMIT 1);

-- Insert XP Rules
INSERT INTO xp_rules (action_type, xp_points, description)
SELECT * FROM (VALUES
    ('COMPLETE_RESOURCE', 10, 'Compléter une ressource (cours, TD, TP, examen)'),
    ('COMPLETE_MODULE', 100, 'Terminer tous les ressources d un module'),
    ('JOIN_COMMUNITY', 5, 'Rejoindre une nouvelle communauté'),
    ('POST_COMMUNITY', 2, 'Publier dans une communauté'),
    ('DAILY_LOGIN', 1, 'Connexion quotidienne')
) AS v(action_type, xp_points, description)
WHERE NOT EXISTS (SELECT 1 FROM xp_rules LIMIT 1)
ON CONFLICT (action_type) DO NOTHING;

-- Insert Badges
INSERT INTO badges (name, description, icon, xp_required, modules_completed_required)
SELECT * FROM (VALUES
    ('🌟 Débutant', 'Premier pas sur la plateforme', '🌟', 0, 0),
    ('📚 Apprenti', '50 XP gagnés', '📚', 50, 0),
    ('🎓 Élève', '100 XP gagnés', '🎓', 100, 0),
    ('⚡ Intermédiaire', '300 XP gagnés', '⚡', 300, 0),
    ('🔥 Avancé', '600 XP gagnés', '🔥', 600, 0),
    ('🏆 Expert', '1000 XP gagnés', '🏆', 1000, 0),
    ('💪 Maître', '3 modules complétés', '💪', 0, 3),
    ('👑 Virtuose', '5 modules complétés', '👑', 0, 5)
) AS v(name, description, icon, xp_required, modules_completed_required)
WHERE NOT EXISTS (SELECT 1 FROM badges LIMIT 1);

-- Insert Communities
INSERT INTO communities (name, slug, description, category_id)
SELECT * FROM (VALUES
    ('Python Community', 'python-community', 'Rejoignez la communauté Python pour apprendre ensemble, poser des questions et partager vos projets', 1),
    ('PHP Community', 'php-community', 'Communauté PHP - Développeurs PHP de tous niveaux', 2),
    ('Node.js Community', 'nodejs-community', 'Communauté Node.js - JavaScript everywhere!', 3),
    ('React.js Community', 'reactjs-community', 'Communauté React.js - Construisez des UIs modernes', 4)
) AS v(name, slug, description, category_id)
WHERE NOT EXISTS (SELECT 1 FROM communities LIMIT 1)
ON CONFLICT (slug) DO NOTHING;

-- =============================================
-- VERIFICATION
-- =============================================

SELECT '═══════════════════════════════════════════════════════════════' as "";
SELECT '     MIGRATION COMPLETED SUCCESSFULLY!                          ' as "";
SELECT '═══════════════════════════════════════════════════════════════' as "";

SELECT 'New Tables Added:' as "";
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('categories', 'communities', 'community_members', 'student_progress', 'student_levels', 'xp_rules', 'badges', 'student_badges', 'notifications')
ORDER BY table_name;

SELECT 'Total tables now:' as "";
SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';

SELECT '═══════════════════════════════════════════════════════════════' as "";
SELECT '✅ Migration complete! Your database is now upgraded!' as "";
SELECT '═══════════════════════════════════════════════════════════════' as "";
