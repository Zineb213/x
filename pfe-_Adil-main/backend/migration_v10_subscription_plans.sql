-- Migration v10: subscription plans for schools

CREATE TABLE IF NOT EXISTS subscription_plans (
    id SERIAL PRIMARY KEY,
    plan_name VARCHAR(100) NOT NULL UNIQUE,
    plan_type VARCHAR(20) NOT NULL,
    max_students INTEGER NOT NULL,
    max_formateurs INTEGER NOT NULL,
    ai_enabled BOOLEAN NOT NULL DEFAULT false,
    monthly_price NUMERIC(10,2) NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_plan_type CHECK (plan_type IN ('BASIC', 'STANDARD', 'PREMIUM'))
);

ALTER TABLE schools
    ADD COLUMN IF NOT EXISTS subscription_plan_id INTEGER REFERENCES subscription_plans(id) ON DELETE SET NULL;

INSERT INTO subscription_plans (plan_name, plan_type, max_students, max_formateurs, ai_enabled, monthly_price)
SELECT 'Edu Start 300', 'BASIC', 300, 25, false, 149.00
WHERE NOT EXISTS (SELECT 1 FROM subscription_plans WHERE plan_name = 'Edu Start 300');

INSERT INTO subscription_plans (plan_name, plan_type, max_students, max_formateurs, ai_enabled, monthly_price)
SELECT 'Edu Pro 500 IA', 'STANDARD', 500, 45, true, 299.00
WHERE NOT EXISTS (SELECT 1 FROM subscription_plans WHERE plan_name = 'Edu Pro 500 IA');

INSERT INTO subscription_plans (plan_name, plan_type, max_students, max_formateurs, ai_enabled, monthly_price)
SELECT 'Edu Elite 700 IA', 'PREMIUM', 700, 70, true, 449.00
WHERE NOT EXISTS (SELECT 1 FROM subscription_plans WHERE plan_name = 'Edu Elite 700 IA');

UPDATE schools s
SET subscription_plan_id = p.id
FROM subscription_plans p
WHERE s.subscription_plan_id IS NULL
  AND p.plan_name = 'Edu Start 300';

CREATE INDEX IF NOT EXISTS idx_schools_subscription_plan_id ON schools(subscription_plan_id);
