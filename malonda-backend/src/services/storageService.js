const cloudinary = require('cloudinary').v2;
const logger = require('../utils/logger');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Upload a buffer to Cloudinary.
 * @param {Buffer} buffer - File buffer from multer memoryStorage
 * @param {string} folder - Cloudinary folder path
 * @returns {{ url: string, publicId: string }}
 */
exports.uploadImage = (buffer, folder = 'malonda') => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        format: 'webp',       // Convert to WebP for smaller file size
        quality: 'auto:good', // Auto quality optimisation
        transformation: [{ width: 800, height: 800, crop: 'limit' }],
      },
      (error, result) => {
        if (error) {
          logger.error('Cloudinary upload error:', error);
          reject(new Error('Image upload failed'));
        } else {
          resolve({ url: result.secure_url, publicId: result.public_id });
        }
      }
    );
    stream.end(buffer);
  });
};

/**
 * Delete an image from Cloudinary.
 */
exports.deleteImage = async (publicId) => {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    logger.error('Cloudinary delete error:', err.message);
  }
};
