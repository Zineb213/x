import React, { useEffect, useMemo, useState } from 'react';
import api from '../../services/api';
import './Chat.css';
import './Bot.css';

const initialAssistantMessage = {
    role: 'assistant',
    content: 'Salut, je suis ton assistant IA Ollama. Pose une question de cours et je te reponds tout de suite.'
};

const Bot = () => {
    const [studentModules, setStudentModules] = useState([]);
    const [assistantEnabled, setAssistantEnabled] = useState(true);
    const [assistantModuleId, setAssistantModuleId] = useState('');
    const [assistantQuestion, setAssistantQuestion] = useState('');
    const [assistantLoading, setAssistantLoading] = useState(false);
    const [assistantError, setAssistantError] = useState('');
    const [assistantMessages, setAssistantMessages] = useState([initialAssistantMessage]);

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const [modulesResponse, assistantStatusResponse] = await Promise.all([
                    api.get('/etudiant/modules'),
                    api.get('/etudiant/assistant/status')
                ]);

                if (modulesResponse.data?.success) {
                    setStudentModules(modulesResponse.data.data || []);
                }

                if (assistantStatusResponse.data?.success) {
                    const enabled = Boolean(assistantStatusResponse.data.data?.ai_enabled);
                    setAssistantEnabled(enabled);
                    if (!enabled) {
                        setAssistantError(
                            assistantStatusResponse.data.data?.message || 'Assistant IA desactive pour votre ecole.'
                        );
                    }
                }
            } catch (error) {
                console.error('Error fetching student assistant data:', error);
            }
        };

        fetchInitialData();
    }, []);

    const canSubmit = useMemo(
        () => assistantEnabled && assistantQuestion.trim().length > 0 && !assistantLoading,
        [assistantEnabled, assistantQuestion, assistantLoading]
    );

    const handleOpenInWindow = () => {
        window.open('/etudiant/bot', 'tamkin_ai_bot', 'width=540,height=760,menubar=no,toolbar=no,location=no,status=no');
    };

    const askAssistant = async (e) => {
        e.preventDefault();

        if (!assistantEnabled) return;
        if (!assistantQuestion.trim() || assistantLoading) return;

        const question = assistantQuestion.trim();
        setAssistantQuestion('');
        setAssistantError('');
        setAssistantLoading(true);

        setAssistantMessages((prev) => ([
            ...prev,
            { role: 'user', content: question }
        ]));

        try {
            const response = await api.post('/etudiant/assistant/ask', {
                question,
                moduleId: assistantModuleId || null
            });

            const answer = response.data?.data?.answer || 'Aucune reponse disponible pour le moment.';
            const model = response.data?.data?.model;

            setAssistantMessages((prev) => ([
                ...prev,
                { role: 'assistant', content: answer, meta: model ? `Modele: ${model}` : '' }
            ]));
        } catch (error) {
            const message = error.response?.data?.error || 'Assistant indisponible pour le moment.';
            setAssistantError(message);
            setAssistantMessages((prev) => ([
                ...prev,
                {
                    role: 'assistant',
                    content: 'Je ne peux pas repondre pour l\'instant. Verifie que Ollama est lance sur le serveur.'
                }
            ]));
        } finally {
            setAssistantLoading(false);
        }
    };

    return (
        <div className="student-bot-page fade-in">
            <div className="student-bot-header">
                <div>
                    <h1>Assistant IA</h1>
                    <p>Chat direct avec Ollama pour les apprenants</p>
                </div>
                <button type="button" className="bot-window-btn" onClick={handleOpenInWindow}>
                    Ouvrir dans une nouvelle fenetre
                </button>
            </div>

            <div className="student-bot-card">
                <div className="assistant-module-select-wrap">
                    <label htmlFor="assistant-module-select">Contexte module (optionnel)</label>
                    <select
                        id="assistant-module-select"
                        value={assistantModuleId}
                        onChange={(e) => setAssistantModuleId(e.target.value)}
                    >
                        <option value="">Sans module</option>
                        {studentModules.map((module) => (
                            <option key={module.id} value={module.id}>
                                {module.code} - {module.nom}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="assistant-messages assistant-messages--bot-page">
                    {assistantMessages.map((msg, index) => (
                        <div key={`${msg.role}-${index}`} className={`assistant-message assistant-message--${msg.role}`}>
                            <div className="assistant-message-role">{msg.role === 'assistant' ? 'IA' : 'Vous'}</div>
                            <div className="assistant-message-content">{msg.content}</div>
                            {msg.meta ? <div className="assistant-message-meta">{msg.meta}</div> : null}
                        </div>
                    ))}
                </div>

                {assistantError && <div className="assistant-error">{assistantError}</div>}

                <form className="assistant-form" onSubmit={askAssistant}>
                    <input
                        type="text"
                        value={assistantQuestion}
                        onChange={(e) => setAssistantQuestion(e.target.value)}
                        placeholder={assistantEnabled ? 'Pose une question (ex: explique les jointures SQL)' : 'Assistant IA indisponible pour votre ecole'}
                        maxLength={1500}
                        disabled={!assistantEnabled}
                    />
                    <button type="submit" disabled={!canSubmit}>
                        {assistantLoading ? '...' : 'Envoyer'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Bot;
