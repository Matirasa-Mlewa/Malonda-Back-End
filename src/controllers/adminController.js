const prisma = require('../config/database');
const { createNotification } = require('../services/notificationService');
const { recalcTrustScore } = require('../services/trustService');

// GET /admin/stats
exports.getDashboardStats = async (req, res, next) => {
  try {
    const [users, products, orders, reports, escrowHeld] = await Promise.all([
      prisma.user.count(),
      prisma.product.count({ where: { status: 'ACTIVE' } }),
      prisma.order.count(),
      prisma.report.count({ where: { status: 'PENDING' } }),
      prisma.escrow.aggregate({ where: { status: 'HELD' }, _sum: { amount: true }, _count: true }),
    ]);
    res.json({ success: true, stats: { users, products, orders, pendingReports: reports, escrowHeld: { amount: escrowHeld._sum.amount, count: escrowHeld._count } } });
  } catch (err) { next(err); }
};

// GET /admin/reports
exports.getReports = async (req, res, next) => {
  try {
    const { status } = req.query;
    const reports = await prisma.report.findMany({
      where: status ? { status } : {},
      include: {
        reporter: { select: { name: true, phone: true } },
        reported: { select: { name: true, phone: true, verificationLevel: true, isSuspended: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, reports });
  } catch (err) { next(err); }
};

// POST /admin/reports/:id/resolve
exports.resolveReport = async (req, res, next) => {
  try {
    const { action, note } = req.body; // action: 'suspend' | 'warn' | 'dismiss'
    const report = await prisma.report.findUnique({ where: { id: req.params.id } });
    if (!report) return res.status(404).json({ error: 'Report not found' });

    await prisma.report.update({
      where: { id: report.id },
      data: { status: action === 'dismiss' ? 'DISMISSED' : 'RESOLVED', resolution: note, reviewedBy: req.user.id, resolvedAt: new Date() },
    });

    if (action === 'suspend') {
      await prisma.user.update({ where: { id: report.reportedId }, data: { isSuspended: true } });
      await createNotification(report.reportedId, 'DISPUTE_RESOLVED', 'Account Suspended',
        'Your account has been suspended due to a policy violation. Contact support to appeal.', {});
    }

    res.json({ success: true, message: 'Report resolved' });
  } catch (err) { next(err); }
};

// GET /admin/verifications/pending
exports.getPendingVerifications = async (req, res, next) => {
  try {
    const verifications = await prisma.verification.findMany({
      where: { status: 'PENDING' },
      include: { user: { select: { id: true, name: true, phone: true, verificationLevel: true } } },
      orderBy: { submittedAt: 'asc' },
    });
    res.json({ success: true, verifications });
  } catch (err) { next(err); }
};

// POST /admin/verifications/:userId/approve
exports.approveVerification = async (req, res, next) => {
  try {
    const { userId } = req.params;
    await prisma.$transaction([
      prisma.verification.update({ where: { userId }, data: { status: 'APPROVED', reviewedBy: req.user.id, reviewedAt: new Date() } }),
      prisma.user.update({ where: { id: userId }, data: { verificationLevel: 'VERIFIED' } }),
    ]);
    await recalcTrustScore(userId);
    await createNotification(userId, 'VERIFICATION_APPROVED', 'ID Verified! ✓',
      'Congratulations! Your identity has been verified. You now have the Verified badge.', {});
    res.json({ success: true, message: 'Verification approved' });
  } catch (err) { next(err); }
};

// POST /admin/verifications/:userId/reject
exports.rejectVerification = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;
    await prisma.verification.update({ where: { userId }, data: { status: 'REJECTED', reviewedBy: req.user.id, reviewNote: reason, reviewedAt: new Date() } });
    await createNotification(userId, 'VERIFICATION_REJECTED', 'Verification Rejected',
      `Your ID verification was rejected. Reason: ${reason || 'Documents unclear'}. Please resubmit.`, {});
    res.json({ success: true, message: 'Verification rejected' });
  } catch (err) { next(err); }
};

// POST /admin/users/:userId/suspend
exports.suspendUser = async (req, res, next) => {
  try {
    const { reason } = req.body;
    await prisma.user.update({ where: { id: req.params.userId }, data: { isSuspended: true } });
    await createNotification(req.params.userId, 'DISPUTE_RESOLVED', 'Account Suspended', reason || 'Your account has been suspended.', {});
    res.json({ success: true, message: 'User suspended' });
  } catch (err) { next(err); }
};

// POST /admin/users/:userId/unsuspend
exports.unsuspendUser = async (req, res, next) => {
  try {
    await prisma.user.update({ where: { id: req.params.userId }, data: { isSuspended: false } });
    res.json({ success: true, message: 'User unsuspended' });
  } catch (err) { next(err); }
};

// GET /admin/disputes
exports.getDisputes = async (req, res, next) => {
  try {
    const disputes = await prisma.order.findMany({
      where: { status: 'DISPUTED' },
      include: {
        buyer: { select: { name: true, phone: true } },
        seller: { select: { name: true, phone: true } },
        escrow: true,
        items: { include: { product: { select: { name: true } } } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    res.json({ success: true, disputes });
  } catch (err) { next(err); }
};

// POST /admin/disputes/:id/resolve
exports.resolveDispute = async (req, res, next) => {
  try {
    const { decision, note } = req.body; // decision: 'release' | 'refund'
    const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { escrow: true } });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const newStatus = decision === 'release' ? 'COMPLETED' : 'REFUNDED';
    const escrowStatus = decision === 'release' ? 'RELEASED' : 'REFUNDED';
    const escrowField = decision === 'release' ? { releasedAt: new Date() } : { refundedAt: new Date() };

    await prisma.$transaction([
      prisma.order.update({ where: { id: order.id }, data: { status: newStatus } }),
      prisma.escrow.update({ where: { orderId: order.id }, data: { status: escrowStatus, ...escrowField } }),
    ]);

    const notifyId = decision === 'release' ? order.sellerId : order.buyerId;
    const notifyTitle = decision === 'release' ? 'Payment Released' : 'Refund Processed';
    const notifyBody = decision === 'release'
      ? 'Dispute resolved in your favour. Payment has been released.'
      : 'Dispute resolved. A refund has been issued to the buyer.';
    await createNotification(notifyId, 'DISPUTE_RESOLVED', notifyTitle, notifyBody, { orderId: order.id });

    res.json({ success: true, message: `Dispute resolved — ${decision === 'release' ? 'payment released to seller' : 'refund issued to buyer'}` });
  } catch (err) { next(err); }
};

// GET /admin/transactions
exports.getTransactions = async (req, res, next) => {
  try {
    const { status, page = 1 } = req.query;
    const payments = await prisma.payment.findMany({
      where: status ? { status } : {},
      include: { user: { select: { name: true, phone: true } }, order: { select: { status: true } } },
      orderBy: { initiatedAt: 'desc' },
      skip: (Number(page) - 1) * 20, take: 20,
    });
    res.json({ success: true, payments });
  } catch (err) { next(err); }
};
