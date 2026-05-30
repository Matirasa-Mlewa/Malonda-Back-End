const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Malonda database...');

  // Admin user
  const adminHash = await bcrypt.hash('Admin@Malonda2024', 10);
  const admin = await prisma.user.upsert({
    where: { phone: '+265888000001' },
    update: {},
    create: {
      phone: '+265888000001',
      name: 'Malonda Admin',
      passwordHash: adminHash,
      role: 'ADMIN',
      verificationLevel: 'TRUSTED',
      isSeller: false,
      trustScore: 100,
      location: 'Lilongwe',
      district: 'Lilongwe',
    },
  });

  // Verified seller
  const sellerHash = await bcrypt.hash('Seller@123', 10);
  const seller = await prisma.user.upsert({
    where: { phone: '+265999876543' },
    update: {},
    create: {
      phone: '+265999876543',
      name: 'John Phiri',
      passwordHash: sellerHash,
      role: 'SELLER',
      verificationLevel: 'TRUSTED',
      isSeller: true,
      trustScore: 88,
      location: 'Lilongwe, Area 18',
      district: 'Lilongwe',
    },
  });

  // Sample buyer
  const buyerHash = await bcrypt.hash('Buyer@123', 10);
  const buyer = await prisma.user.upsert({
    where: { phone: '+265881234567' },
    update: {},
    create: {
      phone: '+265881234567',
      name: 'Chisomo Banda',
      passwordHash: buyerHash,
      role: 'BUYER',
      verificationLevel: 'VERIFIED',
      isSeller: false,
      trustScore: 72,
      location: 'Lilongwe, Area 25',
      district: 'Lilongwe',
    },
  });

  // Sample products
  const products = [
    {
      sellerId: seller.id,
      name: 'Tecno Spark 10',
      description: 'Brand new Tecno Spark 10, 6.6" screen, 128GB, 5000mAh battery. Sealed box with receipt.',
      price: 75000,
      quantity: 3,
      category: 'Electronics',
      location: 'Lilongwe, Area 18',
      district: 'Lilongwe',
      escrowEnabled: true,
      deliveryMethod: 'LOCAL_DELIVERY',
      deliveryNote: 'Delivery within Lilongwe MK 500',
    },
    {
      sellerId: seller.id,
      name: 'Wooden Dining Table',
      description: 'Handcrafted solid mahogany dining table, seats 6. Delivery included in Lilongwe.',
      price: 95000,
      quantity: 1,
      category: 'Furniture',
      location: 'Lilongwe, Area 3',
      district: 'Lilongwe',
      escrowEnabled: true,
      deliveryMethod: 'LOCAL_DELIVERY',
      deliveryNote: 'Free delivery in Lilongwe',
    },
  ];

  for (const p of products) {
    await prisma.product.create({ data: p });
  }

  // Promo code
  await prisma.promotion.upsert({
    where: { code: 'MALONDA10' },
    update: {},
    create: {
      code: 'MALONDA10',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      minOrderAmount: 5000,
      maxUses: 1000,
      isActive: true,
    },
  });

  console.log('✅ Seed complete!');
  console.log('   Admin: +265888000001 / Admin@Malonda2024');
  console.log('   Seller: +265999876543 / Seller@123');
  console.log('   Buyer: +265881234567 / Buyer@123');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
