// admin.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/adminController');
const { authenticate, requireAdmin } = require('../middleware/authMiddleware');

router.use(authenticate, requireAdmin);
router.get('/stats', ctrl.getDashboardStats);
router.get('/reports', ctrl.getReports);
router.post('/reports/:id/resolve', ctrl.resolveReport);
router.get('/verifications/pending', ctrl.getPendingVerifications);
router.post('/verifications/:userId/approve', ctrl.approveVerification);
router.post('/verifications/:userId/reject', ctrl.rejectVerification);
router.post('/users/:userId/suspend', ctrl.suspendUser);
router.post('/users/:userId/unsuspend', ctrl.unsuspendUser);
router.get('/disputes', ctrl.getDisputes);
router.post('/disputes/:id/resolve', ctrl.resolveDispute);
router.get('/transactions', ctrl.getTransactions);

module.exports = router;
