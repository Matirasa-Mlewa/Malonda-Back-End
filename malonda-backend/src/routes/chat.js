const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/chatController');
const { authenticate } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');

router.get('/conversations', authenticate, ctrl.getConversations);
router.get('/:userId/messages', authenticate, ctrl.getMessages);
router.post('/:userId/messages', authenticate, ctrl.sendMessage);
router.post('/upload', authenticate, upload.single('image'), ctrl.uploadChatImage);
router.post('/report/:messageId', authenticate, ctrl.reportMessage);
router.post('/:userId/read', authenticate, ctrl.markRead);

module.exports = router;
