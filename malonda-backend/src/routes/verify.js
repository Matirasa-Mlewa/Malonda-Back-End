const express = require('express');
const router = express.Router();
const prisma = require('../config/database');
const { authenticate } = require('../middleware/authMiddleware');
const { uploadImage } = require('../services/storageService');
const upload = require('../middleware/upload');

router.post('/national-id', authenticate, upload.fields([{ name: 'front', maxCount: 1 }, { name: 'back', maxCount: 1 }]), async (req, res, next) => {
  try {
    const { nationalIdNo } = req.body;
    const frontFile = req.files?.front?.[0];
    const backFile = req.files?.back?.[0];

    let nationalIdUrl = null, nationalIdBack = null;
    if (frontFile) { const r = await uploadImage(frontFile.buffer, 'malonda/id'); nationalIdUrl = r.url; }
    if (backFile) { const r = await uploadImage(backFile.buffer, 'malonda/id'); nationalIdBack = r.url; }

    await prisma.verification.upsert({
      where: { userId: req.user.id },
      update: { nationalIdUrl, nationalIdBack, nationalIdNo, status: 'PENDING', submittedAt: new Date() },
      create: { userId: req.user.id, nationalIdUrl, nationalIdBack, nationalIdNo, status: 'PENDING' },
    });

    res.json({ success: true, message: 'National ID submitted for review' });
  } catch (err) { next(err); }
});

router.post('/selfie', authenticate, upload.single('selfie'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No selfie provided' });
    const result = await uploadImage(req.file.buffer, 'malonda/selfies');

    await prisma.verification.upsert({
      where: { userId: req.user.id },
      update: { selfieUrl: result.url, status: 'PENDING', submittedAt: new Date() },
      create: { userId: req.user.id, selfieUrl: result.url, status: 'PENDING' },
    });

    res.json({ success: true, message: 'Selfie submitted for review' });
  } catch (err) { next(err); }
});

router.get('/status', authenticate, async (req, res, next) => {
  try {
    const verification = await prisma.verification.findUnique({ where: { userId: req.user.id } });
    res.json({ success: true, verification });
  } catch (err) { next(err); }
});

module.exports = router;
