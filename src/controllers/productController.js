const prisma = require('../config/database');
const { uploadImage } = require('../services/storageService');

// GET /products
exports.getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, category, district, minPrice, maxPrice, sort = 'createdAt' } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = { status: 'ACTIVE' };
    if (category) where.category = category;
    if (district) where.district = district;
    if (minPrice || maxPrice) where.price = { ...(minPrice && { gte: Number(minPrice) }), ...(maxPrice && { lte: Number(maxPrice) }) };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where, skip, take: Number(limit),
        orderBy: sort === 'price_asc' ? { price: 'asc' } : sort === 'price_desc' ? { price: 'desc' } : { createdAt: 'desc' },
        include: {
          images: { where: { isPrimary: true }, take: 1 },
          seller: { select: { id: true, name: true, verificationLevel: true, trustScore: true } },
          _count: { select: { reviews: true } },
        },
      }),
      prisma.product.count({ where }),
    ]);

    res.json({ success: true, products, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) { next(err); }
};

// GET /products/:id
exports.getById = async (req, res, next) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: {
        images: { orderBy: { order: 'asc' } },
        seller: { select: { id: true, name: true, verificationLevel: true, trustScore: true, location: true, createdAt: true } },
        reviews: { include: { reviewer: { select: { name: true, verificationLevel: true } } }, orderBy: { createdAt: 'desc' }, take: 10 },
        _count: { select: { reviews: true } },
      },
    });

    if (!product) return res.status(404).json({ error: 'Product not found' });

    // Increment view count
    await prisma.product.update({ where: { id: product.id }, data: { viewCount: { increment: 1 } } });

    const avgRating = product.reviews.length
      ? product.reviews.reduce((s, r) => s + r.rating, 0) / product.reviews.length
      : 0;

    res.json({ success: true, product: { ...product, avgRating: Math.round(avgRating * 10) / 10 } });
  } catch (err) { next(err); }
};

// GET /products/search
exports.search = async (req, res, next) => {
  try {
    const { q, category, district, minPrice, maxPrice } = req.query;
    const where = {
      status: 'ACTIVE',
      ...(q && { OR: [{ name: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }] }),
      ...(category && { category }),
      ...(district && { district }),
      ...((minPrice || maxPrice) && { price: { ...(minPrice && { gte: Number(minPrice) }), ...(maxPrice && { lte: Number(maxPrice) }) } }),
    };

    const products = await prisma.product.findMany({
      where, take: 30,
      include: { images: { where: { isPrimary: true }, take: 1 }, seller: { select: { name: true, verificationLevel: true } } },
    });
    res.json({ success: true, products });
  } catch (err) { next(err); }
};

// POST /products
exports.create = async (req, res, next) => {
  try {
    const { name, description, price, quantity, category, location, district, deliveryMethod, deliveryCost, deliveryNote, escrowEnabled } = req.body;

    const product = await prisma.product.create({
      data: {
        sellerId: req.user.id, name, description,
        price: Number(price), quantity: Number(quantity) || 1,
        category, location, district, deliveryMethod: deliveryMethod || 'PICKUP',
        deliveryCost: deliveryCost ? Number(deliveryCost) : null,
        deliveryNote, escrowEnabled: escrowEnabled !== 'false',
      },
    });

    // Upload images if provided
    if (req.files && req.files.length > 0) {
      const imagePromises = req.files.map((file, i) =>
        uploadImage(file.buffer, `malonda/products/${product.id}`).then(result =>
          prisma.productImage.create({
            data: { productId: product.id, url: result.url, publicId: result.publicId, isPrimary: i === 0, order: i },
          })
        )
      );
      await Promise.all(imagePromises);
    }

    const full = await prisma.product.findUnique({
      where: { id: product.id },
      include: { images: true },
    });

    res.status(201).json({ success: true, product: full });
  } catch (err) { next(err); }
};

// PUT /products/:id
exports.update = async (req, res, next) => {
  try {
    const product = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    if (product.sellerId !== req.user.id && req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Forbidden' });

    const updated = await prisma.product.update({
      where: { id: req.params.id },
      data: { ...req.body, price: req.body.price ? Number(req.body.price) : undefined },
    });
    res.json({ success: true, product: updated });
  } catch (err) { next(err); }
};

// DELETE /products/:id
exports.delete = async (req, res, next) => {
  try {
    const product = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!product) return res.status(404).json({ error: 'Not found' });
    if (product.sellerId !== req.user.id && req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Forbidden' });

    await prisma.product.update({ where: { id: req.params.id }, data: { status: 'SUSPENDED' } });
    res.json({ success: true, message: 'Product removed' });
  } catch (err) { next(err); }
};

// GET /products/seller/:sellerId
exports.getBySeller = async (req, res, next) => {
  try {
    const products = await prisma.product.findMany({
      where: { sellerId: req.params.sellerId, status: 'ACTIVE' },
      include: { images: { where: { isPrimary: true }, take: 1 } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, products });
  } catch (err) { next(err); }
};
