const express = require('express');
const router = express.Router();
const prisma = require('../config/database');
const { authenticate } = require('../middleware/authMiddleware');
const { recalcTrustScore } = require('../services/trustService');

router.get('/me/wishlist', authenticate, async (req, res, next) => {
  try {
    const items = await prisma.wishlistItem.findMany({
      where: { userId: req.user.id },
      include: { product: { include: { images: { where: { isPrimary: true }, take: 1 }, seller: { select: { name: true, verificationLevel: true } } } } },
    });
    res.json({ success: true, items });
  } catch (err) { next(err); }
});

router.post('/me/wishlist', authenticate, async (req, res, next) => {
  try {
    const { productId } = req.body;
    await prisma.wishlistItem.upsert({
      where: { userId_productId: { userId: req.user.id, productId } },
      update: {},
      create: { userId: req.user.id, productId },
    });
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.delete('/me/wishlist/:productId', authenticate, async (req, res, next) => {
  try {
    await prisma.wishlistItem.deleteMany({ where: { userId: req.user.id, productId: req.params.productId } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.put('/me', authenticate, async (req, res, next) => {
  try {
    const { name, location, district } = req.body;
    const user = await prisma.user.update({ where: { id: req.user.id }, data: { name, location, district } });
    res.json({ success: true, user });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, name: true, verificationLevel: true, trustScore: true, location: true, isSeller: true, createdAt: true, avatarUrl: true, _count: { select: { sellerOrders: true, products: true, reviewsReceived: true } } },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, user });
  } catch (err) { next(err); }
});

router.get('/:id/trust', async (req, res, next) => {
  try {
    const score = await recalcTrustScore(req.params.id);
    res.json({ success: true, trustScore: score });
  } catch (err) { next(err); }
});

router.post('/:userId/report', authenticate, async (req, res, next) => {
  try {
    const { reason, description } = req.body;
    await prisma.report.create({
      data: { reporterId: req.user.id, reportedId: req.params.userId, reason, description: description || '' },
    });
    res.json({ success: true, message: 'Report submitted' });
  } catch (err) { next(err); }
});

router.post('/:userId/block', authenticate, async (req, res, next) => {
  res.json({ success: true, message: 'User blocked' });
});

module.exports = router;
