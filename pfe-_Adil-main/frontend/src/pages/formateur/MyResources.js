import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import './FormateurPages.css';

const MyResources = () => {
    const navigate = useNavigate();
    const [resources, setResources] = useState([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [resourceToDelete, setResourceToDelete] = useState(null);

    useEffect(() => {
        fetchResources();
    }, []);

    const fetchResources = async () => {
        try {
            const response = await api.get('/formateur/resources');
            if (response.data.success) {
                setResources(response.data.data);
            }
        } catch (error) {
            console.error('Error fetching resources:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!resourceToDelete) return;
        
        try {
            await api.delete(`/formateur/resources/${resourceToDelete.id}`);
            setMessage({ type: 'success', text: 'Ressource supprimée' });
            fetchResources();
            setTimeout(() => setMessage({ type: '', text: '' }), 3000);
        } catch (error) {
            setMessage({ type: 'error', text: 'Erreur lors de la suppression' });
        } finally {
            setShowDeleteModal(false);
            setResourceToDelete(null);
        }
    };

    const getCategoryBadgeClass = (category) => {
        switch(category) {
            case 'Cours': return 'badge-cours';
            case 'TD': return 'badge-td';
            case 'TP': return 'badge-tp';
            case 'Examen': return 'badge-examen';
            default: return '';
        }
    };

    if (loading) return <div className="loading-text">Chargement des ressources...</div>;

    return (
        <div className="formateur-page fade-in">
            <div className="page-header">
                <h1>Mes Ressources</h1>
                <p>Gérez vos ressources pédagogiques</p>
                <button className="btn-primary" onClick={() => navigate('/formateur/upload')}>
                    + Nouvelle ressource
                </button>
            </div>

            {message.text && (
                <div className={`alert alert-${message.type}`}>
                    {message.text}
                </div>
            )}

            {resources.length === 0 ? (
                <div className="empty-state">
                    <i className="fas fa-folder-open"></i>
                    <p>Aucune ressource</p>
                    <button className="btn-primary" onClick={() => navigate('/formateur/upload')}>
                        Uploader une ressource
                    </button>
                </div>
            ) : (
                <div className="resources-table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Titre</th>
                                <th>Module</th>
                                <th>Catégorie</th>
                                <th>Téléchargements</th>
                                <th>Date</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {resources.map(resource => (
                                <tr key={resource.id}>
                                    <td><strong>{resource.titre}</strong></td>
                                    <td>{resource.module_code}</td>
                                    <td>
                                        <span className={`badge ${getCategoryBadgeClass(resource.category)}`}>
                                            {resource.category}
                                        </span>
                                    </td>
                                    <td>{resource.download_count || 0}</td>
                                    <td>{new Date(resource.created_at).toLocaleDateString()}</td>
                                    <td className="actions-cell">
                                        <button 
                                            className="btn-icon"
                                            onClick={() => navigate(`/formateur/resources/${resource.id}/edit`)}
                                            title="Modifier"
                                        >
                                            ✏️
                                        </button>
                                        <button 
                                            className="btn-icon btn-danger"
                                            onClick={() => {
                                                setResourceToDelete(resource);
                                                setShowDeleteModal(true);
                                            }}
                                            title="Supprimer"
                                        >
                                            🗑️
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && resourceToDelete && (
                <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Confirmer la suppression</h3>
                            <button className="modal-close" onClick={() => setShowDeleteModal(false)}>&times;</button>
                        </div>
                        <div className="modal-body">
                            <p>Supprimer la ressource : <strong>{resourceToDelete.titre}</strong> ?</p>
                            <p>Cette action est irréversible.</p>
                        </div>
                        <div className="modal-footer">
                            <button className="btn-secondary" onClick={() => setShowDeleteModal(false)}>Annuler</button>
                            <button className="btn-danger" onClick={handleDelete}>Supprimer</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MyResources;
