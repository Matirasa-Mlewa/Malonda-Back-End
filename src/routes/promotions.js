const express = require('express');
const router = express.Router();
const prisma = require('../config/database');
const { authenticate } = require('../middleware/authMiddleware');

router.post('/validate', authenticate, async (req, res, next) => {
  try {
    const { code, cartTotal } = req.body;
    const promo = await prisma.promotion.findUnique({ where: { code: code.toUpperCase(), isActive: true } });
    if (!promo) return res.status(404).json({ error: 'Invalid promo code' });
    if (promo.expiresAt && promo.expiresAt < new Date()) return res.status(400).json({ error: 'Promo code expired' });
    if (promo.maxUses && promo.usedCount >= promo.maxUses) return res.status(400).json({ error: 'Promo code limit reached' });
    if (promo.minOrderAmount && cartTotal < Number(promo.minOrderAmount)) return res.status(400).json({ error: `Minimum order MK ${Number(promo.minOrderAmount).toLocaleString()} required` });

    const discount = promo.discountType === 'PERCENTAGE'
      ? Math.round(cartTotal * (Number(promo.discountValue) / 100))
      : Number(promo.discountValue);

    res.json({ success: true, discount, code: promo.code, type: promo.discountType });
  } catch (err) { next(err); }
});

router.get('/active', async (req, res, next) => {
  try {
    const promos = await prisma.promotion.findMany({ where: { isActive: true }, select: { code: true, discountType: true, discountValue: true, expiresAt: true } });
    res.json({ success: true, promos });
  } catch (err) { next(err); }
});

module.exports = router;
