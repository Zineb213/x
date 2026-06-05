import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import '../admin/AdminPages.css';
import '../admin/AdminDashboard.css';

const PAYMENT_OPTIONS = [
    { value: 'PAID', label: 'Paiement confirmé' },
    { value: 'PENDING', label: 'Paiement en attente' },
    { value: 'OVERDUE', label: 'Paiement en retard' }
];
const PLAN_TYPE_OPTIONS = ['BASIC', 'STANDARD', 'PREMIUM'];

const SuperAdminDashboard = () => {
    const [overview, setOverview] = useState(null);
    const [schools, setSchools] = useState([]);
    const [subscriptionPlans, setSubscriptionPlans] = useState([]);
    const [paymentCalendar, setPaymentCalendar] = useState([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState({ type: '', text: '' });

    const [schoolForm, setSchoolForm] = useState({ name: '', code: '' });
    const [adminForms, setAdminForms] = useState({});
    const [paymentForms, setPaymentForms] = useState({});
    const [planForms, setPlanForms] = useState({});
    const [planCreateForm, setPlanCreateForm] = useState({
        plan_name: '',
        plan_type: 'STANDARD',
        max_students: '',
        max_formateurs: '',
        ai_enabled: false,
        monthly_price: '',
        billing_cycle_days: 30
    });

    const fetchData = async () => {
        try {
            const [overviewRes, schoolsRes, plansRes, paymentCalendarRes] = await Promise.all([
                api.get('/super-admin/overview'),
                api.get('/super-admin/schools'),
                api.get('/super-admin/subscription-plans'),
                api.get('/super-admin/payment-calendar')
            ]);

            if (overviewRes.data.success) {
                setOverview(overviewRes.data.data);
            }
            if (schoolsRes.data.success) {
                setSchools(schoolsRes.data.data);
            }
            if (plansRes.data.success) {
                setSubscriptionPlans(plansRes.data.data);
            }
            if (paymentCalendarRes.data.success) {
                setPaymentCalendar(paymentCalendarRes.data.data);
            }
        } catch (error) {
            setMessage({ type: 'error', text: error.response?.data?.error || 'Erreur lors du chargement des donnees super admin' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleCreateSchool = async (e) => {
        e.preventDefault();
        setMessage({ type: '', text: '' });

        if (!schoolForm.name || !schoolForm.code) {
            setMessage({ type: 'error', text: 'Le nom et le code de l école sont obligatoires.' });
            return;
        }

        try {
            const payload = { name: schoolForm.name.trim(), code: schoolForm.code.trim().toUpperCase() };
            const response = await api.post('/super-admin/schools', payload);
            if (response.data.success) {
                setSchoolForm({ name: '', code: '' });
                setMessage({ type: 'success', text: 'Ecole créée avec succès.' });
                await fetchData();
            }
        } catch (error) {
            setMessage({ type: 'error', text: error.response?.data?.error || 'Impossible de créer l école' });
        }
    };

    const handleAdminFormChange = (schoolId, field, value) => {
        setAdminForms((prev) => ({
            ...prev,
            [schoolId]: {
                ...(prev[schoolId] || { email: '', nom: '', prenom: '', password: '' }),
                [field]: value
            }
        }));
    };

    const handleCreateSchoolAdmin = async (schoolId) => {
        const form = adminForms[schoolId] || {};
        if (!form.email || !form.nom || !form.prenom || !form.password) {
            setMessage({ type: 'error', text: 'Tous les champs admin école sont obligatoires.' });
            return;
        }

        if (form.password.length < 6) {
            setMessage({ type: 'error', text: 'Le mot de passe doit contenir au moins 6 caractères.' });
            return;
        }

        try {
            const response = await api.post(`/super-admin/schools/${schoolId}/admins`, {
                email: form.email.trim(),
                nom: form.nom.trim(),
                prenom: form.prenom.trim(),
                password: form.password
            });

            if (response.data.success) {
                const matricule = response.data.data?.matricule;
                setMessage({
                    type: 'success',
                    text: matricule
                        ? `Admin école créé. Matricule: ${matricule}`
                        : 'Admin école créé avec succès.'
                });
                setAdminForms((prev) => ({
                    ...prev,
                    [schoolId]: { email: '', nom: '', prenom: '', password: '' }
                }));
                await fetchData();
            }
        } catch (error) {
            setMessage({ type: 'error', text: error.response?.data?.error || 'Erreur lors de la création de l admin école' });
        }
    };

    const handlePaymentFormChange = (schoolId, field, value) => {
        setPaymentForms((prev) => ({
            ...prev,
            [schoolId]: {
                ...(prev[schoolId] || { payment_status: 'PENDING', next_due_date: '' }),
                [field]: value
            }
        }));
    };

    const handleUpdatePayment = async (schoolId) => {
        const currentSchool = schools.find((s) => s.id === schoolId);
        const form = paymentForms[schoolId] || {
            payment_status: currentSchool?.payment_status || 'PENDING',
            next_due_date: currentSchool?.next_due_date || ''
        };

        try {
            const response = await api.patch(`/super-admin/schools/${schoolId}/payment`, {
                payment_status: form.payment_status,
                next_due_date: form.next_due_date || null
            });

            if (response.data.success) {
                setMessage({ type: 'success', text: 'Paiement mis a jour avec succes.' });
                await fetchData();
            }
        } catch (error) {
            setMessage({ type: 'error', text: error.response?.data?.error || 'Erreur lors de la mise a jour paiement' });
        }
    };

    const handleCreatePlan = async (e) => {
        e.preventDefault();

        const payload = {
            plan_name: planCreateForm.plan_name.trim(),
            plan_type: planCreateForm.plan_type,
            max_students: Number(planCreateForm.max_students),
            max_formateurs: Number(planCreateForm.max_formateurs),
            ai_enabled: Boolean(planCreateForm.ai_enabled),
            monthly_price: Number(planCreateForm.monthly_price),
            billing_cycle_days: Number(planCreateForm.billing_cycle_days)
        };

        if (!payload.plan_name || !Number.isInteger(payload.max_students) || !Number.isInteger(payload.max_formateurs)) {
            setMessage({ type: 'error', text: 'Nom, max étudiants et max formateurs sont obligatoires.' });
            return;
        }

        if (!Number.isFinite(payload.monthly_price) || payload.monthly_price < 0) {
            setMessage({ type: 'error', text: 'Prix mensuel invalide.' });
            return;
        }

        if (!Number.isInteger(payload.billing_cycle_days) || payload.billing_cycle_days < 1) {
            setMessage({ type: 'error', text: 'Cycle de paiement invalide.' });
            return;
        }

        try {
            const response = await api.post('/super-admin/subscription-plans', payload);
            if (response.data.success) {
                setMessage({ type: 'success', text: 'Nouveau plan abonnement créé.' });
                setPlanCreateForm({
                    plan_name: '',
                    plan_type: 'STANDARD',
                    max_students: '',
                    max_formateurs: '',
                    ai_enabled: false,
                    monthly_price: '',
                    billing_cycle_days: 30
                });
                await fetchData();
            }
        } catch (error) {
            setMessage({ type: 'error', text: error.response?.data?.error || 'Erreur creation plan abonnement' });
        }
    };

    const handlePlanFormChange = (schoolId, value) => {
        setPlanForms((prev) => ({ ...prev, [schoolId]: value }));
    };

    const handleAssignPlan = async (schoolId) => {
        const school = schools.find((s) => s.id === schoolId);
        const selectedPlanId = Number(planForms[schoolId] || school?.subscription_plan_id || 0);

        if (!Number.isInteger(selectedPlanId) || selectedPlanId <= 0) {
            setMessage({ type: 'error', text: 'Selectionner un abonnement valide.' });
            return;
        }

        try {
            const response = await api.patch(`/super-admin/schools/${schoolId}/subscription`, {
                subscription_plan_id: selectedPlanId
            });

            if (response.data.success) {
                setMessage({ type: 'success', text: 'Abonnement de l ecole mis a jour.' });
                await fetchData();
            }
        } catch (error) {
            setMessage({ type: 'error', text: error.response?.data?.error || 'Erreur lors de la mise a jour abonnement' });
        }
    };

    const handleReactivateSchool = async (schoolId) => {
        try {
            const response = await api.patch(`/super-admin/schools/${schoolId}/status`, {
                is_active: true,
                reason: null
            });

            if (response.data.success) {
                setMessage({
                    type: 'success',
                    text: 'Ecole reactivee manuellement.'
                });
                await fetchData();
            }
        } catch (error) {
            setMessage({ type: 'error', text: error.response?.data?.error || 'Erreur reactivation ecole' });
        }
    };

    if (loading) {
        return <div className="loading-text">Chargement du cockpit Super Admin...</div>;
    }

    return (
        <div className="admin-page fade-in">
            <div className="page-header">
                <h1>Super Admin - Plateforme</h1>
                <p>Cockpit global: ecoles, abonnements, paiement et suspension</p>
            </div>

            <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
                <div className="stat-card">
                    <h3>{overview?.total_schools || 0}</h3>
                    <p>Ecoles total</p>
                </div>
                <div className="stat-card">
                    <h3>{overview?.active_schools || 0}</h3>
                    <p>Ecoles actives</p>
                </div>
                <div className="stat-card">
                    <h3>{overview?.suspended_schools || 0}</h3>
                    <p>Ecoles suspendues</p>
                </div>
                <div className="stat-card">
                    <h3>{overview?.schools_in_grace || 0}</h3>
                    <p>Ecoles en retard toléré</p>
                </div>
                <div className="stat-card">
                    <h3>{overview?.schools_critical || 0}</h3>
                    <p>Ecoles impayées critiques</p>
                </div>
                <div className="stat-card">
                    <h3>{overview?.total_students || 0}</h3>
                    <p>Etudiants plateforme</p>
                </div>
                <div className="stat-card">
                    <h3>{overview?.total_formateurs || 0}</h3>
                    <p>Formateurs plateforme</p>
                </div>
                <div className="stat-card">
                    <h3>{overview?.pending_registrations || 0}</h3>
                    <p>Inscriptions en attente</p>
                </div>
            </div>

            <div className="table-container" style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ marginBottom: '1rem' }}>Types d abonnements</h3>
                <form onSubmit={handleCreatePlan} style={{ marginBottom: '1rem' }}>
                    <div className="form-row">
                        <div className="form-group">
                            <label>Nom du plan</label>
                            <input
                                className="form-input"
                                value={planCreateForm.plan_name}
                                onChange={(e) => setPlanCreateForm({ ...planCreateForm, plan_name: e.target.value })}
                                placeholder="Ex: Campus 900 IA"
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Type</label>
                            <select
                                className="form-input"
                                value={planCreateForm.plan_type}
                                onChange={(e) => setPlanCreateForm({ ...planCreateForm, plan_type: e.target.value })}
                            >
                                {PLAN_TYPE_OPTIONS.map((opt) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Max étudiants</label>
                            <input
                                type="number"
                                className="form-input"
                                value={planCreateForm.max_students}
                                onChange={(e) => setPlanCreateForm({ ...planCreateForm, max_students: e.target.value })}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Max formateurs</label>
                            <input
                                type="number"
                                className="form-input"
                                value={planCreateForm.max_formateurs}
                                onChange={(e) => setPlanCreateForm({ ...planCreateForm, max_formateurs: e.target.value })}
                                required
                            />
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label>Prix mensuel</label>
                            <input
                                type="number"
                                step="0.01"
                                className="form-input"
                                value={planCreateForm.monthly_price}
                                onChange={(e) => setPlanCreateForm({ ...planCreateForm, monthly_price: e.target.value })}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Cycle paiement (jours)</label>
                            <input
                                type="number"
                                className="form-input"
                                value={planCreateForm.billing_cycle_days}
                                onChange={(e) => setPlanCreateForm({ ...planCreateForm, billing_cycle_days: e.target.value })}
                                required
                            />
                        </div>
                        <div className="form-group ai-toggle">
                            <label className="ai-label">
                                <input
                                    type="checkbox"
                                    className="ai-checkbox"
                                    checked={planCreateForm.ai_enabled}
                                    onChange={(e) => setPlanCreateForm({ ...planCreateForm, ai_enabled: e.target.checked })}
                                />
                                IA incluse
                            </label>
                        </div>
                    </div>
                    <button type="submit" className="btn-primary">Créer abonnement</button>
                </form>

                {subscriptionPlans.length === 0 ? (
                    <p>Aucun abonnement disponible.</p>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Nom</th>
                                <th>Type</th>
                                <th>Limite étudiants</th>
                                <th>Limite formateurs</th>
                                <th>IA</th>
                                <th>Prix mensuel</th>
                                <th>Cycle paiement</th>
                            </tr>
                        </thead>
                        <tbody>
                            {subscriptionPlans.map((plan) => (
                                <tr key={plan.id}>
                                    <td><strong>{plan.plan_name}</strong></td>
                                    <td>{plan.plan_type}</td>
                                    <td>{plan.max_students}</td>
                                    <td>{plan.max_formateurs}</td>
                                    <td>{plan.ai_enabled ? 'Oui' : 'Non'}</td>
                                    <td>{Number(plan.monthly_price || 0).toFixed(2)} / mois</td>
                                    <td>Tous les {plan.billing_cycle_days || 30} jours</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <div className="table-container" style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ marginBottom: '0.4rem' }}>Calendrier de paiement</h3>
                <p style={{ margin: '0 0 1rem 0', color: '#6b7280' }}>
                    Tolérance: {paymentCalendar[0]?.payment_grace_days ?? 10} jours après l échéance. Au-delà, suspension automatique.
                </p>

                {paymentCalendar.length === 0 ? (
                    <p>Aucune donnée de calendrier.</p>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Ecole</th>
                                <th>Plan</th>
                                <th>Statut paiement</th>
                                <th>Prochaine échéance</th>
                                <th>Jours restants</th>
                                <th>Tolérance restante</th>
                                <th>Dernier paiement</th>
                                <th>Etat école</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paymentCalendar.map((item) => (
                                <tr key={item.id}>
                                    <td>{item.name} ({item.code})</td>
                                    <td>{item.plan_name || 'Aucun plan'}</td>
                                    <td>{item.payment_status_label || item.payment_status}</td>
                                    <td>{item.next_due_date ? String(item.next_due_date).slice(0, 10) : 'Non défini'}</td>
                                    <td>
                                        {item.days_until_due === null || item.days_until_due === undefined
                                            ? 'Non défini'
                                            : Number(item.days_until_due) < 0
                                                ? `Retard ${Math.abs(Number(item.days_until_due))} j`
                                                : `${item.days_until_due} j`}
                                    </td>
                                    <td>
                                        {item.grace_days_remaining === null || item.grace_days_remaining === undefined
                                            ? 'N/A'
                                            : Number(item.grace_days_remaining) < 0
                                                ? `Depassee de ${Math.abs(Number(item.grace_days_remaining))} j`
                                                : `${item.grace_days_remaining} j`}
                                    </td>
                                    <td>{item.last_payment_at ? String(item.last_payment_at).slice(0, 10) : 'Non enregistré'}</td>
                                    <td>{item.is_active ? 'Active' : 'Suspendue'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {message.text && (
                <div className={`alert alert-${message.type}`}>
                    {message.text}
                </div>
            )}

            <div className="table-container" style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ marginBottom: '1rem' }}>Créer une école</h3>
                <form onSubmit={handleCreateSchool}>
                    <div className="form-row">
                        <div className="form-group">
                            <label>Nom école</label>
                            <input
                                type="text"
                                className="form-input"
                                value={schoolForm.name}
                                onChange={(e) => setSchoolForm({ ...schoolForm, name: e.target.value })}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Code école</label>
                            <input
                                type="text"
                                className="form-input"
                                value={schoolForm.code}
                                onChange={(e) => setSchoolForm({ ...schoolForm, code: e.target.value.toUpperCase() })}
                                required
                            />
                        </div>
                    </div>
                    <button type="submit" className="btn-primary">Créer école</button>
                </form>
            </div>

            <div className="table-container">
                <h3 style={{ marginBottom: '0.4rem' }}>Écoles</h3>
                <p style={{ margin: '0 0 1rem 0', color: '#6b7280' }}>
                    Vue simplifiée: abonnement actuel, capacité utilisée, paiement compréhensible, réactivation manuelle.
                </p>
                {schools.length === 0 ? (
                    <p>Aucune école.</p>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Nom</th>
                                <th>Etat</th>
                                <th>Abonnement</th>
                                <th>Capacité</th>
                                <th>Paiement</th>
                                <th>Equipe</th>
                                <th>Réactivation</th>
                                <th>Créer admin école</th>
                            </tr>
                        </thead>
                        <tbody>
                            {schools.map((school) => {
                                const form = adminForms[school.id] || { email: '', nom: '', prenom: '', password: '' };
                                const paymentForm = paymentForms[school.id] || {
                                    payment_status: school.payment_status || 'PENDING',
                                    next_due_date: school.next_due_date ? String(school.next_due_date).slice(0, 10) : ''
                                };
                                const selectedPlanId = Number(planForms[school.id] || school.subscription_plan_id || 0);
                                return (
                                    <tr key={school.id}>
                                        <td>{school.id}</td>
                                        <td>
                                            <strong>{school.name}</strong>
                                            <div style={{ fontSize: '12px', color: '#6b7280' }}>Code: {school.code}</div>
                                        </td>
                                        <td>{school.is_active ? 'Actif' : 'Suspendu'}</td>
                                        <td>
                                            <div style={{ display: 'grid', gap: '6px' }}>
                                                <small style={{ color: '#374151' }}>
                                                    Actuel: <strong>{school.plan_name || 'Aucun plan'}</strong>
                                                </small>
                                                <select
                                                    className="form-input"
                                                    value={selectedPlanId || ''}
                                                    onChange={(e) => handlePlanFormChange(school.id, e.target.value)}
                                                >
                                                    <option value="">Choisir abonnement</option>
                                                    {subscriptionPlans.map((plan) => (
                                                        <option key={plan.id} value={plan.id}>
                                                            {plan.plan_name} ({plan.max_students} etudiants, IA: {plan.ai_enabled ? 'oui' : 'non'})
                                                        </option>
                                                    ))}
                                                </select>
                                                <button
                                                    type="button"
                                                    className="btn-secondary"
                                                    onClick={() => handleAssignPlan(school.id)}
                                                >
                                                    Assigner abonnement
                                                </button>
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ display: 'grid', gap: '4px' }}>
                                                <span>Etudiants: <strong>{school.student_count}</strong>{school.max_students ? ` / ${school.max_students}` : ''}</span>
                                                <span>Formateurs: <strong>{school.formateur_count}</strong>{school.max_formateurs ? ` / ${school.max_formateurs}` : ''}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ display: 'grid', gap: '6px' }}>
                                                <small style={{ color: '#374151' }}>
                                                    {school.payment_status_label || school.payment_status}
                                                    {school.days_until_due === null || school.days_until_due === undefined
                                                        ? ' • échéance non définie'
                                                        : Number(school.days_until_due) < 0
                                                            ? ` • en retard de ${Math.abs(Number(school.days_until_due))} jours`
                                                            : ` • ${school.days_until_due} jours restants`}
                                                    {school.payment_grace_days !== null && school.payment_grace_days !== undefined
                                                        ? ` • tolérance ${school.payment_grace_days} jours`
                                                        : ''}
                                                </small>
                                                <small style={{ color: '#6b7280' }}>
                                                    Dernier paiement: {school.last_payment_at ? String(school.last_payment_at).slice(0, 10) : 'Non enregistré'}
                                                </small>
                                                <select
                                                    className="form-input"
                                                    value={paymentForm.payment_status}
                                                    onChange={(e) => handlePaymentFormChange(school.id, 'payment_status', e.target.value)}
                                                >
                                                    {PAYMENT_OPTIONS.map((opt) => (
                                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                    ))}
                                                </select>
                                                <input
                                                    type="date"
                                                    className="form-input"
                                                    value={paymentForm.next_due_date}
                                                    onChange={(e) => handlePaymentFormChange(school.id, 'next_due_date', e.target.value)}
                                                />
                                                <button
                                                    type="button"
                                                    className="btn-secondary"
                                                    onClick={() => handleUpdatePayment(school.id)}
                                                >
                                                    Enregistrer paiement
                                                </button>
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ display: 'grid', gap: '4px' }}>
                                                <span>Admins: <strong>{school.admin_count}</strong></span>
                                                <span>Formateurs: <strong>{school.formateur_count}</strong></span>
                                                <span>Etudiants: <strong>{school.student_count}</strong></span>
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ display: 'grid', gap: '6px' }}>
                                                {school.is_active ? (
                                                    <small style={{ color: '#6b7280' }}>
                                                        Suspension auto uniquement si retard depasse la tolerance.
                                                    </small>
                                                ) : (
                                                    <>
                                                        <small>Raison: {school.suspended_reason || 'Suspension automatique'}</small>
                                                    <button
                                                        type="button"
                                                        className="btn-primary"
                                                        onClick={() => handleReactivateSchool(school.id)}
                                                    >
                                                        Réactiver école
                                                    </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ display: 'grid', gap: '6px' }}>
                                                <input
                                                    className="form-input"
                                                    placeholder="Email"
                                                    value={form.email}
                                                    onChange={(e) => handleAdminFormChange(school.id, 'email', e.target.value)}
                                                />
                                                <input
                                                    className="form-input"
                                                    placeholder="Nom"
                                                    value={form.nom}
                                                    onChange={(e) => handleAdminFormChange(school.id, 'nom', e.target.value)}
                                                />
                                                <input
                                                    className="form-input"
                                                    placeholder="Prénom"
                                                    value={form.prenom}
                                                    onChange={(e) => handleAdminFormChange(school.id, 'prenom', e.target.value)}
                                                />
                                                <input
                                                    type="password"
                                                    className="form-input"
                                                    placeholder="Mot de passe"
                                                    value={form.password}
                                                    onChange={(e) => handleAdminFormChange(school.id, 'password', e.target.value)}
                                                />
                                                <button
                                                    type="button"
                                                    className="btn-primary"
                                                    onClick={() => handleCreateSchoolAdmin(school.id)}
                                                >
                                                    Créer admin école
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default SuperAdminDashboard;
