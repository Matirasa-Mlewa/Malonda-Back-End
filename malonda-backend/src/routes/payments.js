// payments.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/paymentController');
const { authenticate } = require('../middleware/authMiddleware');

router.post('/initiate', authenticate, ctrl.initiate);
router.get('/verify/:transactionId', authenticate, ctrl.verify);
router.get('/escrow/:orderId', authenticate, ctrl.getEscrowStatus);
router.post('/escrow/:orderId/release', authenticate, ctrl.releaseEscrow);
router.post('/escrow/:orderId/refund', authenticate, ctrl.refundEscrow);
router.get('/history', authenticate, ctrl.getHistory);

module.exports = router;
