import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../services/api';
import './FormateurPages.css';

const ResourceUpload = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [modules, setModules] = useState([]);
    const [formData, setFormData] = useState({
        module_id: new URLSearchParams(location.search).get('moduleId') || '',
        titre: '',
        description: '',
        category: 'Cours'
    });
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    useEffect(() => {
        fetchModules();
    }, []);

    const fetchModules = async () => {
        try {
            const response = await api.get('/formateur/modules');
            if (response.data.success) {
                setModules(response.data.data);
            }
        } catch (error) {
            console.error('Error fetching modules:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        const allowedTypes = ['application/pdf', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'];
        
        if (selectedFile && allowedTypes.includes(selectedFile.type)) {
            setFile(selectedFile);
            setMessage({ type: 'success', text: 'Fichier valide' });
            setTimeout(() => setMessage({ type: '', text: '' }), 2000);
        } else {
            setFile(null);
            setMessage({ type: 'error', text: 'Format non supporté. Utilisez PDF ou PPTX.' });
            setTimeout(() => setMessage({ type: '', text: '' }), 3000);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!formData.module_id) {
            setMessage({ type: 'error', text: 'Veuillez sélectionner un module' });
            return;
        }
        if (!formData.titre) {
            setMessage({ type: 'error', text: 'Veuillez saisir un titre' });
            return;
        }
        if (!file) {
            setMessage({ type: 'error', text: 'Veuillez sélectionner un fichier' });
            return;
        }
        
        setUploading(true);
        
        const uploadData = new FormData();
        uploadData.append('file', file);
        uploadData.append('module_id', formData.module_id);
        uploadData.append('titre', formData.titre);
        uploadData.append('description', formData.description);
        uploadData.append('category', formData.category);
        
        try {
            const response = await api.post('/formateur/resources', uploadData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            
            if (response.data.success) {
                setMessage({ type: 'success', text: 'Ressource uploadée avec succès!' });
                setTimeout(() => {
                    navigate('/formateur/resources');
                }, 2000);
            }
        } catch (error) {
            setMessage({ type: 'error', text: error.response?.data?.error || 'Erreur lors de l\'upload' });
        } finally {
            setUploading(false);
        }
    };

    if (loading) return <div className="loading-text">Chargement...</div>;

    return (
        <div className="formateur-page fade-in">
            <div className="page-header">
                <h1>Uploader une ressource</h1>
                <p>Ajoutez un cours, TD, TP ou examen</p>
            </div>

            {message.text && (
                <div className={`alert alert-${message.type}`}>
                    {message.text}
                </div>
            )}

            <form onSubmit={handleSubmit} className="upload-form">
                <div className="form-group">
                    <label>Module *</label>
                    <select
                        value={formData.module_id}
                        onChange={(e) => setFormData({...formData, module_id: e.target.value})}
                        className="form-select"
                        required
                    >
                        <option value="">Sélectionner un module</option>
                        {modules.map(module => (
                            <option key={module.id} value={module.id}>
                                {module.code} - {module.nom}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="form-group">
                    <label>Titre *</label>
                    <input
                        type="text"
                        value={formData.titre}
                        onChange={(e) => setFormData({...formData, titre: e.target.value})}
                        className="form-input"
                        placeholder="ex: Introduction au cours"
                        required
                    />
                </div>

                <div className="form-group">
                    <label>Description</label>
                    <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({...formData, description: e.target.value})}
                        className="form-textarea"
                        rows="4"
                        placeholder="Description de la ressource..."
                    />
                </div>

                <div className="form-row">
                    <div className="form-group">
                        <label>Catégorie *</label>
                        <select
                            value={formData.category}
                            onChange={(e) => setFormData({...formData, category: e.target.value})}
                            className="form-select"
                            required
                        >
                            <option value="Cours">Cours</option>
                            <option value="TD">TD</option>
                            <option value="TP">TP</option>
                            <option value="Examen">Examen</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Fichier * (PDF ou PPTX)</label>
                        <input
                            type="file"
                            onChange={handleFileChange}
                            accept=".pdf,.ppt,.pptx"
                            className="form-input"
                            required
                        />
                        <small>Max 10MB</small>
                    </div>
                </div>

                <div className="form-actions">
                    <button type="button" className="btn-secondary" onClick={() => navigate('/formateur/resources')}>
                        Annuler
                    </button>
                    <button type="submit" className="btn-primary" disabled={uploading}>
                        {uploading ? 'Upload en cours...' : 'Uploader'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ResourceUpload;
