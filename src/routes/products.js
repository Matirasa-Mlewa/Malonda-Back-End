// products.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/productController');
const { authenticate, optionalAuth } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');

router.get('/', optionalAuth, ctrl.getAll);
router.get('/search', optionalAuth, ctrl.search);
router.get('/seller/:sellerId', ctrl.getBySeller);
router.get('/:id', optionalAuth, ctrl.getById);
router.post('/', authenticate, upload.array('images', 6), ctrl.create);
router.put('/:id', authenticate, ctrl.update);
router.delete('/:id', authenticate, ctrl.delete);

module.exports = router;
