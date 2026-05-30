const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const logger = require('../utils/logger');

let io;

exports.setupSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true,
    },
    pingInterval: 25000,
    pingTimeout: 60000,
  });

  // Auth middleware for socket
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication required'));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
      if (!user) return next(new Error('User not found'));
      socket.userId = user.id;
      socket.user = user;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.userId}`);
    socket.join(`user:${socket.userId}`);

    // Send message
    socket.on('message:send', async ({ recipientId, message }) => {
      try {
        // Emit to recipient in real time
        io.to(`user:${recipientId}`).emit('message:receive', {
          senderId: socket.userId,
          senderName: socket.user.name,
          text: message.text,
          imageUrl: message.imageUrl,
          time: new Date().toISOString(),
        });
      } catch (err) {
        logger.error('Socket message error:', err.message);
      }
    });

    // Typing indicator
    socket.on('typing', ({ recipientId }) => {
      io.to(`user:${recipientId}`).emit('typing', { senderId: socket.userId });
    });

    // Mark read
    socket.on('message:read', ({ senderId }) => {
      io.to(`user:${senderId}`).emit('message:read', { readBy: socket.userId });
    });

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.userId}`);
    });
  });

  return io;
};

/**
 * Emit a notification to a specific user via socket.
 */
exports.emitNotification = (userId, event, data) => {
  if (io) io.to(`user:${userId}`).emit(event, data);
};

exports.getIo = () => io;
