const prisma = require('../config/database');
const { emitNotification } = require('./socketService');
const logger = require('../utils/logger');

/**
 * Create a notification in the DB and emit via socket.
 */
exports.createNotification = async (userId, type, title, body, data = {}) => {
  try {
    const notification = await prisma.notification.create({
      data: { userId, type, title, body, data },
    });

    // Real-time emit
    emitNotification(userId, 'notification:new', { notification });

    return notification;
  } catch (err) {
    logger.error('createNotification failed:', err.message);
  }
};
