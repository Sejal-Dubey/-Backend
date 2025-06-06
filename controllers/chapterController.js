const Chapter = require('../models/Chapter');
const fs = require('fs');
const redis = require('../utils/redisClient');

// GET /api/v1/chapters?class=11&subject=Math&... with pagination
exports.getAllChapters = async (req, res) => {
  const {
    class: cls,
    unit,
    status,
    isWeakChapter,
    subject,
    page = 1,
    limit = 10
  } = req.query;

  const filters = {};
  if (cls) filters.class = cls;
  if (unit) filters.unit = unit;
  if (status) filters.status = status;
  if (subject) filters.subject = subject;
  if (isWeakChapter) filters.isWeakChapter = isWeakChapter === 'true';

  const skip = (page - 1) * limit;

  const total = await Chapter.countDocuments(filters);
  const chapters = await Chapter.find(filters).skip(skip).limit(Number(limit));

  await redis.setEx('chapters', 3600, JSON.stringify({ total, chapters }));

  res.json({ total, chapters });
};

// GET /api/v1/chapters/:id
exports.getChapterById = async (req, res) => {
  try {
    const chapter = await Chapter.findById(req.params.id);
    if (!chapter) {
      return res.status(404).json({ error: 'Chapter not found' });
    }
    res.json(chapter);
  } catch (err) {
    res.status(400).json({ error: 'Invalid chapter ID' });
  }
};

// POST /api/v1/chapters — Upload JSON
exports.uploadChapters = async (req, res) => {
  const filePath = req.file.path;
  let data;

  try {
    data = JSON.parse(fs.readFileSync(filePath));
  } catch (err) {
    return res.status(400).json({ error: 'Invalid JSON format' });
  }

  const failed = [];

  for (let item of data) {
    try {
      await Chapter.create(item);
    } catch (err) {
      console.error('Insert error:', err.message);
      failed.push(item);
    }
  }

  await redis.del('chapters'); // clear cache

  res.json({
    message: 'Upload complete',
    inserted: data.length - failed.length,
    failedCount: failed.length,
    failed
  });
};
