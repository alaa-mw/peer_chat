const {
  getOtherUserId,
  getPeerStatus,
  getPeerSocketId,
  updateUserStatus,
} = require('./users');
const { handleHeartbeat } = require('./heartbeat');
const {
  handleTypingStart,
  handleTypingStop,
  handlePrivateMessage,
  handleMarkRead,
  getAndDeliverOfflineMessages,
} = require('./messages');

// This is the main socket router.
// It listens for register, heartbeat, typing_start, typing_stop, private_message, mark_read, and disconnect.
// يربط أحداث العميل بالدوال المناسبة في الملفات الأخرى.

function registerConnectionHandlers(io, pool, socket) {
  console.log('⚡ New client connected:', socket.id);
  let currentUserId = null;

  socket.on('register', async (userId) => { // "on" for receiving message from client
    currentUserId = userId;
    await updateUserStatus(pool, userId, 'online', socket.id);
    console.log(`✅ User ${userId} registered`);

    const otherUserId = getOtherUserId(userId);
    const otherStatus = getPeerStatus(otherUserId); 
    socket.emit('peer_status', { userId: otherUserId, status: otherStatus.status });

    await getAndDeliverOfflineMessages(pool, socket, userId);//
  });

  socket.on('heartbeat', async () => {
    console.log(`💓 heartbeat event received on socket ${socket.id}`);
    if (!currentUserId) {
      console.warn(`⚠️ heartbeat ignored: user not registered yet on socket ${socket.id}`);
    }
    await handleHeartbeat({ io, pool, currentUserId });
  });

  socket.on('typing_start', ({ toUserId }) => {
    handleTypingStart({ io, currentUserId, toUserId });
  });

  socket.on('typing_stop', ({ toUserId }) => {
    handleTypingStop({ io, currentUserId, toUserId });
  });

  socket.on('private_message', async (payload) => {
    await handlePrivateMessage({ io, pool, socket, currentUserId, payload });
  });

  socket.on('mark_read', async ({ messageId, fromUserId }) => {
    await handleMarkRead({ io, pool, messageId, fromUserId });
  });

  socket.on('disconnect', async () => {
    if (currentUserId) {
      await updateUserStatus(pool, currentUserId, 'offline', null);
      console.log(`❌ User ${currentUserId} disconnected`);

      const otherUserId = getOtherUserId(currentUserId);
      const otherSocketId = getPeerSocketId(otherUserId);

      if (otherSocketId) {
        io.to(otherSocketId).emit('peer_status', { userId: currentUserId, status: 'offline' });
      }
    }
  });
}

module.exports = {
  registerConnectionHandlers,
};