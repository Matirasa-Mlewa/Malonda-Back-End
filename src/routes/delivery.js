// delivery.js
const express = require('express');
const r1 = express.Router();
const prisma = require('../config/database');
const { authenticate } = require('../middleware/authMiddleware');

r1.get('/track/:orderId', authenticate, async (req, res, next) => {
  try {
    const tracking = await prisma.deliveryTracking.findMany({
      where: { orderId: req.params.orderId }, orderBy: { createdAt: 'asc' },
    });
    res.json({ success: true, tracking });
  } catch (err) { next(err); }
});

r1.put('/:orderId/status', authenticate, async (req, res, next) => {
  try {
    const { status, note, location } = req.body;
    await prisma.deliveryTracking.create({ data: { orderId: req.params.orderId, status, note, location } });
    const orderStatus = status === 'DELIVERED' ? 'DELIVERED' : status === 'DISPATCHED' ? 'DISPATCHED' : undefined;
    if (orderStatus) await prisma.order.update({ where: { id: req.params.orderId }, data: { status: orderStatus } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = r1;
