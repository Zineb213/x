import React, { useState } from 'react';
import api from '../../services/api';

const emptyModule = () => ({ code: '', nom: '', components: ['Cours', 'TD', 'TP'] });

export default function FirstLoginSetupModal({ onClose }) {
    const [levels, setLevels] = useState([
        { name: 'L1', modules: [emptyModule()] }
    ]);
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState(null);

    const addLevel = () => setLevels([...levels, { name: `Niveau ${levels.length + 1}`, modules: [emptyModule()] }]);
    const removeLevel = (idx) => setLevels(levels.filter((_, i) => i !== idx));

    const addModule = (lvlIdx) => {
        const copy = [...levels];
        copy[lvlIdx].modules.push(emptyModule());
        setLevels(copy);
    };
    const removeModule = (lvlIdx, mIdx) => {
        const copy = [...levels];
        copy[lvlIdx].modules = copy[lvlIdx].modules.filter((_, i) => i !== mIdx);
        setLevels(copy);
    };

    const updateLevelName = (idx, val) => { const copy = [...levels]; copy[idx].name = val; setLevels(copy); };
    const updateModuleField = (lvlIdx, mIdx, field, val) => { const copy = [...levels]; copy[lvlIdx].modules[mIdx][field] = val; setLevels(copy); };
    const updateModuleComponents = (lvlIdx, mIdx, val) => {
        const parts = val.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
        const copy = [...levels]; copy[lvlIdx].modules[mIdx].components = parts; setLevels(copy);
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        setMessage(null);
        try {
            const toCreate = [];
            levels.forEach((lvl) => {
                lvl.modules.forEach((m) => {
                    // ensure required fields
                    if (!m.code || !m.nom || !lvl.name) return;
                    toCreate.push({ code: m.code, nom: m.nom, niveau: lvl.name, components: m.components || [] });
                });
            });

            if (toCreate.length === 0) {
                setMessage({ type: 'error', text: 'Aucun module valide à créer.' });
                setSubmitting(false);
                return;
            }

            // create modules in parallel
            await Promise.all(toCreate.map((m) => api.post('/admin/modules', m)));

            // mark first login done locally and reload to refresh context
            const user = JSON.parse(sessionStorage.getItem('user') || '{}');
            user.is_first_login = false;
            sessionStorage.setItem('user', JSON.stringify(user));
            try { localStorage.setItem('user', JSON.stringify(user)); } catch (e) {}

            setMessage({ type: 'success', text: 'Configuration initiale enregistrée. Rechargement…' });
            setTimeout(() => window.location.reload(), 800);
        } catch (err) {
            setMessage({ type: 'error', text: err.response?.data?.error || 'Erreur lors de la création' });
            setSubmitting(false);
        }
    };

    return (
        <div className="modal-overlay" style={{ zIndex: 9999 }} onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 900 }}>
                <div className="modal-header">
                    <h3>Configuration initiale de l'école</h3>
                    <button className="modal-close" onClick={onClose}>&times;</button>
                </div>
                <div className="modal-body">
                    <p>Ajoutez rapidement les niveaux, modules et composants de votre établissement. Vous pourrez modifier ensuite.</p>
                    {message && <div style={{ marginBottom: 12 }} className={`alert alert-${message.type}`}>{message.text}</div>}

                    {levels.map((lvl, li) => (
                        <div key={li} style={{ border: '1px solid #eee', padding: 12, marginBottom: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <input value={lvl.name} onChange={(e) => updateLevelName(li, e.target.value)} style={{ fontWeight: 600 }} />
                                <div>
                                    <button onClick={() => addModule(li)} style={{ marginRight: 8 }}>➕ Module</button>
                                    {levels.length > 1 && <button onClick={() => removeLevel(li)}>🗑 Supprimer niveau</button>}
                                </div>
                            </div>
                            <div style={{ marginTop: 8 }}>
                                {lvl.modules.map((m, mi) => (
                                    <div key={mi} style={{ marginBottom: 8, padding: 8, background: '#fafafa' }}>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <input placeholder="Code (ex: MATH101)" value={m.code} onChange={(e) => updateModuleField(li, mi, 'code', e.target.value)} />
                                            <input placeholder="Nom du module" value={m.nom} onChange={(e) => updateModuleField(li, mi, 'nom', e.target.value)} />
                                            <input placeholder="Composants (séparés par ,)" value={(m.components || []).join(', ')} onChange={(e) => updateModuleComponents(li, mi, e.target.value)} />
                                            <button onClick={() => removeModule(li, mi)}>🗑</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}

                    <div style={{ marginTop: 8 }}>
                        <button onClick={addLevel}>➕ Ajouter un niveau</button>
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="btn-secondary" onClick={onClose} disabled={submitting}>Annuler</button>
                    <button className="btn-primary" onClick={handleSubmit} disabled={submitting}>{submitting ? 'Enregistrement…' : 'Enregistrer et terminer'}</button>
                </div>
            </div>
        </div>
    );
}
