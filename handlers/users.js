const { getOtherUserId } = require('../utils/helpers');

const userSockets = new Map();
const userStatus = new Map();

async function updateUserStatus(pool, userId, status, socketId = null) {
  const now = Date.now();
  userStatus.set(userId, { status, lastSeen: now });

  if (socketId) {
    userSockets.set(userId, socketId); // for online users, we store their socket ID to send them messages later
  } else if (status === 'offline') {
    userSockets.delete(userId); // if user goes offline, we remove their socket ID
  }

  await pool.query(
    `INSERT INTO user_states (user_id, status, last_heartbeat, current_socket_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id)
     DO UPDATE SET status = $2, last_heartbeat = $3, current_socket_id = $4`,
    [userId, status, now, socketId]
  );
}

function getPeerStatus(userId) {
  return userStatus.get(userId) || { status: 'offline' };
}

function getPeerSocketId(userId) {
  return userSockets.get(userId);
}

module.exports = {
  userSockets,
  userStatus,
  getOtherUserId,
  getPeerStatus,
  getPeerSocketId,
  updateUserStatus,
};