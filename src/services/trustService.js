const prisma = require('../config/database');

/**
 * Recalculate and save a user's trust score.
 */
exports.recalcTrustScore = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      verification: true,
      sellerOrders: { where: { status: 'COMPLETED' } },
      reviewsReceived: { select: { rating: true } },
      reportedIn: { where: { status: { in: ['PENDING', 'UNDER_REVIEW'] } } },
    },
  });

  if (!user) return 0;

  let score = 10; // base

  // Verification bonuses
  if (user.verificationLevel === 'VERIFIED') score += 25;
  if (user.verificationLevel === 'TRUSTED') score += 40;
  if (user.verification?.selfieUrl) score += 10;

  // Order history
  const completedOrders = user.sellerOrders.length;
  score += Math.min(completedOrders * 2, 20);

  // Ratings
  if (user.reviewsReceived.length > 0) {
    const avg = user.reviewsReceived.reduce((s, r) => s + r.rating, 0) / user.reviewsReceived.length;
    score += Math.round(avg * 2); // max 10
  }

  // Penalty for active reports
  if (user.reportedIn.length > 0) score -= user.reportedIn.length * 5;

  // Account age bonus
  const ageDays = (Date.now() - new Date(user.createdAt)) / 86400000;
  if (ageDays > 180) score += 5;
  if (ageDays > 365) score += 5;

  score = Math.max(0, Math.min(100, score));

  await prisma.user.update({ where: { id: userId }, data: { trustScore: score } });

  // Auto-upgrade to TRUSTED if eligible
  if (score >= 70 && completedOrders >= 10 && user.verificationLevel === 'VERIFIED') {
    await prisma.user.update({ where: { id: userId }, data: { verificationLevel: 'TRUSTED' } });
  }

  return score;
};

exports.generateTrustScore = exports.recalcTrustScore;
