const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

// ─── Airtel Money (Malawi) ─────────────────────────────────────────────────────
const AIRTEL_BASE = 'https://openapi.airtel.africa';

async function getAirtelToken() {
  const res = await axios.post(`${AIRTEL_BASE}/auth/oauth2/token`, {
    client_id: process.env.AIRTEL_CLIENT_ID,
    client_secret: process.env.AIRTEL_CLIENT_SECRET,
    grant_type: 'client_credentials',
  });
  return res.data.access_token;
}

exports.initiateAirtelMoney = async (phone, amount, orderId) => {
  if (process.env.NODE_ENV !== 'production') {
    logger.info(`[DEV] Airtel Money STK push to ${phone} for MK ${amount} (order ${orderId})`);
    return { transactionId: 'DEV-' + uuidv4(), reference: 'DEV-REF-' + Date.now() };
  }

  try {
    const token = await getAirtelToken();
    const reference = `MALONDA-${orderId.slice(-8).toUpperCase()}`;

    const res = await axios.post(
      `${AIRTEL_BASE}/merchant/v1/payments/`,
      {
        reference,
        subscriber: { country: 'MW', currency: 'MWK', msisdn: phone.replace('+', '') },
        transaction: { amount, country: 'MW', currency: 'MWK', id: reference },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Country': 'MW',
          'X-Currency': 'MWK',
        },
      }
    );

    return { transactionId: res.data.data?.transaction?.id, reference };
  } catch (err) {
    logger.error('Airtel Money initiation failed:', err.response?.data || err.message);
    throw new Error('Airtel Money payment failed. Please try again.');
  }
};

// ─── TNM Mpamba ────────────────────────────────────────────────────────────────
const TNM_BASE = process.env.TNM_API_URL || 'https://api.tnmmpamba.co.mw/v1';

exports.initiateTNMMpamba = async (phone, amount, orderId) => {
  if (process.env.NODE_ENV !== 'production') {
    logger.info(`[DEV] TNM Mpamba push to ${phone} for MK ${amount} (order ${orderId})`);
    return { transactionId: 'DEV-' + uuidv4(), reference: 'DEV-TNM-' + Date.now() };
  }

  try {
    const reference = `MALONDA-${orderId.slice(-8).toUpperCase()}`;
    const res = await axios.post(
      `${TNM_BASE}/payments/collect`,
      { phone, amount, currency: 'MWK', reference, description: `Malonda order payment` },
      {
        headers: {
          Authorization: `Bearer ${process.env.TNM_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return { transactionId: res.data.transactionId, reference };
  } catch (err) {
    logger.error('TNM Mpamba initiation failed:', err.response?.data || err.message);
    throw new Error('TNM Mpamba payment failed. Please try again.');
  }
};

// ─── Check Payment Status ──────────────────────────────────────────────────────
exports.checkPaymentStatus = async (method, reference) => {
  if (process.env.NODE_ENV !== 'production') {
    // Simulate success in dev after 1 poll
    return { success: true, failed: false };
  }

  try {
    if (method === 'AIRTEL_MONEY') {
      const token = await getAirtelToken();
      const res = await axios.get(`${AIRTEL_BASE}/standard/v1/payments/${reference}`, {
        headers: { Authorization: `Bearer ${token}`, 'X-Country': 'MW', 'X-Currency': 'MWK' },
      });
      const status = res.data.data?.transaction?.status;
      return { success: status === 'TS', failed: status === 'TF' };
    }

    if (method === 'TNM_MPAMBA') {
      const res = await axios.get(`${TNM_BASE}/payments/${reference}`, {
        headers: { Authorization: `Bearer ${process.env.TNM_API_KEY}` },
      });
      return { success: res.data.status === 'SUCCESS', failed: res.data.status === 'FAILED' };
    }
  } catch (err) {
    logger.error('Payment status check failed:', err.message);
    return { success: false, failed: false };
  }
};
