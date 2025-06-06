const mongoose = require('mongoose');
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const chapterRoutes = require('./routes/chapterRoutes');
const redisClient = require('./utils/redisClient');

const app = express();
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected'))
.catch(err => {
  console.error('Mongo error', err);
  process.exit(1); // stop app if DB fails
});

// Redis-based rate limiting setup
(async () => {
  const rateLimit = require('express-rate-limit');
  const { default: RedisStore } = await import('rate-limit-redis');

  const limiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // limit each IP to 30 requests per minute
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
      sendCommand: (...args) => redisClient.sendCommand(args)
    })
  });

  app.use(limiter);
  app.use('/api/v1/chapters', chapterRoutes);

  const port = process.env.PORT || 5000;
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
})();
