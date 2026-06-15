// public/client.js
const socket = io();
const userId = localStorage.getItem('userId');
const messagesDiv = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const peerStatusSpan = document.getElementById('peerStatus');
const peerNameSpan = document.getElementById('peerName');
const typingIndicatorDiv = document.getElementById('typingIndicator');

let currentPeer = userId === 'user1' ? 'user2' : 'user1';
let typingTimeout = null;
let heartbeatTimer = null;
const sentMessageByTrace = new Map();
const sentMessageById = new Map();

peerNameSpan.textContent = currentPeer;

if (!userId) {
    // Ensure user identity exists before opening chat page.
    window.location.href = '/';
}

socket.on('connect', () => {
    // Register the user only after transport is connected.
    socket.emit('register', userId);

    if (!heartbeatTimer) {
        heartbeatTimer = setInterval(() => {
            console.log('Sending heartbeat...', userId);
            socket.emit('heartbeat');
        }, 5000);
    }
});

// ------------------- نبضات القلب (Heartbeat) -------------------
socket.on('disconnect', () => {
    if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
    }
});

// ------------------- مؤشر الكتابة -------------------
messageInput.addEventListener('input', (e) => {
    if (e.target.value.length > 0) {
        socket.emit('typing_start', { toUserId: currentPeer });
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            socket.emit('typing_stop', { toUserId: currentPeer });
        }, 2000);
    } else {
        socket.emit('typing_stop', { toUserId: currentPeer });
    }
});

// ------------------- إرسال الرسائل مع Idempotency -------------------
function sendMessage() {
    const content = messageInput.value.trim();
    if (!content) return;

    const idempotencyKey = `${userId}-${Date.now()}-${Math.random()}`;
    const traceId = crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random();

    socket.emit('private_message', {
        toUserId: currentPeer,
        content,
        idempotencyKey,
        traceId
    });

    // إظهار الرسالة فوراً في الواجهة (optimistic update)
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const messageElement = addMessageToUI({
        id: tempId,
        from_user: userId,
        content,
        timestamp: Date.now(),
        status: 'sent'
    }, true);

    sentMessageByTrace.set(traceId, { element: messageElement, messageId: tempId });
    sentMessageById.set(tempId, messageElement);
    messageInput.value = '';
    socket.emit('typing_stop', { toUserId: currentPeer });
}

sendBtn.onclick = sendMessage;
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

// ------------------- استقبال الأحداث من الخادم -------------------
socket.on('new_message', (msg) => {
    addMessageToUI(msg, msg.from_user === userId);
    // إعلام الخادم بأن الرسالة قُرئت (اختياري)
    socket.emit('mark_read', { messageId: msg.id, fromUserId: msg.from_user });
});

socket.on('offline_message', (msg) => {
    addMessageToUI(msg, msg.from_user === userId);
    // Mark queued message as read after it is rendered to the recipient.
    socket.emit('mark_read', { messageId: msg.id, fromUserId: msg.from_user });
});

function renderPeerStatus(status) {
    peerStatusSpan.textContent = status === 'online' ? 'Online' : 'Offline';
    peerStatusSpan.className = `status ${status === 'online' ? 'online' : 'offline'}`;
}

socket.on('peer_status', ({ userId: peerId, status }) => {
    if (peerId === currentPeer) {
        console.log(`Peer ${peerId} is now ${status}`);
        renderPeerStatus(status);
    }
});

socket.on('peer_heartbeat', ({ userId: peerId }) => {
    if (peerId === currentPeer) {
        renderPeerStatus('online');
    }
});

socket.on('peer_typing', ({ fromUserId, isTyping }) => {
    if (fromUserId === currentPeer) {
        typingIndicatorDiv.textContent = isTyping ? `${currentPeer} is typing...` : '';
    }
});

socket.on('message_delivered', ({ messageId, traceId }) => {
    const tracked = sentMessageByTrace.get(traceId);
    if (tracked) {
        tracked.element.dataset.messageId = messageId;
        sentMessageById.delete(tracked.messageId);
        sentMessageById.set(messageId, tracked.element);
    }
    console.log(`Message ${messageId} delivered (trace: ${traceId})`);
});

socket.on('message_read', ({ messageId }) => {
    const messageElement = sentMessageById.get(messageId);
    if (messageElement) {
        updateMessageStatus(messageElement, 'read');
    }
    console.log(`Message ${messageId} read`);
});

socket.on('message_stored_offline', ({ messageId, traceId }) => {
    const tracked = sentMessageByTrace.get(traceId);
    if (tracked) {
        tracked.element.dataset.messageId = messageId;
        sentMessageById.delete(tracked.messageId);
        sentMessageById.set(messageId, tracked.element);
        updateMessageStatus(tracked.element, 'stored_offline');
    }
    console.log(`Message ${messageId} stored offline (trace: ${traceId})`);
});

socket.on('message_error', ({ error, traceId }) => {
    console.error(`Error: ${error} for trace ${traceId}`);
    alert(`Failed to send: ${error}`);
});

// دالة مساعدة لإضافة الرسائل لواجهة المستخدم
function addMessageToUI(msg, isMine) {
    const div = document.createElement('div');
    div.className = `message ${isMine ? 'my-message' : 'other-message'}`;
    div.dataset.messageId = msg.id || '';
    const statusIcon = isMine ? getStatusIcon(msg.status || 'sent') : '';
    div.innerHTML = `
        <strong>${isMine ? 'You' : msg.from_user}</strong><br>
        ${msg.content}<br>
        <small class="message-meta">${new Date(msg.timestamp).toLocaleTimeString()}${isMine ? ` <span class="message-status">${statusIcon}</span>` : ''}</small>
    `;
    messagesDiv.appendChild(div);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    return div;
}

function getStatusIcon(status) {
    if (status === 'read') return '✓✓';
    if (status === 'stored_offline') return '🕓';
    return '';
}

function updateMessageStatus(messageElement, status) {
    const statusNode = messageElement.querySelector('.message-status');
    if (!statusNode) return;

    statusNode.textContent = getStatusIcon(status);
    statusNode.setAttribute('data-status', status);
}