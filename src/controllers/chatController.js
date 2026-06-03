const prisma = require('../config/database');
const { detectFraud } = require('../utils/fraudDetection');
const { uploadImage } = require('../services/storageService');

// GET /chat/conversations
exports.getConversations = async (req, res, next) => {
  try {
    const convs = await prisma.conversation.findMany({
      where: { OR: [{ user1Id: req.user.id }, { user2Id: req.user.id }] },
      include: {
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { lastAt: 'desc' },
    });

    // Hydrate with the "other" user's info
    const enriched = await Promise.all(convs.map(async c => {
      const otherId = c.user1Id === req.user.id ? c.user2Id : c.user1Id;
      const other = await prisma.user.findUnique({
        where: { id: otherId },
        select: { id: true, name: true, verificationLevel: true, avatarUrl: true },
      });
      const unread = await prisma.message.count({
        where: { conversationId: c.id, receiverId: req.user.id, isRead: false },
      });
      return { ...c, otherUser: other, unreadCount: unread };
    }));

    res.json({ success: true, conversations: enriched });
  } catch (err) { next(err); }
};

// GET /chat/:userId/messages
exports.getMessages = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { page = 1 } = req.query;
    const skip = (Number(page) - 1) * 30;

    const [u1, u2] = [req.user.id, userId].sort();
    let conv = await prisma.conversation.findUnique({ where: { user1Id_user2Id: { user1Id: u1, user2Id: u2 } } });
    if (!conv) conv = await prisma.conversation.create({ data: { user1Id: u1, user2Id: u2 } });

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where: { conversationId: conv.id },
        orderBy: { createdAt: 'desc' }, skip, take: 30,
        include: { sender: { select: { id: true, name: true } } },
      }),
      prisma.message.count({ where: { conversationId: conv.id } }),
    ]);

    // Mark as read
    await prisma.message.updateMany({
      where: { conversationId: conv.id, receiverId: req.user.id, isRead: false },
      data: { isRead: true },
    });

    res.json({ success: true, messages: messages.reverse(), total, page: Number(page) });
  } catch (err) { next(err); }
};

// POST /chat/:userId/messages
exports.sendMessage = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { text, imageUrl } = req.body;
    if (!text && !imageUrl) return res.status(400).json({ error: 'Message cannot be empty' });

    const [u1, u2] = [req.user.id, userId].sort();
    let conv = await prisma.conversation.findUnique({ where: { user1Id_user2Id: { user1Id: u1, user2Id: u2 } } });
    if (!conv) conv = await prisma.conversation.create({ data: { user1Id: u1, user2Id: u2 } });

    // Fraud detection
    let isFraudFlag = false;
    let fraudReason = null;
    if (text) {
      const fraud = detectFraud(text);
      if (fraud.isSuspicious) { isFraudFlag = true; fraudReason = fraud.reason; }
    }

    const message = await prisma.message.create({
      data: {
        conversationId: conv.id, senderId: req.user.id, receiverId: userId,
        text: text || null, imageUrl: imageUrl || null, isFraudFlag, fraudReason,
      },
      include: { sender: { select: { id: true, name: true } } },
    });

    await prisma.conversation.update({ where: { id: conv.id }, data: { lastMessage: text || '📷 Image', lastAt: new Date() } });

    res.status(201).json({ success: true, message });
  } catch (err) { next(err); }
};

// POST /chat/upload
exports.uploadChatImage = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image provided' });
    const result = await uploadImage(req.file.buffer, 'malonda/chat');
    res.json({ success: true, url: result.url });
  } catch (err) { next(err); }
};

// POST /chat/report/:messageId
exports.reportMessage = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const message = await prisma.message.findUnique({ where: { id: req.params.messageId } });
    if (!message) return res.status(404).json({ error: 'Message not found' });

    await prisma.report.create({
      data: {
        reporterId: req.user.id, reportedId: message.senderId,
        reason: 'Suspicious chat message', description: reason || 'User reported a message',
      },
    });

    res.json({ success: true, message: 'Message reported successfully' });
  } catch (err) { next(err); }
};

// POST /chat/:userId/read
exports.markRead = async (req, res, next) => {
  try {
    const [u1, u2] = [req.user.id, req.params.userId].sort();
    const conv = await prisma.conversation.findUnique({ where: { user1Id_user2Id: { user1Id: u1, user2Id: u2 } } });
    if (conv) {
      await prisma.message.updateMany({
        where: { conversationId: conv.id, receiverId: req.user.id, isRead: false },
        data: { isRead: true },
      });
    }
    res.json({ success: true });
  } catch (err) { next(err); }
};
