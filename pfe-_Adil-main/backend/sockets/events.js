// sockets/events.js
module.exports = {
    // Connection events
    CONNECTION: 'connection',
    DISCONNECT: 'disconnect',
    
    // Room events
    JOIN_LEVEL_ROOM: 'join_level_room',
    JOIN_CONVERSATION: 'join_conversation',
    LEAVE_CONVERSATION: 'leave_conversation',
    
    // Message events
    SEND_MESSAGE: 'send_message',
    NEW_MESSAGE: 'new_message',
    EDIT_MESSAGE: 'edit_message',
    DELETE_MESSAGE: 'delete_message',
    
    // Typing events
    TYPING_START: 'typing_start',
    TYPING_END: 'typing_end',
    USER_TYPING: 'user_typing',
    
    // Presence events
    USER_ONLINE: 'user_online',
    USER_OFFLINE: 'user_offline',
    USER_PRESENCE: 'user_presence',
    
    // Read receipts
    MARK_READ: 'mark_read',
    MESSAGE_READ: 'message_read',
    
    // Reaction events
    ADD_REACTION: 'add_reaction',
    REMOVE_REACTION: 'remove_reaction',
    
    // Application errors (do not use reserved name "error" on socket)
    APP_ERROR: 'app_error'
};
