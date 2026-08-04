const errorHandler = (err, req, res, next) => {
    let error = { ...err };
    error.message = err.message;

    console.error('[API Error]:', err);

    if (err.name === 'CastError') {
        const message = `Resource not found with ID of ${err.value}`;
        return res.status(404).json({ success: false, message });
    }

    if (err.code === 11000) {
        const field = Object.keys(err.keyValue)[0];
        const message = `Duplicate value entered for field '${field}'. A record already exists.`;
        return res.status(400).json({ success: false, message });
    }

    if (err.name === 'ValidationError') {
        const message = Object.values(err.errors).map((val) => val.message).join(', ');
        return res.status(400).json({ success: false, message });
    }

    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({ success: false, message: 'Invalid token signature' });
    }

    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ success: false, message: 'Token has expired' });
    }

    res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Internal Server Error',
    });
};

module.exports = errorHandler;