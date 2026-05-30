// errorMiddleware.js
const logger = require('../utils/logger');

exports.notFound = (req, res) => {
  res.status(404).json({ error: `Route ${req.originalUrl} not found` });
};

exports.errorHandler = (err, req, res, next) => {
  logger.error(`${err.message} — ${req.method} ${req.path}`);

  if (err.code === 'P2002') return res.status(409).json({ error: 'Record already exists' });
  if (err.code === 'P2025') return res.status(404).json({ error: 'Record not found' });

  const status = err.status || err.statusCode || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
};
