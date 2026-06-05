import React from 'react';
import './BadgeList.css';

const BadgeList = ({ badges }) => {
    return (
        <div className="badges-section">
            <h3>Mes distinctions</h3>
            <div className="badges-grid">
                {badges.map((badge) => (
                    <div 
                        key={badge.id} 
                        className={`badge-card ${badge.earned_at ? 'earned' : 'locked'}`}
                        title={badge.description}
                    >
                        <div className="badge-icon">{badge.icon}</div>
                        <div className="badge-name">{badge.name}</div>
                        {!badge.earned_at && (
                            <div className="badge-requirement">
                                {badge.xp_required > 0 && `${badge.xp_required} XP`}
                                {badge.modules_completed_required > 0 && ` • ${badge.modules_completed_required} modules`}
                            </div>
                        )}
                        {badge.earned_at && (
                            <div className="badge-earned">
                                Obtenu le {new Date(badge.earned_at).toLocaleDateString()}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default BadgeList;
