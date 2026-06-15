const crypto = require('crypto');
const { getPeerSocketId, userStatus } = require('./users');

async function storeOfflineMessage(pool, toUserId, messageId) {
  await pool.query(
    `INSERT INTO offline_messages (user_id, message_id) VALUES ($1, $2)`,
    [toUserId, messageId]
  );
}

async function getAndDeliverOfflineMessages(pool, socket, userId) {
  const result = await pool.query(
    `SELECT m.* FROM messages m
     JOIN offline_messages om ON m.id = om.message_id
     WHERE om.user_id = $1 AND m.status != 'delivered'
     ORDER BY m.timestamp ASC`,
    [userId]
  );

  for (const msg of result.rows) {
    socket.emit('offline_message', msg);

    await pool.query(`UPDATE messages SET status = 'delivered' WHERE id = $1`, [msg.id]);
    await pool.query(`DELETE FROM offline_messages WHERE user_id = $1 AND message_id = $2`, [userId, msg.id]);
  }
}

function handleTypingStart({ io, currentUserId, toUserId }) {
  const targetSocketId = getPeerSocketId(toUserId);

  if (targetSocketId) {
    io.to(targetSocketId).emit('peer_typing', { fromUserId: currentUserId, isTyping: true });
  }
}

function handleTypingStop({ io, currentUserId, toUserId }) {
  const targetSocketId = getPeerSocketId(toUserId);

  if (targetSocketId) {
    io.to(targetSocketId).emit('peer_typing', { fromUserId: currentUserId, isTyping: false });
  }
}

async function handlePrivateMessage({ io, pool, socket, currentUserId, payload }) {
  if (!currentUserId) {
    return;
  }

  const { toUserId, content, idempotencyKey, traceId } = payload;
  const messageId = crypto.randomUUID();
  const timestamp = Date.now();
  const finalIdempotencyKey = idempotencyKey || `${currentUserId}-${timestamp}-${Math.random()}`;

  const duplicateCheck = await pool.query(
    `SELECT id FROM messages WHERE idempotency_key = $1`,
    [finalIdempotencyKey]
  );

  if (duplicateCheck.rows.length > 0) {
    socket.emit('message_error', { error: 'Duplicate message', traceId });
    return;
  }

  await pool.query(
    `INSERT INTO messages (id, from_user, to_user, content, timestamp, status, idempotency_key, trace_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [messageId, currentUserId, toUserId, content, timestamp, 'sent', finalIdempotencyKey, traceId || crypto.randomUUID()]
  );

  const receiverSocketId = getPeerSocketId(toUserId);
  const isReceiverOnline = receiverSocketId && userStatus.get(toUserId)?.status === 'online';

  if (isReceiverOnline) {
    const message = { id: messageId, from_user: currentUserId, to_user: toUserId, content, timestamp, status: 'sent' };
    io.to(receiverSocketId).emit('new_message', message);
    await pool.query(`UPDATE messages SET status = 'delivered' WHERE id = $1`, [messageId]);
    socket.emit('message_delivered', { messageId, traceId });
  } else {
    await storeOfflineMessage(pool, toUserId, messageId);
    socket.emit('message_stored_offline', { messageId, traceId });
  }
}

async function handleMarkRead({ io, pool, fromUserId, messageId }) {
  await pool.query(`UPDATE messages SET status = 'read' WHERE id = $1`, [messageId]);

  const senderSocketId = getPeerSocketId(fromUserId);

  if (senderSocketId) {
    io.to(senderSocketId).emit('message_read', { messageId });
  }
}

module.exports = {
  handleTypingStart,
  handleTypingStop,
  handlePrivateMessage,
  handleMarkRead,
  storeOfflineMessage,
  getAndDeliverOfflineMessages,
};