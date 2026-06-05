const { query } = require('../config/database');
const User = require('../models/User');
const { generateMatricule } = require('../utils/matriculeGenerator');
const { HTTP_STATUS, ROLES } = require('../config/constants');

const PAYMENT_STATUS = ['PAID', 'PENDING', 'OVERDUE'];
const PLAN_TYPES = ['BASIC', 'STANDARD', 'PREMIUM'];
const DEFAULT_PAYMENT_GRACE_DAYS = 10;

const enforceAutoSuspensions = async () => {
    await query(
        `UPDATE schools
         SET payment_status = 'OVERDUE'
         WHERE payment_status = 'PENDING'
           AND next_due_date IS NOT NULL
           AND next_due_date < CURRENT_DATE`
    );

    await query(
        `UPDATE schools
         SET is_active = false,
             suspended_reason = COALESCE(NULLIF(suspended_reason, ''), 'Suspension automatique: depassement de la tolerance de paiement'),
             suspended_at = COALESCE(suspended_at, CURRENT_TIMESTAMP)
         WHERE is_active = true
           AND (
                next_due_date IS NOT NULL
                AND payment_status <> 'PAID'
                AND (
                    CURRENT_DATE - next_due_date
                ) > COALESCE(payment_grace_days, $1)
           )`,
        [DEFAULT_PAYMENT_GRACE_DAYS]
    );
};

const parseBoolean = (value) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
        if (value.toLowerCase() === 'true') return true;
        if (value.toLowerCase() === 'false') return false;
    }
    return null;
};

const createSchool = async (req, res, next) => {
    try {
        const { name, code } = req.body;

        if (!name || !code) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: 'name and code are required'
            });
        }

        const result = await query(
            `INSERT INTO schools (name, code, subscription_plan_id)
             VALUES (
                $1,
                $2,
                (SELECT id FROM subscription_plans WHERE is_active = true ORDER BY max_students ASC LIMIT 1)
             )
             RETURNING id, name, code, is_active, payment_status, next_due_date, created_at`,
            [name.trim(), code.trim().toUpperCase()]
        );

        res.status(HTTP_STATUS.CREATED).json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        next(error);
    }
};

const getSchools = async (req, res, next) => {
    try {
        await enforceAutoSuspensions();

        const result = await query(
                `SELECT s.id, s.name, s.code, s.is_active, s.payment_status, s.next_due_date,
                    s.payment_grace_days, s.last_payment_at,
                    s.suspended_reason, s.suspended_at, s.created_at,
                    s.subscription_plan_id,
                    sp.plan_name,
                    sp.plan_type,
                    sp.max_students,
                    sp.max_formateurs,
                    sp.ai_enabled,
                    sp.monthly_price,
                    sp.billing_cycle_days,
                    CASE
                        WHEN s.payment_status = 'PAID' THEN 'Paiement confirme'
                        WHEN s.next_due_date IS NULL THEN 'Echeance non definie'
                        WHEN (s.next_due_date - CURRENT_DATE) >= 0 THEN 'Paiement en attente'
                        WHEN (CURRENT_DATE - s.next_due_date) <= COALESCE(s.payment_grace_days, $1) THEN 'Retard tolere'
                        ELSE 'Impaye critique'
                    END AS payment_status_label,
                    CASE
                        WHEN s.next_due_date IS NULL THEN NULL
                        ELSE (s.next_due_date - CURRENT_DATE)
                    END AS days_until_due,
                    CASE
                        WHEN s.next_due_date IS NULL THEN NULL
                        WHEN s.next_due_date >= CURRENT_DATE THEN COALESCE(s.payment_grace_days, $1)
                        ELSE (COALESCE(s.payment_grace_days, $1) - (CURRENT_DATE - s.next_due_date))
                    END AS grace_days_remaining,
                    COUNT(u.id) FILTER (WHERE u.role_global = 'ADMIN')::int as admin_count,
                    COUNT(u.id) FILTER (WHERE u.role_global = 'ETUDIANT')::int as student_count,
                    COUNT(u.id) FILTER (WHERE u.role_global IN ('FORMATEUR', 'FORMATEUR_SIMPLE'))::int as formateur_count
             FROM schools s
             LEFT JOIN users u ON u.school_id = s.id
             LEFT JOIN subscription_plans sp ON sp.id = s.subscription_plan_id
               GROUP BY s.id, s.name, s.code, s.is_active, s.payment_status, s.next_due_date, s.payment_grace_days, s.last_payment_at,
                      s.suspended_reason, s.suspended_at, s.created_at, s.subscription_plan_id,
                      sp.plan_name, sp.plan_type, sp.max_students, sp.max_formateurs, sp.ai_enabled, sp.monthly_price, sp.billing_cycle_days
               ORDER BY s.created_at DESC`,
              [DEFAULT_PAYMENT_GRACE_DAYS]
        );

        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        next(error);
    }
};

