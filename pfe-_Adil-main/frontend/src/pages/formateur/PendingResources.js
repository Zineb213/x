import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import './FormateurPages.css';

const PendingResources = () => {
    const [resources, setResources] = useState([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [processingId, setProcessingId] = useState(null);

    useEffect(() => {
        fetchPendingResources();
    }, []);

    const fetchPendingResources = async () => {
        try {
            const response = await api.get('/formateur/resources/pending');
            if (response.data.success) {
                setResources(response.data.data);
            }
        } catch (error) {
            console.error('Error fetching pending resources:', error);
            setMessage({ type: 'error', text: 'Impossible de charger les ressources en attente.' });
        } finally {
            setLoading(false);
        }
    };

    const handleReview = async (resourceId, status) => {
        setProcessingId(resourceId);
        try {
            const response = await api.put(`/formateur/resources/${resourceId}/review`, { status });
            if (response.data.success) {
                setMessage({ type: 'success', text: response.data.message });
                fetchPendingResources();
            }
        } catch (error) {
            setMessage({ type: 'error', text: error.response?.data?.error || 'Erreur lors de la validation.' });
        } finally {
            setProcessingId(null);
            setTimeout(() => setMessage({ type: '', text: '' }), 4000);
        }
    };

    const getStatusText = (status) => {
        if (!status) return 'PENDING';
        return status;
    };

    if (loading) return <div className="loading-text">Chargement des ressources en attente...</div>;

    return (
        <div className="formateur-page fade-in">
            <div className="page-header">
                <div>
                    <h1>Ressources à valider</h1>
                    <p>Validez ou rejetez les ressources envoyées par les formateurs simples.</p>
                </div>
            </div>

            {message.text && (
                <div className={`alert alert-${message.type}`}>
                    {message.text}
                </div>
            )}

            {resources.length === 0 ? (
                <div className="empty-state">
                    <i className="fas fa-check-circle"></i>
                    <p>Aucune ressource en attente pour le moment.</p>
                </div>
            ) : (
                <div className="resources-table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Titre</th>
                                <th>Module</th>
                                <th>Catégorie</th>
                                <th>Formateur</th>
                                <th>Date</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {resources.map((resource) => (
                                <tr key={resource.id}>
                                    <td><strong>{resource.titre}</strong></td>
                                    <td>{resource.module_code}</td>
                                    <td>{resource.category}</td>
                                    <td>{resource.uploader_prenom} {resource.uploader_nom}</td>
                                    <td>{new Date(resource.created_at).toLocaleDateString()}</td>
                                    <td className="actions-cell">
                                        <button
                                            className="btn-primary"
                                            disabled={processingId === resource.id}
                                            onClick={() => handleReview(resource.id, 'APPROVED')}
                                        >
                                            Approuver
                                        </button>
                                        <button
                                            className="btn-danger"
                                            disabled={processingId === resource.id}
                                            onClick={() => handleReview(resource.id, 'REJECTED')}
                                        >
                                            Rejeter
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default PendingResources;
