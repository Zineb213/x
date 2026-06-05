const { HTTP_STATUS } = require('../config/constants');

const errorHandler = (err, req, res, next) => {
  console.error('Error:', err.message);
  console.error(err.stack);

  const statusCode = err.status || HTTP_STATUS.INTERNAL_SERVER_ERROR;
  const message = err.message || 'Internal server error';

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

const notFound = (req, res) => {
  res.status(HTTP_STATUS.NOT_FOUND).json({
    success: false,
    error: `Cannot ${req.method} ${req.url}`
  });
};

module.exports = { errorHandler, notFound };
