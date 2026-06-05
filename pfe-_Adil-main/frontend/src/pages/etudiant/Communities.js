import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../services/api';
import './Communities.css';

const Communities = () => {
    const [myCommunities, setMyCommunities] = useState([]);
    const [allCommunities, setAllCommunities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState({ type: '', text: '' });
    const isFetchingRef = useRef(false);

    const fetchCommunities = useCallback(async () => {
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;
        
        try {
            const [allRes, joinedRes] = await Promise.all([
                api.get('/communities'),
                api.get('/communities/joined')
            ]);
            
            if (allRes.data.success) setAllCommunities(allRes.data.data);
            if (joinedRes.data.success) setMyCommunities(joinedRes.data.data);
        } catch (error) {
            if (error.response?.status !== 429) {
                console.error('Error fetching communities:', error);
                setMessage({ type: 'error', text: 'Erreur lors du chargement' });
            }
        } finally {
            setLoading(false);
            isFetchingRef.current = false;
        }
    }, []);

    useEffect(() => {
        fetchCommunities();
    }, [fetchCommunities]);

    const handleJoin = async (communityId) => {
        try {
            const response = await api.post(`/communities/${communityId}/join`);
            if (response.data.success) {
                setMessage({ type: 'success', text: 'Vous avez rejoint la communauté !' });
                fetchCommunities();
                // Dispatch event to update chat
                window.dispatchEvent(new CustomEvent('communitiesUpdated'));
                localStorage.setItem('communities_updated', Date.now().toString());
                setTimeout(() => setMessage({ type: '', text: '' }), 3000);
            }
        } catch (error) {
            setMessage({ type: 'error', text: error.response?.data?.error || 'Erreur' });
        }
    };

    const handleLeave = async (communityId) => {
        if (window.confirm(`Êtes-vous sûr de vouloir quitter cette communauté ?`)) {
            try {
                const response = await api.delete(`/communities/${communityId}/leave`);
                if (response.data.success) {
                    setMessage({ type: 'success', text: 'Vous avez quitté la communauté' });
                    fetchCommunities();
                    // Dispatch event to update chat
                    window.dispatchEvent(new CustomEvent('communitiesUpdated'));
                    localStorage.setItem('communities_updated', Date.now().toString());
                    setTimeout(() => setMessage({ type: '', text: '' }), 3000);
                }
            } catch (error) {
                setMessage({ type: 'error', text: error.response?.data?.error || 'Erreur lors du départ' });
            }
        }
    };

    const getCategoryIcon = (categoryName) => {
        const icons = {
            'Python': '🐍',
            'PHP': '🐘',
            'Node.js': '💚',
            'React.js': '⚛️'
        };
        return icons[categoryName] || '💬';
    };

    const getCategoryColor = (categoryName) => {
        const colors = {
            'Python': '#3776AB',
            'PHP': '#777BB4',
            'Node.js': '#339933',
            'React.js': '#61DAFB'
        };
        return colors[categoryName] || '#6366F1';
    };

    if (loading) return <div className="loading-text">Chargement des communautés...</div>;

    const joinedIds = myCommunities.map(c => c.id);
    const joined = allCommunities.filter(c => joinedIds.includes(c.id));
    const available = allCommunities.filter(c => !joinedIds.includes(c.id));

    return (
        <div className="communities-page fade-in">
            <div className="page-header">
                <h1>Communautés</h1>
                <p>Rejoignez des communautés pour apprendre ensemble</p>
            </div>

            {message.text && (
                <div className={`alert alert-${message.type}`}>
                    {message.text}
                </div>
            )}

            {/* Joined Communities Section */}
            <section className="communities-section">
                <h2>Mes communautés ({joined.length})</h2>
                {joined.length === 0 ? (
                    <div className="empty-state">
                        <i className="fas fa-users"></i>
                        <p>Vous n'avez pas encore rejoint de communauté</p>
                        <p className="empty-hint">Rejoignez une communauté ci-dessous pour commencer !</p>
                    </div>
                ) : (
                    <div className="communities-grid">
                        {joined.map(community => (
                            <div key={community.id} className="community-card joined">
                                <div 
                                    className="community-icon" 
                                    style={{ backgroundColor: getCategoryColor(community.category_name) }}
                                >
                                    {getCategoryIcon(community.category_name)}
                                </div>
                                <h3>{community.name}</h3>
                                <p>{community.description}</p>
                                <div className="community-stats">
                                    <span>👥 {community.member_count || 0} membres</span>
                                </div>
                                <div className="community-actions">
                                    <button 
                                        className="btn-primary btn-sm"
                                        onClick={() => window.location.href = `/etudiant/communities/${community.id}/chat`}
                                    >
                                        💬 Accéder au chat
                                    </button>
                                    <button 
                                        className="btn-outline btn-sm"
                                        onClick={() => handleLeave(community.id)}
                                    >
                                        Quitter
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Available Communities Section */}
            <section className="communities-section">
                <h2>Communautés disponibles ({available.length})</h2>
                {available.length === 0 ? (
                    <div className="empty-state">
                        <p>Toutes les communautés ont été rejointes !</p>
                    </div>
                ) : (
                    <div className="communities-grid">
                        {available.map(community => (
                            <div key={community.id} className="community-card">
                                <div 
                                    className="community-icon" 
                                    style={{ backgroundColor: getCategoryColor(community.category_name) }}
                                >
                                    {getCategoryIcon(community.category_name)}
                                </div>
                                <h3>{community.name}</h3>
                                <p>{community.description}</p>
                                <div className="community-stats">
                                    <span>👥 {community.member_count || 0} membres</span>
                                </div>
                                <button 
                                    className="btn-primary btn-sm"
                                    onClick={() => handleJoin(community.id)}
                                >
                                    Rejoindre
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
};

export default Communities;