const getSubscriptionPlans = async (req, res, next) => {
    try {
        const result = await query(
            `SELECT id, plan_name, plan_type, max_students, max_formateurs, ai_enabled, monthly_price, billing_cycle_days, is_active, created_at
             FROM subscription_plans
             WHERE is_active = true
             ORDER BY max_students ASC, id ASC`
        );

        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        next(error);
    }
};

const createSubscriptionPlan = async (req, res, next) => {
    try {
        const {
            plan_name,
            plan_type = 'STANDARD',
            max_students,
            max_formateurs,
            ai_enabled = false,
            monthly_price,
            billing_cycle_days = 30
        } = req.body;

        if (!plan_name || !Number.isInteger(max_students) || !Number.isInteger(max_formateurs)) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: 'plan_name, max_students et max_formateurs sont obligatoires'
            });
        }

        if (!PLAN_TYPES.includes(plan_type)) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: `plan_type invalide. Valeurs: ${PLAN_TYPES.join(', ')}`
            });
        }

        if (!Number.isFinite(Number(monthly_price)) || Number(monthly_price) < 0) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: 'monthly_price invalide'
            });
        }

        if (!Number.isInteger(billing_cycle_days) || billing_cycle_days < 1) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: 'billing_cycle_days invalide'
            });
        }

        const result = await query(
            `INSERT INTO subscription_plans
             (plan_name, plan_type, max_students, max_formateurs, ai_enabled, monthly_price, billing_cycle_days, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7, true)
             RETURNING id, plan_name, plan_type, max_students, max_formateurs, ai_enabled, monthly_price, billing_cycle_days, is_active, created_at`,
            [
                plan_name.trim(),
                plan_type,
                max_students,
                max_formateurs,
                Boolean(ai_enabled),
                Number(monthly_price),
                billing_cycle_days
            ]
        );

        res.status(HTTP_STATUS.CREATED).json({
            success: true,
            data: result.rows[0],
            message: 'Plan d abonnement cree avec succes.'
        });
    } catch (error) {
        next(error);
    }
};

const assignSubscriptionToSchool = async (req, res, next) => {
    try {
        const { schoolId } = req.params;
        const { subscription_plan_id } = req.body;

        if (!Number.isInteger(subscription_plan_id)) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: 'subscription_plan_id must be an integer'
            });
        }

        const plan = await query(
            `SELECT id, plan_name, plan_type, max_students, max_formateurs, ai_enabled, monthly_price, billing_cycle_days
             FROM subscription_plans
             WHERE id = $1 AND is_active = true`,
            [subscription_plan_id]
        );
        if (plan.rows.length === 0) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                error: 'Subscription plan not found'
            });
        }

        const school = await query(
            `UPDATE schools
             SET subscription_plan_id = $1
             WHERE id = $2
             RETURNING id, name, code, subscription_plan_id`,
            [subscription_plan_id, schoolId]
        );
        if (school.rows.length === 0) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                error: 'School not found'
            });
        }

        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: {
                school: school.rows[0],
                subscription: plan.rows[0]
            },
            message: 'Abonnement ecole mis a jour.'
        });
    } catch (error) {
        next(error);
    }
};

const getOverview = async (req, res, next) => {
    try {
        await enforceAutoSuspensions();

        const [schoolsResult, usersResult, modulesResult, pendingRequestsResult, activeYearResult] = await Promise.all([
            query(
                `SELECT
                    COUNT(*)::int AS total_schools,
                    COUNT(*) FILTER (WHERE is_active = true)::int AS active_schools,
                    COUNT(*) FILTER (WHERE is_active = false)::int AS suspended_schools,
                                        COUNT(*) FILTER (
                                                WHERE next_due_date IS NOT NULL
                                                    AND payment_status <> 'PAID'
                                                    AND (CURRENT_DATE - next_due_date) > 0
                                                    AND (CURRENT_DATE - next_due_date) <= COALESCE(payment_grace_days, $1)
                                        )::int AS schools_in_grace,
                                        COUNT(*) FILTER (
                                                WHERE next_due_date IS NOT NULL
                                                    AND payment_status <> 'PAID'
                                                    AND (CURRENT_DATE - next_due_date) > COALESCE(payment_grace_days, $1)
                                        )::int AS schools_critical,
                                        COUNT(*) FILTER (WHERE payment_status = 'OVERDUE')::int AS overdue_schools
                 FROM schools`
                                [DEFAULT_PAYMENT_GRACE_DAYS]
            ),
            query(
                `SELECT
                    COUNT(*)::int AS total_users,
                    COUNT(*) FILTER (WHERE role_global = 'ADMIN')::int AS total_admins,
                    COUNT(*) FILTER (WHERE role_global IN ('FORMATEUR', 'FORMATEUR_SIMPLE'))::int AS total_formateurs,
                    COUNT(*) FILTER (WHERE role_global = 'ETUDIANT')::int AS total_students
                 FROM users
                 WHERE role_global <> 'SUPER_ADMIN'`
            ),
            query(`SELECT COUNT(*)::int AS total_modules FROM modules`),
            query(`SELECT COUNT(*)::int AS pending_registrations FROM student_registration_requests WHERE status = 'PENDING'`),
            query(`SELECT id, label, start_year, end_year FROM academic_years WHERE is_active = true ORDER BY id DESC LIMIT 1`)
        ]);

        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: {
                ...(schoolsResult.rows[0] || {}),
                ...(usersResult.rows[0] || {}),
                ...(modulesResult.rows[0] || {}),
                ...(pendingRequestsResult.rows[0] || {}),
                active_academic_year: activeYearResult.rows[0] || null
            }
        });
    } catch (error) {
        next(error);
    }
};

