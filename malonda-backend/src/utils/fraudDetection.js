const FRAUD_KEYWORDS = [
  'send money outside', 'pay me directly', 'western union', 'world remit',
  'bank transfer', 'my bank account', 'send airtime', 'whatsapp me',
  'telegram', 'deal outside', 'pay now then i ship', 'click this link',
  'paypal', 'share your password', 'otp code', 'pin number',
  'send me your pin', 'verification code', 'i will send first',
];

const PHONE_REGEX = /(\+?265|0)\s?[89][0-9]\s?[0-9]{3}\s?[0-9]{4}/;
const LINK_REGEX = /https?:\/\/[^\s]+/i;

exports.detectFraud = (message) => {
  const lower = (message || '').toLowerCase();

  if (PHONE_REGEX.test(message)) {
    return { isSuspicious: true, reason: 'Phone number sharing detected', severity: 'medium' };
  }
  if (LINK_REGEX.test(message)) {
    return { isSuspicious: true, reason: 'External link detected', severity: 'high' };
  }
  const kw = FRAUD_KEYWORDS.find(k => lower.includes(k));
  if (kw) {
    return { isSuspicious: true, reason: `Suspicious keyword: "${kw}"`, severity: 'high' };
  }
  return { isSuspicious: false, reason: null, severity: 'low' };
};
