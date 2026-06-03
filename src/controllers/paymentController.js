const prisma = require('../config/database');
const { initiateAirtelMoney, initiateTNMMpamba, checkPaymentStatus } = require('../services/mobileMoneyService');
const { createNotification } = require('../services/notificationService');

// POST /payments/initiate
exports.initiate = async (req, res, next) => {
  try {
    const { orderId, method, phone } = req.body;

    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { buyer: true } });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.buyerId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    if (order.status !== 'PENDING') return res.status(400).json({ error: 'Order already paid' });

    const payerPhone = phone || order.buyer.phone;

    let transactionRef = null;
    let externalRef = null;

    if (method === 'AIRTEL_MONEY') {
      const result = await initiateAirtelMoney(payerPhone, Number(order.totalAmount), orderId);
      transactionRef = result.transactionId;
      externalRef = result.reference;
    } else if (method === 'TNM_MPAMBA') {
      const result = await initiateTNMMpamba(payerPhone, Number(order.totalAmount), orderId);
      transactionRef = result.transactionId;
      externalRef = result.reference;
    } else if (method === 'CASH_ON_DELIVERY') {
      // No payment initiation needed — mark as escrowed-pending
      await prisma.order.update({ where: { id: orderId }, data: { status: 'ESCROWED', paymentMethod: 'CASH_ON_DELIVERY' } });
      await prisma.escrow.create({ data: { orderId, amount: order.totalAmount } });
      return res.json({ success: true, message: 'Cash on delivery confirmed', transactionId: null });
    }

    // Save payment record
    const payment = await prisma.payment.create({
      data: {
        orderId, userId: req.user.id, method,
        amount: order.totalAmount, status: 'PENDING',
        transactionId: transactionRef, externalRef, phone: payerPhone,
      },
    });

    await prisma.order.update({ where: { id: orderId }, data: { status: 'PAID', paymentMethod: method } });

    res.json({ success: true, transactionId: payment.id, message: `${method === 'AIRTEL_MONEY' ? 'Airtel Money' : 'TNM Mpamba'} prompt sent. Please approve on your phone.` });
  } catch (err) { next(err); }
};

// GET /payments/verify/:transactionId
exports.verify = async (req, res, next) => {
  try {
    const payment = await prisma.payment.findUnique({ where: { id: req.params.transactionId }, include: { order: true } });
    if (!payment) return res.status(404).json({ error: 'Transaction not found' });

    // Check mobile money status
    let finalStatus = payment.status;
    if (payment.status === 'PENDING' && payment.externalRef) {
      try {
        const status = await checkPaymentStatus(payment.method, payment.externalRef);
        finalStatus = status.success ? 'SUCCESS' : (status.failed ? 'FAILED' : 'PENDING');

        if (finalStatus === 'SUCCESS') {
          await prisma.$transaction([
            prisma.payment.update({ where: { id: payment.id }, data: { status: 'SUCCESS', completedAt: new Date() } }),
            prisma.order.update({ where: { id: payment.orderId }, data: { status: 'ESCROWED' } }),
            prisma.escrow.upsert({
              where: { orderId: payment.orderId },
              update: { status: 'HELD' },
              create: { orderId: payment.orderId, amount: payment.amount, status: 'HELD' },
            }),
          ]);

          await createNotification(payment.order.buyerId, 'PAYMENT_ESCROWED', 'Payment in Escrow',
            `Your payment of MK ${Number(payment.amount).toLocaleString()} is safely held in escrow.`,
            { orderId: payment.orderId });

          await createNotification(payment.order.sellerId, 'ORDER_PLACED', 'New Paid Order',
            `Payment received and held in escrow for your order.`, { orderId: payment.orderId });
        } else if (finalStatus === 'FAILED') {
          await prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED' } });
          await prisma.order.update({ where: { id: payment.orderId }, data: { status: 'PENDING' } });
        }
      } catch {}
    }

    res.json({ success: true, status: finalStatus, payment });
  } catch (err) { next(err); }
};

// GET /payments/escrow/:orderId
exports.getEscrowStatus = async (req, res, next) => {
  try {
    const escrow = await prisma.escrow.findUnique({ where: { orderId: req.params.orderId } });
    res.json({ success: true, escrow });
  } catch (err) { next(err); }
};

// POST /payments/escrow/:orderId/release
exports.releaseEscrow = async (req, res, next) => {
  try {
    const escrow = await prisma.escrow.findUnique({ where: { orderId: req.params.orderId } });
    if (!escrow) return res.status(404).json({ error: 'Escrow not found' });
    if (escrow.status !== 'HELD') return res.status(400).json({ error: 'Escrow already released or refunded' });

    await prisma.escrow.update({ where: { id: escrow.id }, data: { status: 'RELEASED', releasedAt: new Date() } });
    res.json({ success: true, message: 'Escrow released' });
  } catch (err) { next(err); }
};

// POST /payments/escrow/:orderId/refund
exports.refundEscrow = async (req, res, next) => {
  try {
    const escrow = await prisma.escrow.findUnique({ where: { orderId: req.params.orderId }, include: { order: true } });
    if (!escrow) return res.status(404).json({ error: 'Escrow not found' });

    await prisma.$transaction([
      prisma.escrow.update({ where: { id: escrow.id }, data: { status: 'REFUNDED', refundedAt: new Date() } }),
      prisma.order.update({ where: { id: escrow.orderId }, data: { status: 'REFUNDED' } }),
    ]);

    await createNotification(escrow.order.buyerId, 'REFUND_ISSUED', 'Refund Issued',
      `A refund of MK ${Number(escrow.amount).toLocaleString()} has been processed.`, { orderId: escrow.orderId });

    res.json({ success: true, message: 'Refund processed' });
  } catch (err) { next(err); }
};

// GET /payments/history
exports.getHistory = async (req, res, next) => {
  try {
    const payments = await prisma.payment.findMany({
      where: { userId: req.user.id },
      orderBy: { initiatedAt: 'desc' },
      include: { order: { select: { id: true, status: true } } },
    });
    res.json({ success: true, payments });
  } catch (err) { next(err); }
};
