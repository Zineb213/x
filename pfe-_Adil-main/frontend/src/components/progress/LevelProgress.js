import React from 'react';
import './LevelProgress.css';

/** Progression unique 0 → 1000 XP (Expert), sans niveaux académiques. */
const LevelProgress = ({ rank, totalXp }) => {
    const r = rank || {};
    const cap = r.capXp ?? 1000;
    const pct = r.progressPercent ?? (Math.min((totalXp || 0) / cap, 1) * 100);
    const nextAt = r.nextMilestoneXp;
    const showNext = nextAt != null && (totalXp || 0) < cap;

    return (
        <div className="level-progress">
            <div className="level-header">
                <div className="level-badge">
                    <span className="level-number">
                        {r.currentEmoji} {r.currentTitle || 'Débutant'}
                    </span>
                </div>
                <div className="xp-info">
                    <span>{totalXp ?? 0} XP</span>
                    {showNext && (
                        <span>
                            Prochain palier : {nextAt} XP
                            {r.nextTitle ? ` (${r.nextTitle})` : ''}
                        </span>
                    )}
                    {(totalXp || 0) >= cap && (
                        <span>🏆 Expert — {cap} XP</span>
                    )}
                </div>
            </div>
            <div className="progress-bar-container">
                <div
                    className="progress-bar-fill"
                    style={{ width: `${Math.min(pct, 100)}%` }}
                />
            </div>
            <div className="xp-track-hint">
                Parcours apprenant : 0 XP (Débutant) → {cap} XP (Expert)
            </div>
        </div>
    );
};

export default LevelProgress;
