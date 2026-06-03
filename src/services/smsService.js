const { Vonage } = require('@vonage/server-sdk');
const logger = require('../utils/logger');

// Vonage (formerly Nexmo) — supports SMS to Malawi via +265 numbers
// Sign up free at: https://dashboard.nexmo.com
const vonage = new Vonage({
  apiKey:    process.env.VONAGE_API_KEY    || '',
  apiSecret: process.env.VONAGE_API_SECRET || '',
});

/**
 * Send OTP via Vonage SMS.
 * In development (NODE_ENV !== 'production'), OTP is only printed to terminal.
 */
exports.sendOtpSms = async (phone, code) => {
  if (process.env.NODE_ENV !== 'production') {
    logger.info(`[DEV] OTP for ${phone}: ${code}`);
    return { success: true };
  }

  if (!process.env.VONAGE_API_KEY || !process.env.VONAGE_API_SECRET) {
    logger.warn('Vonage credentials not set — OTP not sent. Set VONAGE_API_KEY and VONAGE_API_SECRET.');
    logger.info(`[FALLBACK] OTP for ${phone}: ${code}`);
    return { success: true };
  }

  try {
    await vonage.sms.send({
      to: phone.replace('+', ''),
      from: process.env.VONAGE_SENDER_ID || 'MALONDA',
      text: `Your Malonda verification code is: ${code}\n\nValid for 10 minutes. Do not share this code.\n\nMalonda - Trusted Buying & Selling in Malawi`,
    });
    logger.info(`OTP sent to ${phone} via Vonage`);
    return { success: true };
  } catch (err) {
    logger.error(`Failed to send OTP to ${phone}:`, err.message);
    throw new Error('Failed to send OTP. Please try again.');
  }
};

/**
 * Send a general SMS notification.
 */
exports.sendSms = async (phone, message) => {
  if (process.env.NODE_ENV !== 'production') {
    logger.info(`[DEV] SMS to ${phone}: ${message}`);
    return;
  }
  try {
    await vonage.sms.send({
      to: phone.replace('+', ''),
      from: process.env.VONAGE_SENDER_ID || 'MALONDA',
      text: message,
    });
  } catch (err) {
    logger.error('SMS send failed:', err.message);
  }
};
