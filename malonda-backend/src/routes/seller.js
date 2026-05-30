const express = require('express');
const router = express.Router();
const prisma = require('../config/database');
const { authenticate } = require('../middleware/authMiddleware');

router.get('/dashboard', authenticate, async (req, res, next) => {
  try {
    const [products, orders, revenue, escrow] = await Promise.all([
      prisma.product.count({ where: { sellerId: req.user.id, status: 'ACTIVE' } }),
      prisma.order.count({ where: { sellerId: req.user.id } }),
      prisma.payment.aggregate({ where: { order: { sellerId: req.user.id }, status: 'SUCCESS' }, _sum: { amount: true } }),
      prisma.escrow.aggregate({ where: { order: { sellerId: req.user.id }, status: 'HELD' }, _sum: { amount: true }, _count: true }),
    ]);

    const recentOrders = await prisma.order.findMany({
      where: { sellerId: req.user.id },
      include: { items: { include: { product: true } }, buyer: { select: { name: true } } },
      orderBy: { createdAt: 'desc' }, take: 10,
    });

    res.json({ success: true, stats: { products, orders, revenue: revenue._sum.amount || 0, escrowHeld: escrow._sum.amount || 0, escrowCount: escrow._count }, recentOrders });
  } catch (err) { next(err); }
});

router.get('/analytics', authenticate, async (req, res, next) => {
  try {
    const { period = '30d' } = req.query;
    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [orders, views, reviews] = await Promise.all([
      prisma.order.findMany({ where: { sellerId: req.user.id, createdAt: { gte: since } }, include: { payment: true } }),
      prisma.product.aggregate({ where: { sellerId: req.user.id }, _sum: { viewCount: true } }),
      prisma.review.findMany({ where: { sellerId: req.user.id }, select: { rating: true } }),
    ]);

    const revenue = orders.filter(o => o.payment?.status === 'SUCCESS').reduce((s, o) => s + Number(o.totalAmount), 0);
    const avgRating = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

    res.json({ success: true, analytics: { revenue, orderCount: orders.length, totalViews: views._sum.viewCount || 0, avgRating: Math.round(avgRating * 10) / 10, reviewCount: reviews.length } });
  } catch (err) { next(err); }
});

router.get('/orders', authenticate, async (req, res, next) => {
  try {
    const { status } = req.query;
    const orders = await prisma.order.findMany({
      where: { sellerId: req.user.id, ...(status && { status }) },
      include: { items: { include: { product: true } }, buyer: { select: { name: true, phone: true } }, escrow: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, orders });
  } catch (err) { next(err); }
});

module.exports = router;
