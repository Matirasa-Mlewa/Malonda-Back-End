const express = require('express');
const router = express.Router();
const prisma = require('../config/database');
const { authenticate } = require('../middleware/authMiddleware');

router.get('/', authenticate, async (req, res, next) => {
  try {
    const notifs = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' }, take: 50,
    });
    res.json({ success: true, notifications: notifs });
  } catch (err) { next(err); }
});

router.get('/unread-count', authenticate, async (req, res, next) => {
  try {
    const count = await prisma.notification.count({ where: { userId: req.user.id, isRead: false } });
    res.json({ success: true, count });
  } catch (err) { next(err); }
});

router.put('/:id/read', authenticate, async (req, res, next) => {
  try {
    await prisma.notification.update({ where: { id: req.params.id }, data: { isRead: true } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.put('/read-all', authenticate, async (req, res, next) => {
  try {
    await prisma.notification.updateMany({ where: { userId: req.user.id, isRead: false }, data: { isRead: true } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.put('/preferences', authenticate, async (req, res, next) => {
  try {
    const { pushToken } = req.body;
    if (pushToken) await prisma.user.update({ where: { id: req.user.id }, data: { pushToken } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
