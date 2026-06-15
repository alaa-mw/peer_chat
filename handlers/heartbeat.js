const {
  getOtherUserId,
  getPeerSocketId,
  userStatus,
} = require('./users');

async function handleHeartbeat({ io, pool, currentUserId }) {
  if (!currentUserId) {
    return;
  }
 // تعديل حالة المساخدم النشط
  const now = Date.now();
  userStatus.set(currentUserId, { ...userStatus.get(currentUserId), lastSeen: now, status: 'online' });

  await pool.query(
    `UPDATE user_states SET last_heartbeat = $1, status = 'online' WHERE user_id = $2`,
    [now, currentUserId]
  );
 
  // إعلام المستخدم الآخر بنبضة القلب
  const otherUserId = getOtherUserId(currentUserId);
  const otherSocketId = getPeerSocketId(otherUserId);
 
  if (otherSocketId) {
    io.to(otherSocketId).emit('peer_heartbeat', { userId: currentUserId, timestamp: now });
  }
}

module.exports = {
  handleHeartbeat,
};