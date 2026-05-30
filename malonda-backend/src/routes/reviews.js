// reviews.js
const express = require('express');
const r1 = express.Router();
const prisma = require('../config/database');
const { authenticate } = require('../middleware/authMiddleware');

r1.get('/seller/:sellerId', async (req, res, next) => {
  try {
    const reviews = await prisma.review.findMany({
      where: { sellerId: req.params.sellerId },
      include: { reviewer: { select: { name: true, verificationLevel: true } } },
      orderBy: { createdAt: 'desc' }, take: 20,
    });
    const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
    res.json({ success: true, reviews, avgRating: Math.round(avg * 10) / 10 });
  } catch (err) { next(err); }
});

r1.get('/product/:productId', async (req, res, next) => {
  try {
    const reviews = await prisma.review.findMany({
      where: { productId: req.params.productId },
      include: { reviewer: { select: { name: true } } },
      orderBy: { createdAt: 'desc' }, take: 20,
    });
    res.json({ success: true, reviews });
  } catch (err) { next(err); }
});

module.exports = r1;
