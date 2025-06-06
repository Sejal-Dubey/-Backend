exports.adminAuth = (req, res, next) => {
    if (req.headers.authorization === process.env.ADMIN_TOKEN) return next();
    return res.status(403).json({ error: 'Unauthorized' });
};