const getPaymentCalendar = async (req, res, next) => {
    try {
        await enforceAutoSuspensions();

        const result = await query(
            `SELECT
                s.id,
                s.name,
                s.code,
                s.payment_status,
                CASE
                    WHEN s.payment_status = 'PAID' THEN 'Paiement confirme'
                    WHEN s.next_due_date IS NULL THEN 'Echeance non definie'
                    WHEN (s.next_due_date - CURRENT_DATE) >= 0 THEN 'Paiement en attente'
                    WHEN (CURRENT_DATE - s.next_due_date) <= COALESCE(s.payment_grace_days, $1) THEN 'Retard tolere'
                    ELSE 'Impaye critique'
                END AS payment_status_label,
                s.next_due_date,
                CASE WHEN s.next_due_date IS NULL THEN NULL ELSE (s.next_due_date - CURRENT_DATE) END AS days_until_due,
                CASE
                    WHEN s.next_due_date IS NULL THEN NULL
                    WHEN s.next_due_date >= CURRENT_DATE THEN COALESCE(s.payment_grace_days, $1)
                    ELSE (COALESCE(s.payment_grace_days, $1) - (CURRENT_DATE - s.next_due_date))
                END AS grace_days_remaining,
                s.last_payment_at,
                s.payment_grace_days,
                s.is_active,
                sp.plan_name,
                sp.billing_cycle_days,
                sp.monthly_price
             FROM schools s
             LEFT JOIN subscription_plans sp ON sp.id = s.subscription_plan_id
             ORDER BY
                CASE WHEN s.next_due_date IS NULL THEN 1 ELSE 0 END,
                s.next_due_date ASC,
                s.name ASC`,
            [DEFAULT_PAYMENT_GRACE_DAYS]
        );

        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        next(error);
    }
};

const updateSchoolStatus = async (req, res, next) => {
    try {
        const { schoolId } = req.params;
        const { is_active, reason = null } = req.body;
        const parsedStatus = parseBoolean(is_active);

        if (parsedStatus === null) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: 'is_active must be a boolean'
            });
        }

        const result = await query(
            `UPDATE schools
             SET is_active = $1,
                 suspended_reason = CASE WHEN $1 = false THEN NULLIF($2, '') ELSE NULL END,
                 suspended_at = CASE WHEN $1 = false THEN CURRENT_TIMESTAMP ELSE NULL END
             WHERE id = $3
             RETURNING id, name, code, is_active, suspended_reason, suspended_at, payment_status, next_due_date`,
            [parsedStatus, reason, schoolId]
        );

        if (result.rows.length === 0) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                error: 'School not found'
            });
        }

        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: result.rows[0],
            message: parsedStatus ? 'Ecole reactivee.' : 'Ecole suspendue.'
        });
    } catch (error) {
        next(error);
    }
};

