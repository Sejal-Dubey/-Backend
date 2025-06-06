const express = require('express');
const router = express.Router();
const chapterController = require('../controllers/chapterController');
const multer = require('multer');
const { adminAuth } = require('../middlewares/adminAuth');
const cacheMiddleware = require('../middlewares/cache');

const upload = multer({ dest: 'uploads/' });

router.get('/', cacheMiddleware, chapterController.getAllChapters);
router.get('/:id', chapterController.getChapterById);
router.post('/', adminAuth, upload.single('file'), chapterController.uploadChapters);

module.exports = router;
