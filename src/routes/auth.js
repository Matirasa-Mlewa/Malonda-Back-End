const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');

// Rate limiters
const otpLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 5, message: { error: 'Too many OTP requests' } });
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { error: 'Too many login attempts' } });

// POST /auth/send-otp
router.post('/send-otp',
  otpLimiter,
  [body('phone').notEmpty().isMobilePhone()],
  validate,
  authController.sendOtp
);

// POST /auth/verify-otp
router.post('/verify-otp',
  [body('phone').notEmpty(), body('otp').isLength({ min: 6, max: 6 })],
  validate,
  authController.verifyOtp
);

// POST /auth/register
router.post('/register',
  [
    body('name').notEmpty().trim().isLength({ min: 2, max: 100 }),
    body('phone').notEmpty().isMobilePhone(),
    body('password').isLength({ min: 8 }),
    body('location').optional(),
  ],
  validate,
  authController.register
);

// POST /auth/login
router.post('/login',
  loginLimiter,
  [body('phone').notEmpty(), body('password').notEmpty()],
  validate,
  authController.login
);

// POST /auth/logout
router.post('/logout', authenticate, authController.logout);

// POST /auth/refresh
router.post('/refresh', authController.refreshToken);

// GET /auth/me
router.get('/me', authenticate, authController.getMe);

module.exports = router;
