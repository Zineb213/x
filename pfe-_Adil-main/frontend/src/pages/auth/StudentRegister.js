import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button';
import authService from '../../services/authService';
import './Login.css';

const StudentRegister = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        nom: '',
        prenom: '',
        email: '',
        schoolCode: '',
        niveau: '',
        password: '',
        confirmPassword: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [schoolInfo, setSchoolInfo] = useState(null);
    const [availableLevels, setAvailableLevels] = useState([]);
    const [schoolLookupLoading, setSchoolLookupLoading] = useState(false);
    const [schoolLookupError, setSchoolLookupError] = useState('');

    const handleChange = (field, value) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    useEffect(() => {
        const schoolCode = formData.schoolCode.trim();

        setSchoolInfo(null);
        setAvailableLevels([]);
        setSchoolLookupError('');

        if (!schoolCode) {
            setFormData((prev) => ({ ...prev, niveau: '' }));
            return undefined;
        }

        const timeoutId = setTimeout(async () => {
            setSchoolLookupLoading(true);
            try {
                const response = await authService.resolveSchoolCode(schoolCode);
                if (response.success) {
                    const levels = response.data?.levels || [];
                    setSchoolInfo(response.data);
                    setAvailableLevels(levels);
                    setFormData((prev) => ({
                        ...prev,
                        niveau: levels.includes(prev.niveau) ? prev.niveau : ''
                    }));

                    if (levels.length === 0) {
                        setSchoolLookupError('Cette ecole n a encore aucun niveau configure.');
                    }
                }
            } catch (err) {
                setSchoolInfo(null);
                setAvailableLevels([]);
                setFormData((prev) => ({ ...prev, niveau: '' }));
                setSchoolLookupError(err?.response?.data?.error || 'Code ecole invalide');
            } finally {
                setSchoolLookupLoading(false);
            }
        }, 350);

        return () => clearTimeout(timeoutId);
    }, [formData.schoolCode]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (formData.password !== formData.confirmPassword) {
            setError('Les mots de passe ne correspondent pas.');
            return;
        }

        if (formData.password.length < 6) {
            setError('Le mot de passe doit contenir au moins 6 caracteres.');
            return;
        }

        if (!schoolInfo) {
            setError('Veuillez entrer un code ecole valide.');
            return;
        }

        if (!formData.niveau) {
            setError('Veuillez choisir un niveau de cette ecole.');
            return;
        }

        setLoading(true);
        try {
            const response = await authService.studentRegister({
                email: formData.email,
                nom: formData.nom,
                prenom: formData.prenom,
                niveau: formData.niveau,
                password: formData.password,
                school_code: formData.schoolCode
            });

            if (response.success) {
                setSuccess('Inscription envoyee. Un administrateur doit valider votre demande.');
                setFormData({
                    nom: '',
                    prenom: '',
                    email: '',
                    schoolCode: '',
                    niveau: '',
                    password: '',
                    confirmPassword: ''
                });
                setSchoolInfo(null);
                setAvailableLevels([]);
                setTimeout(() => navigate('/login'), 1200);
            } else {
                setError(response.error || 'Echec de l inscription');
            }
        } catch (err) {
            setError(err?.response?.data?.error || 'Erreur reseau lors de l inscription');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-container">
                <div className="login-left">
                    <div className="login-branding">
                        <i className="fas fa-user-graduate"></i>
                        <h1>TAMKIN</h1>
                        <p>Demande d'inscription etudiant</p>
                    </div>
                    <div className="features-list">
                        <div className="feature-item">
                            <i className="fas fa-list-check"></i>
                            <span>Validation par administrateur</span>
                        </div>
                        <div className="feature-item">
                            <i className="fas fa-layer-group"></i>
                            <span>Acces aux ressources de votre niveau</span>
                        </div>
                        <div className="feature-item">
                            <i className="fas fa-comments"></i>
                            <span>Contact direct avec vos formateurs</span>
                        </div>
                    </div>
                </div>

                <div className="login-right">
                    <div className="login-form-container">
                        <h2>Inscription etudiant</h2>
                        <p className="subtitle">Entrez le code ecole puis choisissez un niveau disponible dans cette ecole</p>

                        {error && <div className="alert alert-error">{error}</div>}
                        {success && <div className="alert" style={{ background: '#ecfdf3', color: '#065f46', border: '1px solid #a7f3d0' }}>{success}</div>}

                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label>Nom</label>
                                <input
                                    type="text"
                                    value={formData.nom}
                                    onChange={(e) => handleChange('nom', e.target.value)}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>Prenom</label>
                                <input
                                    type="text"
                                    value={formData.prenom}
                                    onChange={(e) => handleChange('prenom', e.target.value)}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>Email</label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => handleChange('email', e.target.value)}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>Code ecole</label>
                                <input
                                    type="text"
                                    value={formData.schoolCode}
                                    onChange={(e) => handleChange('schoolCode', e.target.value.toUpperCase())}
                                    placeholder="Ex: DEMO"
                                    required
                                />
                                {schoolLookupLoading && <small>Verification du code ecole...</small>}
                                {!schoolLookupLoading && schoolInfo && (
                                    <small style={{ color: '#065f46' }}>
                                        Ecole detectee: {schoolInfo.school_name}
                                    </small>
                                )}
                                {schoolLookupError && (
                                    <small style={{ color: '#b91c1c' }}>{schoolLookupError}</small>
                                )}
                            </div>

                            <div className="form-group">
                                <label>Niveau</label>
                                <select
                                    value={formData.niveau}
                                    onChange={(e) => handleChange('niveau', e.target.value)}
                                    required
                                    disabled={!schoolInfo || availableLevels.length === 0 || schoolLookupLoading}
                                    style={{ width: '100%', padding: '14px', border: '2px solid var(--gray-200)', borderRadius: 'var(--border-radius)', fontSize: '16px' }}
                                >
                                    <option value="">Selectionner un niveau</option>
                                    {availableLevels.map((level) => (
                                        <option key={level} value={level}>{level}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Mot de passe</label>
                                <input
                                    type="password"
                                    value={formData.password}
                                    onChange={(e) => handleChange('password', e.target.value)}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>Confirmer le mot de passe</label>
                                <input
                                    type="password"
                                    value={formData.confirmPassword}
                                    onChange={(e) => handleChange('confirmPassword', e.target.value)}
                                    required
                                />
                            </div>

                            <Button type="submit" fullWidth loading={loading}>
                                Envoyer la demande
                            </Button>
                        </form>

                        <div className="login-links">
                            <a href="/login">Retour a la connexion</a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StudentRegister;
