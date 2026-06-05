-- Migration v11: configurable billing cycle for subscription plans

ALTER TABLE subscription_plans
    ADD COLUMN IF NOT EXISTS billing_cycle_days INTEGER NOT NULL DEFAULT 30;

UPDATE subscription_plans
SET billing_cycle_days = CASE
    WHEN plan_name = 'Edu Start 300' THEN 30
    WHEN plan_name = 'Edu Pro 500 IA' THEN 30
    WHEN plan_name = 'Edu Elite 700 IA' THEN 30
    ELSE billing_cycle_days
END
WHERE billing_cycle_days IS NOT NULL;
