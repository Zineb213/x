import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../services/api';
import io from 'socket.io-client';
import { getSocketBaseUrl } from '../../utils/socketBase';
import './Chat.css';

const Chat = () => {
    const [conversations, setConversations] = useState([]);
    const [selectedConversation, setSelectedConversation] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [socketConnected, setSocketConnected] = useState(false);
    const [sendError, setSendError] = useState('');
    const [assistantOpen, setAssistantOpen] = useState(false);
    const [assistantQuestion, setAssistantQuestion] = useState('');
    const [assistantLoading, setAssistantLoading] = useState(false);
    const [assistantError, setAssistantError] = useState('');
    const [assistantEnabled, setAssistantEnabled] = useState(true);
    const [assistantModuleId, setAssistantModuleId] = useState('');
    const [studentModules, setStudentModules] = useState([]);
    const [assistantMessages, setAssistantMessages] = useState([
        {
            role: 'assistant',
            content: 'Salut, je suis ton assistant IA. Pose-moi une question sur un cours, une notion ou une methode de revision.'
        }
    ]);
    const socketRef = useRef(null);
    const messagesEndRef = useRef(null);
    const [user, setUser] = useState(null);
    const refreshTimeoutRef = useRef(null);
    const isRefreshingRef = useRef(false);
    const selectedConversationIdRef = useRef(null);

    useEffect(() => {
        selectedConversationIdRef.current = selectedConversation?.id ?? null;
    }, [selectedConversation]);

    const debouncedRefresh = useCallback(() => {
        if (refreshTimeoutRef.current) {
            clearTimeout(refreshTimeoutRef.current);
        }
        refreshTimeoutRef.current = setTimeout(() => {
            if (!isRefreshingRef.current) {
                loadData();
            }
        }, 400);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadData is defined below; refresh stays debounced
    }, []);

    const joinActiveConversation = useCallback(() => {
        const s = socketRef.current;
        const cid = selectedConversationIdRef.current;
        if (!s?.connected || cid == null) return;
        s.emit('join_conversation', { conversationId: cid });
    }, []);

    useEffect(() => {
        const storedUser = sessionStorage.getItem('user');
        if (storedUser) setUser(JSON.parse(storedUser));

        loadData();
        fetchStudentModules();
        fetchAssistantStatus();

        const token = sessionStorage.getItem('token');
        if (!token) return undefined;

        const s = io(getSocketBaseUrl(), {
            auth: { token },
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 8,
            reconnectionDelay: 800
        });
        socketRef.current = s;

        const onNewMessage = (message) => {
            const cid = selectedConversationIdRef.current;
            if (cid == null || Number(message.conversation_id) !== Number(cid)) return;
            setMessages((prev) => {
                if (message.id && prev.some((m) => m.id === message.id)) return prev;
                return [...prev, message];
            });
            debouncedRefresh();
        };

        s.on('connect', () => {
            setSocketConnected(true);
            setSendError('');
            joinActiveConversation();
        });

        s.on('disconnect', () => {
            setSocketConnected(false);
        });

        s.on('connect_error', (err) => {
            console.error('Chat socket connect_error:', err?.message);
            setSocketConnected(false);
            setSendError('Connexion temps réel indisponible — vérifiez le serveur et REACT_APP_SOCKET_URL');
        });

        s.on('app_error', (payload) => {
            const msg = payload?.message || 'Erreur';
            console.warn('Chat:', msg);
            setSendError(msg);
        });

        s.on('new_message', onNewMessage);

        return () => {
            if (refreshTimeoutRef.current) {
                clearTimeout(refreshTimeoutRef.current);
            }
            const cid = selectedConversationIdRef.current;
            if (cid && s.connected) {
                s.emit('leave_conversation', { conversationId: cid });
            }
            s.off('new_message', onNewMessage);
            s.disconnect();
            socketRef.current = null;
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadData is stable; avoid re-creating socket on every render
    }, [debouncedRefresh, joinActiveConversation]);

    useEffect(() => {
        joinActiveConversation();
    }, [selectedConversation?.id, joinActiveConversation, socketConnected]);

    useEffect(() => {
        const handleStorageChange = (e) => {
            if (e.key === 'communities_updated') {
                debouncedRefresh();
            }
        };
        const handleCustomEvent = () => debouncedRefresh();

        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('communitiesUpdated', handleCustomEvent);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('communitiesUpdated', handleCustomEvent);
        };
    }, [debouncedRefresh]);

    useEffect(() => {
        if (selectedConversation) {
            fetchMessages(selectedConversation.id);
        }
    }, [selectedConversation]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const loadData = async () => {
        if (isRefreshingRef.current) return;
        isRefreshingRef.current = true;

        try {
            const currentJoinedIds = await fetchJoinedCommunities();
            await fetchConversations(currentJoinedIds);
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            isRefreshingRef.current = false;
        }
    };

    const fetchJoinedCommunities = async () => {
        try {
            const response = await api.get('/communities/joined');
            if (response.data.success) {
                return response.data.data.map((c) => c.id);
            }
        } catch (error) {
            if (error.response?.status !== 429) {
                console.error('Error fetching joined communities:', error);
            }
        }
        return [];
    };

    const fetchConversations = async (joinedIds = null) => {
        try {
            const currentJoinedIds = Array.isArray(joinedIds)
                ? joinedIds
                : await fetchJoinedCommunities();
            const response = await api.get('/chat/conversations');
            if (response.data.success) {
                let filteredConversations = response.data.data;

                filteredConversations = filteredConversations.filter((conv) => {
                    if (conv.is_community_chat && conv.community_id) {
                        return currentJoinedIds.includes(conv.community_id);
                    }
                    return true;
                });

                setConversations(filteredConversations);

                setSelectedConversation((prev) => {
                    if (prev && !filteredConversations.find((c) => c.id === prev.id)) {
                        return null;
                    }
                    return prev;
                });
            }
        } catch (error) {
            if (error.response?.status !== 429) {
                console.error('Error fetching conversations:', error);
            }
        } finally {
            setLoading(false);
        }
    };

    const fetchMessages = async (conversationId) => {
        try {
            const response = await api.get(`/chat/conversations/${conversationId}/messages`, {
                params: { _ts: Date.now() }
            });
            if (response.data.success) {
                setMessages(response.data.data);
            }
        } catch (error) {
            console.error('Error fetching messages:', error);
        }
    };

    const fetchStudentModules = async () => {
        try {
            const response = await api.get('/etudiant/modules');
            if (response.data?.success) {
                setStudentModules(response.data.data || []);
            }
        } catch (error) {
            console.error('Error fetching student modules:', error);
        }
    };

    const fetchAssistantStatus = async () => {
        try {
            const response = await api.get('/etudiant/assistant/status');
            if (response.data?.success) {
                const enabled = Boolean(response.data.data?.ai_enabled);
                setAssistantEnabled(enabled);

                if (!enabled) {
                    setAssistantError(response.data.data?.message || 'Assistant IA desactive pour votre ecole.');
                }
            }
        } catch (error) {
            console.error('Error fetching assistant status:', error);
        }
    };

    const sendMessage = async (e) => {
        e.preventDefault();
        setSendError('');
        if (!newMessage.trim() || !selectedConversation || sending) return;

        const s = socketRef.current;
        if (!s?.connected) {
            setSendError('Pas de connexion temps réel. Attendez la reconnexion ou rechargez la page.');
            return;
        }

        setSending(true);
        try {
            s.emit('send_message', {
                conversationId: selectedConversation.id,
                content: newMessage.trim()
            });
            setNewMessage('');
        } catch (error) {
            console.error('Error sending message:', error);
            setSendError('Envoi impossible');
        } finally {
            setSending(false);
        }
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

    const getConversationName = (conv) => {
        if (conv.conversation_type === 'PRIVATE') {
            return conv.group_name || 'Chat privé';
        }
        if (conv.is_community_chat) {
            return conv.group_name || 'Communauté';
        }
        return conv.group_name || 'Discussion de groupe';
    };

    if (loading) return <div className="loading-text">Chargement des conversations...</div>;

    return (
        <div className="chat-page fade-in">
            <div
                className={`chat-connection-bar ${socketConnected ? 'chat-connection-bar--ok' : 'chat-connection-bar--warn'}`}
            >
                {socketConnected ? '● Connecté — messages en temps réel' : '○ Reconnexion… — envoi suspendu'}
            </div>
            <div className="chat-container">
                <div className="chat-sidebar">
                    <div className="sidebar-header">
                        <h2>Messages</h2>
                        <p className="sidebar-sub">Chats privés et communautés</p>
                    </div>
                    <div className="conversations-list">
                        {conversations.length === 0 ? (
                            <div className="empty-conversations">
                                <p>Aucune conversation</p>
                            </div>
                        ) : (
                            conversations.map((conv) => (
                                <button
                                    type="button"
                                    key={conv.id}
                                    className={`conversation-item ${selectedConversation?.id === conv.id ? 'active' : ''}`}
                                    onClick={() => setSelectedConversation(conv)}
                                >
                                    <div className="conversation-avatar">
                                        {conv.is_community_chat ? '👥' : '💬'}
                                    </div>
                                    <div className="conversation-info">
                                        <div className="conversation-name">{getConversationName(conv)}</div>
                                        <div className="conversation-last-message">
                                            {conv.last_message?.substring(0, 40) || 'Nouvelle conversation'}
                                        </div>
                                    </div>
                                    {conv.unread_count > 0 && (
                                        <div className="unread-badge">{conv.unread_count}</div>
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                </div>

                <div className="chat-area">
                    {!selectedConversation ? (
                        <div className="no-conversation">
                            <span className="no-conversation-icon" aria-hidden>💬</span>
                            <p>Sélectionnez une conversation</p>
                            <small>Les messages privés avec votre formateur apparaissent ici</small>
                        </div>
                    ) : (
                        <>
                            <div className="chat-header">
                                <h3>{getConversationName(selectedConversation)}</h3>
                            </div>
                            {sendError && (
                                <div className="chat-inline-alert" role="alert">
                                    {sendError}
                                </div>
                            )}
                            <div className="messages-container">
                                {messages.length === 0 ? (
                                    <div className="no-messages">
                                        <p>Aucun message pour l’instant</p>
                                    </div>
                                ) : (
                                    messages.map((msg) => (
                                        <div
                                            key={msg.id ?? `${msg.created_at}-${msg.user_id}`}
                                            className={`message ${msg.user_id === user?.id ? 'sent' : 'received'}`}
                                        >
                                            <div className="message-content">
                                                {msg.user_id !== user?.id && (msg.prenom || msg.nom) && (
                                                    <div className="message-sender-name">
                                                        {msg.prenom} {msg.nom}
                                                    </div>
                                                )}
                                                <div className="message-text">{msg.content}</div>
                                                <div className="message-time">
                                                    {new Date(msg.created_at).toLocaleTimeString()}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                                <div ref={messagesEndRef} />
                            </div>
                            <form className="message-input-form" onSubmit={sendMessage}>
                                <input
                                    type="text"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder="Écrivez votre message…"
                                    className="message-input"
                                    autoComplete="off"
                                />
                                <button type="submit" className="send-btn" disabled={sending || !socketConnected}>
                                    {sending ? '…' : 'Envoyer'}
                                </button>
                            </form>
                        </>
                    )}
                </div>
            </div>

            <button
                type="button"
                className="assistant-fab"
                onClick={() => {
                    if (!assistantEnabled) {
                        setAssistantError('Assistant IA desactive pour votre ecole (abonnement sans IA).');
                        return;
                    }
                    setAssistantOpen((prev) => !prev);
                }}
                aria-label="Ouvrir assistant IA"
                disabled={!assistantEnabled}
            >
                {assistantOpen ? '×' : '🤖'}
            </button>

            <button
                type="button"
                className="assistant-window-btn"
                onClick={() => window.open('/etudiant/bot', 'eduplatform_ai_bot', 'width=540,height=760,menubar=no,toolbar=no,location=no,status=no')}
                disabled={!assistantEnabled}
            >
                Ouvrir bot en fenetre
            </button>

            {assistantOpen && assistantEnabled && (
                <div className="assistant-panel" role="dialog" aria-label="Assistant IA">
                    <div className="assistant-panel-header">
                        <h4>Assistant IA (Ollama)</h4>
                        <small>Reserve aux apprenants</small>
                    </div>

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

                    <div className="assistant-messages">
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
                            placeholder="Pose une question (ex: explique les jointures SQL)"
                            maxLength={1500}
                            disabled={!assistantEnabled}
                        />
                        <button type="submit" disabled={!assistantEnabled || assistantLoading || !assistantQuestion.trim()}>
                            {assistantLoading ? '...' : 'Envoyer'}
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
};

export default Chat;
