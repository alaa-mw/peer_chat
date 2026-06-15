function getOtherUserId(userId) {
  return userId === 'user1' ? 'user2' : 'user1'; 
}

module.exports = {
  getOtherUserId,
};