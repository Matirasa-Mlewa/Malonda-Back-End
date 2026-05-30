const prisma = require('../config/database');
const { createNotification } = require('../services/notificationService');
const { calculateFee } = require('../utils/helpers');

// POST /orders
exports.create = async (req, res, next) => {
  try {
    const { items, paymentMethod, deliveryAddress, deliveryNote, discountCode } = req.body;
    const buyerId = req.user.id;

    if (!items || !items.length) return res.status(400).json({ error: 'No items in order' });

    // Fetch products and validate
    const productIds = items.map(i => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, status: 'ACTIVE' },
      include: { seller: true },
    });

    if (products.length !== productIds.length) return res.status(400).json({ error: 'One or more products are unavailable' });

    // Calculate subtotal
    let subtotal = 0;
    const orderItems = items.map(item => {
      const product = products.find(p => p.id === item.productId);
      const totalPrice = Number(product.price) * item.quantity;
      subtotal += totalPrice;
      return { productId: item.productId, quantity: item.quantity, unitPrice: Number(product.price), totalPrice };
    });

    // Apply discount
    let discountAmount = 0;
    if (discountCode) {
      const promo = await prisma.promotion.findUnique({ where: { code: discountCode, isActive: true } });
      if (promo && (!promo.expiresAt || promo.expiresAt > new Date()) && (!promo.maxUses || promo.usedCount < promo.maxUses)) {
        discountAmount = promo.discountType === 'PERCENTAGE'
          ? Math.round(subtotal * (Number(promo.discountValue) / 100))
          : Number(promo.discountValue);
        await prisma.promotion.update({ where: { code: discountCode }, data: { usedCount: { increment: 1 } } });
      }
    }

    const platformFee = calculateFee(subtotal);
    const totalAmount = subtotal + platformFee - discountAmount;

    // All items from same seller (for simplicity; multi-seller = split orders)
    const sellerId = products[0].sellerId;

    const order = await prisma.order.create({
      data: {
        buyerId, sellerId, totalAmount, platformFee, discountAmount,
        paymentMethod: paymentMethod || 'AIRTEL_MONEY',
        deliveryAddress, deliveryNote, status: 'PENDING',
        items: { create: orderItems },
      },
      include: { items: { include: { product: true } }, buyer: true, seller: true },
    });

    // Notify seller
    await createNotification(sellerId, 'ORDER_PLACED', 'New Order!', `You have a new order #${order.id.slice(-6).toUpperCase()} from ${order.buyer.name}`, { orderId: order.id });

    res.status(201).json({ success: true, order });
  } catch (err) { next(err); }
};

// GET /orders
exports.getAll = async (req, res, next) => {
  try {
    const { role = 'buyer', status } = req.query;
    const where = { [role === 'seller' ? 'sellerId' : 'buyerId']: req.user.id, ...(status && { status }) };

    const orders = await prisma.order.findMany({
      where, orderBy: { createdAt: 'desc' },
      include: {
        items: { include: { product: { include: { images: { where: { isPrimary: true }, take: 1 } } } } },
        buyer: { select: { name: true, phone: true, verificationLevel: true } },
        seller: { select: { name: true, phone: true, verificationLevel: true } },
        escrow: true,
        payment: true,
      },
    });
    res.json({ success: true, orders });
  } catch (err) { next(err); }
};

// GET /orders/:id
exports.getById = async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        items: { include: { product: { include: { images: true } } } },
        buyer: { select: { name: true, phone: true } },
        seller: { select: { name: true, phone: true } },
        escrow: true, payment: true,
        tracking: { orderBy: { createdAt: 'asc' } },
        review: true,
      },
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.buyerId !== req.user.id && order.sellerId !== req.user.id && req.user.role !== 'ADMIN')
      return res.status(403).json({ error: 'Forbidden' });
    res.json({ success: true, order });
  } catch (err) { next(err); }
};

// POST /orders/:id/confirm — buyer confirms delivery, release escrow
exports.confirmDelivery = async (req, res, next) => {
  try {
    const { rating, review: reviewText } = req.body;
    const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { escrow: true, items: true } });

    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.buyerId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    if (!['DELIVERED', 'ESCROWED', 'DISPATCHED'].includes(order.status)) return res.status(400).json({ error: 'Order not ready to confirm' });

    // Update order & escrow
    await prisma.$transaction([
      prisma.order.update({ where: { id: order.id }, data: { status: 'COMPLETED' } }),
      prisma.escrow.update({ where: { orderId: order.id }, data: { status: 'RELEASED', releasedAt: new Date() } }),
    ]);

    // Create review if rating provided
    if (rating && order.items[0]) {
      await prisma.review.create({
        data: {
          orderId: order.id, productId: order.items[0].productId,
          reviewerId: req.user.id, sellerId: order.sellerId,
          rating: Number(rating), text: reviewText || null,
        },
      });
    }

    // Notify seller
    await createNotification(order.sellerId, 'ESCROW_RELEASED', 'Payment Released!',
      `Buyer confirmed delivery for order #${order.id.slice(-6).toUpperCase()}. Payment has been released to you.`,
      { orderId: order.id });

    res.json({ success: true, message: 'Delivery confirmed and payment released' });
  } catch (err) { next(err); }
};

// POST /orders/:id/dispute
exports.openDispute = async (req, res, next) => {
  try {
    const { reason, description } = req.body;
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.buyerId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    await prisma.order.update({ where: { id: order.id }, data: { status: 'DISPUTED', disputeReason: `${reason}: ${description}` } });
    await createNotification(order.sellerId, 'DISPUTE_OPENED', 'Dispute Opened',
      `A dispute has been opened for order #${order.id.slice(-6).toUpperCase()}. Our team will review within 48 hours.`,
      { orderId: order.id });

    res.json({ success: true, message: 'Dispute submitted. Team will review within 48 hours.' });
  } catch (err) { next(err); }
};

// POST /orders/:id/cancel
exports.cancel = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) return res.status(404).json({ error: 'Not found' });
    if (order.buyerId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    if (!['PENDING', 'PAID'].includes(order.status)) return res.status(400).json({ error: 'Cannot cancel order at this stage' });

    await prisma.order.update({ where: { id: order.id }, data: { status: 'CANCELLED', cancelReason: reason } });
    res.json({ success: true, message: 'Order cancelled' });
  } catch (err) { next(err); }
};
