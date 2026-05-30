const AfricasTalking = require('africastalking');
const logger = require('../utils/logger');

const at = AfricasTalking({
  apiKey: process.env.AT_API_KEY,
  username: process.env.AT_USERNAME,
});

const sms = at.SMS;

/**
 * Send OTP via Africa's Talking SMS.
 */
exports.sendOtpSms = async (phone, code) => {
  // In development, just log the OTP
  if (process.env.NODE_ENV !== 'production') {
    logger.info(`[DEV] OTP for ${phone}: ${code}`);
    return { success: true };
  }

  try {
    const result = await sms.send({
      to: [phone],
      message: `Your Malonda verification code is: ${code}\n\nValid for 10 minutes. Do not share this code.\n\nMalonda - Trusted Buying & Selling in Malawi`,
      from: process.env.AT_SENDER_ID || 'MALONDA',
    });
    logger.info(`OTP sent to ${phone}`, result);
    return { success: true, result };
  } catch (err) {
    logger.error(`Failed to send OTP to ${phone}:`, err.message);
    throw new Error('Failed to send OTP. Please try again.');
  }
};

/**
 * Send order notification SMS.
 */
exports.sendOrderSms = async (phone, message) => {
  if (process.env.NODE_ENV !== 'production') {
    logger.info(`[DEV] SMS to ${phone}: ${message}`);
    return;
  }
  try {
    await sms.send({ to: [phone], message, from: process.env.AT_SENDER_ID || 'MALONDA' });
  } catch (err) {
    logger.error('SMS send failed:', err.message);
  }
};
