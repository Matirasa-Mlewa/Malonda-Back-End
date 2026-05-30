const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const prisma = require('../config/database');
const { sendOtpSms } = require('../services/smsService');
const { generateTrustScore } = require('../services/trustService');
const logger = require('../utils/logger');

const generateTokens = (userId) => {
  const accessToken = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
  const refreshToken = jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, { expiresIn: '30d' });
  return { accessToken, refreshToken };
};

// POST /auth/send-otp
exports.sendOtp = async (req, res, next) => {
  try {
    const { phone } = req.body;
    const normalizedPhone = phone.startsWith('+') ? phone : `+265${phone.replace(/^0/, '')}`;

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    // Invalidate old codes for this phone
    await prisma.otpCode.updateMany({ where: { phone: normalizedPhone, used: false }, data: { used: true } });

    await prisma.otpCode.create({ data: { phone: normalizedPhone, code, expiresAt } });

    await sendOtpSms(normalizedPhone, code);

    res.json({ success: true, message: 'OTP sent successfully' });
  } catch (err) {
    next(err);
  }
};

// POST /auth/verify-otp
exports.verifyOtp = async (req, res, next) => {
  try {
    const { phone, otp } = req.body;
    const normalizedPhone = phone.startsWith('+') ? phone : `+265${phone.replace(/^0/, '')}`;

    const record = await prisma.otpCode.findFirst({
      where: { phone: normalizedPhone, code: otp, used: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) return res.status(400).json({ error: 'Invalid or expired OTP' });

    await prisma.otpCode.update({ where: { id: record.id }, data: { used: true } });

    res.json({ success: true, message: 'OTP verified' });
  } catch (err) {
    next(err);
  }
};

// POST /auth/register
exports.register = async (req, res, next) => {
  try {
    const { name, phone, password, location, district } = req.body;
    const normalizedPhone = phone.startsWith('+') ? phone : `+265${phone.replace(/^0/, '')}`;

    const existing = await prisma.user.findUnique({ where: { phone: normalizedPhone } });
    if (existing) return res.status(409).json({ error: 'Phone number already registered' });

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        phone: normalizedPhone, name, passwordHash,
        location: location || null, district: district || null,
        trustScore: 10,
      },
    });

    const { accessToken, refreshToken } = generateTokens(user.id);

    res.status(201).json({
      success: true,
      token: accessToken,
      refreshToken,
      user: {
        id: user.id, name: user.name, phone: user.phone,
        role: user.role, verificationLevel: user.verificationLevel,
        isSeller: user.isSeller, trustScore: user.trustScore,
        location: user.location,
      },
    });
  } catch (err) {
    next(err);
  }
};

// POST /auth/login
exports.login = async (req, res, next) => {
  try {
    const { phone, password } = req.body;
    const normalizedPhone = phone.startsWith('+') ? phone : `+265${phone.replace(/^0/, '')}`;

    const user = await prisma.user.findUnique({ where: { phone: normalizedPhone } });
    if (!user) return res.status(401).json({ error: 'Invalid phone or password' });
    if (user.isSuspended) return res.status(403).json({ error: 'Account suspended. Contact support.' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid phone or password' });

    const { accessToken, refreshToken } = generateTokens(user.id);

    res.json({
      success: true,
      token: accessToken,
      refreshToken,
      user: {
        id: user.id, name: user.name, phone: user.phone,
        role: user.role, verificationLevel: user.verificationLevel,
        isSeller: user.isSeller, trustScore: user.trustScore,
        location: user.location, avatarUrl: user.avatarUrl,
      },
    });
  } catch (err) {
    next(err);
  }
};

// POST /auth/logout
exports.logout = async (req, res) => {
  res.json({ success: true, message: 'Logged out' });
};

// POST /auth/refresh
exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).json({ error: 'Refresh token required' });

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) return res.status(401).json({ error: 'User not found' });

    const tokens = generateTokens(user.id);
    res.json({ success: true, ...tokens });
  } catch (err) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
};

// GET /auth/me
exports.getMe = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true, name: true, phone: true, role: true,
        verificationLevel: true, isSeller: true, trustScore: true,
        location: true, district: true, avatarUrl: true,
        createdAt: true,
        _count: { select: { buyerOrders: true, products: true, reviewsReceived: true } },
      },
    });
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
};
