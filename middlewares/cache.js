const redis = require('../utils/redisClient');

module.exports = async (req, res, next) => {
    const cached = await redis.get('chapters');
    if (cached) return res.json(JSON.parse(cached));
    next();
};
