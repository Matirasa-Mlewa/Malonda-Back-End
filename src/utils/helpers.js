/**
 * Calculate Malonda platform fee (2%).
 */
exports.calculateFee = (amount) => Math.round(Number(amount) * 0.02);

/**
 * Format MWK amount.
 */
exports.formatMWK = (amount) => `MK ${Number(amount).toLocaleString()}`;

/**
 * Normalize a Malawi phone number to E.164 format.
 */
exports.normalizePhone = (phone) => {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('265')) return `+${digits}`;
  if (digits.startsWith('0')) return `+265${digits.slice(1)}`;
  return `+265${digits}`;
};

/**
 * Generate a short human-readable order reference.
 */
exports.shortRef = (id) => id.slice(-6).toUpperCase();

/**
 * Paginate helper.
 */
exports.paginate = (page = 1, limit = 20) => ({
  skip: (Number(page) - 1) * Number(limit),
  take: Number(limit),
});
