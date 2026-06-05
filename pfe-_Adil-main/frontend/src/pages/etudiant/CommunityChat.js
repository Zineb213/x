import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import io from 'socket.io-client';
import { getSocketBaseUrl } from '../../utils/socketBase';
import './CommunityChat.css';

const CommunityChat = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [community, setCommunity] = useState(null);
    const [conversation, setConversation] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [isMember, setIsMember] = useState(true);
    const socketRef = useRef(null);
    const messagesEndRef = useRef(null);
    const conversationIdRef = useRef(null);

    const backPath = ['FORMATEUR', 'FORMATEUR_SIMPLE'].includes(user?.role_global)
        ? '/formateur/modules'
        : '/etudiant/communities';

    useEffect(() => {
        conversationIdRef.current = conversation?.id ?? null;
    }, [conversation]);

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    useEffect(() => {
        const token = sessionStorage.getItem('token');
        if (!token) return undefined;

        const s = io(getSocketBaseUrl(), {
            auth: { token },
            transports: ['websocket', 'polling']
        });
        socketRef.current = s;

        const onNewMessage = (message) => {
            const cid = conversationIdRef.current;
            if (!message || cid == null) return;
            if (Number(message.conversation_id) !== Number(cid)) return;
            setMessages((prev) => {
                if (prev.some((m) => m.id === message.id)) return prev;
                return [...prev, message];
            });
            scrollToBottom();
        };

        s.on('connect', () => {
            console.log('Socket connected (community)');
            const cid = conversationIdRef.current;
            if (cid != null) {
                s.emit('join_conversation', { conversationId: cid });
            }
        });
        s.on('new_message', onNewMessage);
        s.on('disconnect', () => console.log('Socket disconnected (community)'));

        return () => {
            const cid = conversationIdRef.current;
            if (cid && s.connected) {
                s.emit('leave_conversation', { conversationId: cid });
            }
            s.off('new_message', onNewMessage);
            s.disconnect();
            socketRef.current = null;
        };
    }, [scrollToBottom]);

    useEffect(() => {
        if (!conversation?.id || !socketRef.current?.connected) return;
        socketRef.current.emit('join_conversation', { conversationId: conversation.id });
    }, [conversation?.id]);

    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    const fetchCommunityAndChat = async () => {
        try {
            setLoading(true);

            const communityRes = await api.get(`/communities/${id}`);
            if (communityRes.data.success) {
                setCommunity(communityRes.data.data);
            } else {
                setLoading(false);
                return;
            }

            const chatRes = await api.get(`/communities/${id}/chat`);
            if (chatRes.data.success) {
                setConversation(chatRes.data.data);
                const messagesRes = await api.get(`/chat/conversations/${chatRes.data.data.id}/messages`);
                if (messagesRes.data.success) {
                    setMessages(messagesRes.data.data);
                }
            }
        } catch (error) {
            console.error('Error fetching community:', error);
            if (error.response?.status === 404) {
                navigate(backPath);
            }
        } finally {
            setLoading(false);
        }
    };

    const checkAccessAndLoad = async () => {
        try {
            const accessRes = await api.get(`/communities/${id}/can-access`);
            if (!accessRes.data.success || !accessRes.data.data?.allowed) {
                setIsMember(false);
                setLoading(false);
                return;
            }
            await fetchCommunityAndChat();
        } catch (error) {
            console.error('Error checking access:', error);
            setLoading(false);
        }
    };

    useEffect(() => {
        checkAccessAndLoad();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const sendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !conversation || sending) return;

        setSending(true);
        try {
            const s = socketRef.current;
            if (s?.connected) {
                s.emit('send_message', {
                    conversationId: conversation.id,
                    content: newMessage.trim()
                });
                setNewMessage('');
            } else {
                console.error('Socket not connected');
            }
        } catch (error) {
            console.error('Error sending message:', error);
        } finally {
            setSending(false);
        }
    };

    if (!isMember && !loading) {
        return (
            <div className="community-chat-page">
                <div className="chat-header">
                    <button type="button" className="back-btn" onClick={() => navigate(backPath)}>
                        ← Retour
                    </button>
                </div>
                <div className="no-messages">
                    <p>Vous n&apos;avez pas accès à cette communauté.</p>
                    <button
                        type="button"
                        onClick={() => navigate(backPath)}
                        style={{
                            marginTop: '16px',
                            padding: '10px 20px',
                            background: 'linear-gradient(135deg, #6366F1, #14B8A6)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer'
                        }}
                    >
                        Retour
                    </button>
                </div>
            </div>
        );
    }

    if (loading) return <div className="loading-text">Chargement...</div>;
    if (!community) return <div className="loading-text">Communauté non trouvée</div>;

    return (
        <div className="community-chat-page">
            <div className="chat-header">
                <button type="button" className="back-btn" onClick={() => navigate(backPath)}>
                    ← Retour
                </button>
                <h2>{community.name}</h2>
                <p>{community.member_count || 0} membres</p>
            </div>

            <div className="messages-container">
                {messages.length === 0 ? (
                    <div className="no-messages">
                        <p>Aucun message. Soyez le premier à envoyer un message !</p>
                    </div>
                ) : (
                    messages.map((msg) => (
                        <div
                            key={msg.id ?? `${msg.created_at}-${msg.user_id}`}
                            className={`message ${msg.user_id === user?.id ? 'sent' : 'received'}`}
                        >
                            <div className="message-sender">
                                <strong>{msg.prenom} {msg.nom}</strong>
                            </div>
                            <div className="message-content">
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
                    placeholder="Écrivez votre message..."
                    className="message-input"
                />
                <button type="submit" className="send-btn" disabled={sending}>
                    {sending ? '...' : 'Envoyer'}
                </button>
            </form>
        </div>
    );
};

export default CommunityChat;
