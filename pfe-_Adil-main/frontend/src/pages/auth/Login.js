import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/ui/Button';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import './Login.css';

const Login = () => {
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { login, googleLogin } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const result = await login(identifier, password);
        if (result.success) {
            const user = result.user;
            if (user.role_global === 'SUPER_ADMIN') navigate('/super-admin');
            else if (['ADMIN', 'ADMIN_GLOBAL'].includes(user.role_global)) navigate('/admin');
            else if (['FORMATEUR', 'FORMATEUR_SIMPLE', 'MODERATEUR'].includes(user.role_global)) navigate('/formateur');
            else navigate('/etudiant');
        } else {
            setError(result.error || 'Identifiant ou mot de passe incorrect');
        }
        setLoading(false);
    };

    const handleGoogleSuccess = async (credentialResponse) => {
        setLoading(true);
        const result = await googleLogin(credentialResponse.credential);
        if (result.success) {
            navigate('/etudiant');
        } else {
            setError(result.error || 'Échec de la connexion Google');
        }
        setLoading(false);
    };

    return (
        <div className="login-page">
            <div className="login-container">
                <div className="login-left">
                    <div className="login-branding">
                        <i className="fas fa-graduation-cap"></i>
                        <h1>TAMKIN</h1>
                        <p>Plateforme Éducative Moderne</p>
                    </div>
                    <div className="features-list">
                        <div className="feature-item">
                            <i className="fas fa-chalkboard-user"></i>
                            <span>Ressources pédagogiques</span>
                        </div>
                        <div className="feature-item">
                            <i className="fas fa-comments"></i>
                            <span>Chat en temps réel</span>
                        </div>
                        <div className="feature-item">
                            <i className="fas fa-share-alt"></i>
                            <span>Publications et partages</span>
                        </div>
                    </div>
                </div>
                <div className="login-right">
                    <div className="login-form-container">
                        <h2>Connexion</h2>
                        <p className="subtitle">Connectez-vous à votre compte</p>

                        {error && <div className="alert alert-error">{error}</div>}

                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label>Matricule ou Email</label>
                                <input
                                    type="text"
                                    value={identifier}
                                    onChange={(e) => setIdentifier(e.target.value)}
                                    placeholder="ex: ADMIN001 ou email@example.com"
                                    required
                                />
                                <small className="form-hint">
                                    Administrateur / Formateur : utilisez votre matricule<br />
                                    Étudiant : utilisez votre email
                                </small>
                            </div>
                            <div className="form-group">
                                <label>Mot de passe</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                            <Button type="submit" fullWidth loading={loading}>
                                Se connecter
                            </Button>
                        </form>

                        <div className="divider">
                            <span>ou</span>
                        </div>

                        <div className="google-login-wrapper">
                            <GoogleLogin
                                onSuccess={handleGoogleSuccess}
                                onError={() => setError('Échec de la connexion Google')}
                                useOneTap
                            />
                            <p className="google-hint">Connexion réservée aux étudiants</p>
                        </div>

                        <div className="login-links">
                            <a href="/forgot-password">Mot de passe oublié ?</a>
                            <br />
                            <a href="/register">Nouvel étudiant ? Demander une inscription</a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const LoginWrapper = () => (
    <GoogleOAuthProvider clientId={process.env.REACT_APP_GOOGLE_CLIENT_ID}>
        <Login />
    </GoogleOAuthProvider>
);

export default LoginWrapper;