const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/orderController');
const { authenticate } = require('../middleware/authMiddleware');

router.post('/', authenticate, ctrl.create);
router.get('/', authenticate, ctrl.getAll);
router.get('/:id', authenticate, ctrl.getById);
router.post('/:id/confirm', authenticate, ctrl.confirmDelivery);
router.post('/:id/dispute', authenticate, ctrl.openDispute);
router.post('/:id/cancel', authenticate, ctrl.cancel);

module.exports = router;
