// Add this route to malonda-backend/src/routes/admin.js
// This route was missing — it fetches all users for the admin panel

const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/adminController');
const { authenticate, requireAdmin } = require('../middleware/authMiddleware');
const prisma  = require('../config/database');

router.use(authenticate, requireAdmin);

router.get('/stats',  ctrl.getDashboardStats);
router.get('/reports', ctrl.getReports);
router.post('/reports/:id/resolve', ctrl.resolveReport);
router.get('/verifications/pending', ctrl.getPendingVerifications);
router.post('/verifications/:userId/approve', ctrl.approveVerification);
router.post('/verifications/:userId/reject',  ctrl.rejectVerification);
router.get('/users',  async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, name: true, phone: true, role: true,
        verificationLevel: true, isSeller: true, isSuspended: true,
        trustScore: true, location: true, createdAt: true,
        _count: { select: { buyerOrders: true, products: true } },
      },
    });
    res.json({ success: true, users });
  } catch (err) { next(err); }
});
router.post('/users/:userId/suspend',   ctrl.suspendUser);
router.post('/users/:userId/unsuspend', ctrl.unsuspendUser);
router.get('/disputes',  ctrl.getDisputes);
router.post('/disputes/:id/resolve', ctrl.resolveDispute);
router.get('/transactions', ctrl.getTransactions);

module.exports = router;