const updateSchoolPayment = async (req, res, next) => {
    try {
        const { schoolId } = req.params;
        const { payment_status, next_due_date = null } = req.body;
        const schoolIdInt = Number(schoolId);

        if (!Number.isInteger(schoolIdInt)) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: 'schoolId invalide'
            });
        }

        if (!payment_status || !PAYMENT_STATUS.includes(payment_status)) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: `payment_status must be one of: ${PAYMENT_STATUS.join(', ')}`
            });
        }

        const schoolResult = await query(
            `SELECT s.id, s.subscription_plan_id, sp.billing_cycle_days
             FROM schools s
             LEFT JOIN subscription_plans sp ON sp.id = s.subscription_plan_id
             WHERE s.id = $1::int`,
            [schoolIdInt]
        );

        if (schoolResult.rows.length === 0) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                error: 'School not found'
            });
        }

        const billingCycleDays = Number(schoolResult.rows[0].billing_cycle_days || 30);

        let computedDueDate = next_due_date || null;
        if (payment_status === 'PAID' && !computedDueDate) {
            const dueResult = await query(
                `SELECT (CURRENT_DATE + ($1::int || ' days')::interval)::date AS next_due_date`,
                [billingCycleDays]
            );
            computedDueDate = dueResult.rows[0].next_due_date;
        }

        const result = await query(
            `UPDATE schools
             SET payment_status = $1::varchar,
                 next_due_date = $2::date,
                 last_payment_at = CASE WHEN $1::varchar = 'PAID' THEN CURRENT_TIMESTAMP ELSE last_payment_at END
             WHERE id = $3::int
             RETURNING id, name, code, is_active, payment_status, next_due_date, payment_grace_days, last_payment_at, suspended_reason, suspended_at`,
            [payment_status, computedDueDate, schoolIdInt]
        );

        await enforceAutoSuspensions();

        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: result.rows[0],
            message: 'Statut de paiement mis a jour.'
        });
    } catch (error) {
        next(error);
    }
};

const getAcademicYears = async (req, res, next) => {
    try {
        const result = await query(
            `SELECT id, label, start_year, end_year, is_active, created_at
             FROM academic_years
             ORDER BY start_year DESC, id DESC`
        );

        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        next(error);
    }
};

const createAcademicYear = async (req, res, next) => {
    try {
        const { start_year, end_year, set_active = true } = req.body;

        if (!Number.isInteger(start_year) || !Number.isInteger(end_year) || end_year !== start_year + 1) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: 'start_year et end_year invalides (ex: 2026 et 2027)'
            });
        }

        const label = `${start_year}-${end_year}`;

        const result = await query(
            `INSERT INTO academic_years (label, start_year, end_year, is_active)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (label) DO UPDATE SET start_year = EXCLUDED.start_year, end_year = EXCLUDED.end_year
             RETURNING id, label, start_year, end_year, is_active, created_at`,
            [label, start_year, end_year, false]
        );

        if (set_active) {
            await query(`UPDATE academic_years SET is_active = false WHERE id <> $1`, [result.rows[0].id]);
            await query(`UPDATE academic_years SET is_active = true WHERE id = $1`, [result.rows[0].id]);
            result.rows[0].is_active = true;
        }

        res.status(HTTP_STATUS.CREATED).json({
            success: true,
            data: result.rows[0],
            message: 'Annee academique creee.'
        });
    } catch (error) {
        next(error);
    }
};

const activateAcademicYear = async (req, res, next) => {
    try {
        const { yearId } = req.params;

        const existing = await query(`SELECT id, label, start_year, end_year, is_active FROM academic_years WHERE id = $1`, [yearId]);
        if (existing.rows.length === 0) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                error: 'Academic year not found'
            });
        }

        await query(`UPDATE academic_years SET is_active = false WHERE id <> $1`, [yearId]);
        await query(`UPDATE academic_years SET is_active = true WHERE id = $1`, [yearId]);

        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: { ...existing.rows[0], is_active: true },
            message: 'Annee academique activee.'
        });
    } catch (error) {
        next(error);
    }
};

const createSchoolAdmin = async (req, res, next) => {
    try {
        const { schoolId } = req.params;
        const { email, nom, prenom, password } = req.body;

        if (!email || !nom || !prenom || !password) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: 'email, nom, prenom and password are required'
            });
        }

        if (password.length < 6) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: 'password must be at least 6 characters long'
            });
        }

        const schoolResult = await query(`SELECT id, name, code FROM schools WHERE id = $1`, [schoolId]);
        if (schoolResult.rows.length === 0) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                error: 'School not found'
            });
        }

        const existingUser = await User.findByEmail(email);
        if (existingUser) {
            return res.status(HTTP_STATUS.CONFLICT).json({
                success: false,
                error: 'Email already exists'
            });
        }

        const matricule = await generateMatricule();
        const hashedPassword = await User.hashPassword(password);

        const adminUser = await User.create({
            matricule,
            email,
            password_hash: hashedPassword,
            nom,
            prenom,
            role_global: ROLES.ADMIN,
            niveau: null,
            school_id: Number(schoolId)
        });

        res.status(HTTP_STATUS.CREATED).json({
            success: true,
            data: {
                ...adminUser,
                school: schoolResult.rows[0]
            },
            message: `Admin ecole cree. Matricule: ${adminUser.matricule}`
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createSchool,
    getSchools,
    createSchoolAdmin,
    getOverview,
    getSubscriptionPlans,
    createSubscriptionPlan,
    assignSubscriptionToSchool,
    getPaymentCalendar,
    updateSchoolStatus,
    updateSchoolPayment,
    getAcademicYears,
    createAcademicYear,
    activateAcademicYear
};
