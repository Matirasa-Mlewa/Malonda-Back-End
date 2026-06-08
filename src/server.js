require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

const { setupSocket } = require('./services/socketService');
const { errorHandler, notFound } = require('./middleware/errorMiddleware');
const logger = require('./utils/logger');

// Route imports
const authRoutes         = require('./routes/auth');
const userRoutes         = require('./routes/users');
const productRoutes      = require('./routes/products');
const orderRoutes        = require('./routes/orders');
const paymentRoutes      = require('./routes/payments');
const chatRoutes         = require('./routes/chat');
const reviewRoutes       = require('./routes/reviews');
const notificationRoutes = require('./routes/notifications');
const adminRoutes        = require('./routes/admin');
const deliveryRoutes     = require('./routes/delivery');
const promotionRoutes    = require('./routes/promotions');
const verifyRoutes       = require('./routes/verify');
const sellerRoutes       = require('./routes/seller');

const app    = express();
const server = http.createServer(app);

// ─── Allowed origins (frontend + admin panel + localhost) ─────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.ADMIN_URL,
  'http://localhost:3000',
  'http://localhost:3001',
].filter(Boolean);

// ─── Security & Parsing ───────────────────────────────────────────────────────
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    logger.warn(`CORS blocked: ${origin}`);
    return callback(new Error(`CORS policy: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(morgan('combined', { stream: { write: msg => logger.info(msg.trim()) } }));

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) =>
  res.json({ status: 'ok', service: 'Malonda App API', version: '1.0.0', env: process.env.NODE_ENV })
);

// ─── API Routes ───────────────────────────────────────────────────────────────
const API = '/api/v1';
app.use(`${API}/auth`,          authRoutes);
app.use(`${API}/users`,         userRoutes);
app.use(`${API}/products`,      productRoutes);
app.use(`${API}/orders`,        orderRoutes);
app.use(`${API}/payments`,      paymentRoutes);
app.use(`${API}/chat`,          chatRoutes);
app.use(`${API}/reviews`,       reviewRoutes);
app.use(`${API}/notifications`, notificationRoutes);
app.use(`${API}/admin`,         adminRoutes);
app.use(`${API}/delivery`,      deliveryRoutes);
app.use(`${API}/promotions`,    promotionRoutes);
app.use(`${API}/verify`,        verifyRoutes);
app.use(`${API}/seller`,        sellerRoutes);

// ─── Error Handling ───────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ─── Socket.io ────────────────────────────────────────────────────────────────
setupSocket(server);

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  logger.info(`🚀 Malonda App API running on port ${PORT}`);
  logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`✅ Allowed origins: ${allowedOrigins.join(', ')}`);
});

module.exports = { app, server };
