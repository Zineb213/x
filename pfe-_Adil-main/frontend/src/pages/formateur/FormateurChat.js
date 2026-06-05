import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../services/api';
import io from 'socket.io-client';
import { getSocketBaseUrl } from '../../utils/socketBase';
import '../etudiant/Chat.css';
import './FormateurPages.css';

const FormateurChat = () => {
    const [selectedConversation, setSelectedConversation] = useState(null);
    const [activeStudentId, setActiveStudentId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [socketConnected, setSocketConnected] = useState(false);
    const [sendError, setSendError] = useState('');
    const [students, setStudents] = useState([]);
    const socketRef = useRef(null);
    const messagesEndRef = useRef(null);
    const selectedConversationIdRef = useRef(null);
    const [user, setUser] = useState(null);

    useEffect(() => {
        selectedConversationIdRef.current = selectedConversation?.id ?? null;
    }, [selectedConversation]);

    const joinActiveConversation = useCallback(() => {
        const s = socketRef.current;
        const cid = selectedConversationIdRef.current;
        if (!s?.connected || cid == null) return;
        s.emit('join_conversation', { conversationId: cid });
    }, []);

    useEffect(() => {
        const storedUser = sessionStorage.getItem('user');
        if (storedUser) setUser(JSON.parse(storedUser));

        fetchData();

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
            const sid = selectedConversationIdRef.current;
            if (sid != null && Number(message.conversation_id) === Number(sid)) {
                setMessages((prev) => {
                    if (message.id && prev.some((m) => m.id === message.id)) return prev;
                    return [...prev, message];
                });
            }
        };

        s.on('connect', () => {
            setSocketConnected(true);
            setSendError('');
            joinActiveConversation();
        });

        s.on('disconnect', () => setSocketConnected(false));

        s.on('connect_error', (err) => {
            console.error('Formateur chat socket:', err?.message);
            setSocketConnected(false);
            setSendError('Connexion temps réel indisponible');
        });

        s.on('app_error', (payload) => {
            console.warn('Chat:', payload?.message);
            setSendError(payload?.message || 'Erreur');
        });

        s.on('new_message', onNewMessage);

        return () => {
            const cid = selectedConversationIdRef.current;
            if (cid && s.connected) {
                s.emit('leave_conversation', { conversationId: cid });
            }
            s.off('new_message', onNewMessage);
            s.disconnect();
            socketRef.current = null;
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [joinActiveConversation]);

    useEffect(() => {
        joinActiveConversation();
    }, [selectedConversation?.id, joinActiveConversation, socketConnected]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const fetchData = async () => {
        await fetchStudents();
        setLoading(false);
    };

    const fetchStudents = async () => {
        try {
            const response = await api.get('/formateur/students');
            if (response.data.success) {
                setStudents(response.data.data);
            }
        } catch (error) {
            console.error('Error fetching students:', error);
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

    useEffect(() => {
        if (selectedConversation) {
            fetchMessages(selectedConversation.id);
        }
    }, [selectedConversation]);

    const sendMessage = async (e) => {
        e.preventDefault();
        setSendError('');
        if (!newMessage.trim() || !selectedConversation || sending) return;

        const s = socketRef.current;
        if (!s?.connected) {
            setSendError('Pas de connexion temps réel. Réessayez dans un instant.');
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

    const startChat = async (studentId) => {
        try {
            const response = await api.post('/chat/private', { userId: studentId });
            if (response.data.success) {
                setActiveStudentId(studentId);
                setSelectedConversation(response.data.data);
            }
        } catch (error) {
            console.error('Error starting chat:', error);
            setSendError(error.response?.data?.error || 'Impossible d’ouvrir la conversation');
        }
    };

    const getConversationName = (conv) => {
        if (conv.conversation_type === 'PRIVATE') {
            return conv.group_name || 'Étudiant';
        }
        return conv.group_name || 'Discussion';
    };

    if (loading) return <div className="loading-text">Chargement des conversations...</div>;

    return (
        <div className="chat-page formateur-chat-page fade-in">
            <div
                className={`chat-connection-bar ${socketConnected ? 'chat-connection-bar--ok' : 'chat-connection-bar--warn'}`}
            >
                {socketConnected ? '● Connecté' : '○ Reconnexion…'}
            </div>
            <div className="chat-container">
                <div className="chat-sidebar formateur-chat-sidebar">
                    <div className="sidebar-header">
                        <h2>Mes étudiants</h2>
                        <p className="sidebar-sub">Cliquez pour ouvrir le chat privé</p>
                    </div>
                    <div className="students-list">
                        {students.length === 0 ? (
                            <div className="empty-state-small">
                                <p>Aucun étudiant</p>
                            </div>
                        ) : (
                            students.map((student) => (
                                <button
                                    type="button"
                                    key={student.id}
                                    className={`student-item ${activeStudentId === student.id ? 'active' : ''}`}
                                    onClick={() => startChat(student.id)}
                                >
                                    <div className="student-avatar-small">
                                        {student.prenom?.charAt(0)}
                                        {student.nom?.charAt(0)}
                                    </div>
                                    <div className="student-info-small">
                                        <div className="student-name">
                                            {student.prenom} {student.nom}
                                        </div>
                                        <div className="student-email">{student.email}</div>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                <div className="chat-area">
                    {!selectedConversation ? (
                        <div className="no-conversation">
                            <span className="no-conversation-icon" aria-hidden>💬</span>
                            <p>Sélectionnez un étudiant</p>
                            <small>Conversation privée sécurisée</small>
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
                                    placeholder="Votre message…"
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
        </div>
    );
};

export default FormateurChat;
