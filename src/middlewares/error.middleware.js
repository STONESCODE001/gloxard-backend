export const errorMiddleware = (err, req, res, next) => {
  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || "Internal server error";

  // Handle Mongoose duplicate key error (E11000)
  if (err.code === 11000) {
    statusCode = 409;
    message = "User with this email or username already exists";
  }

  // Handle Mongoose validation errors
  if (err.name === "ValidationError") {
    statusCode = 400;
    const errors = Object.values(err.errors || {}).map((e) => e.message);
    message = errors.length > 0 ? errors.join(", ") : "Validation failed";
  }

  // Handle JWT errors
  if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Authentication token missing or malformed";
  }

  return res.status(statusCode).json({
    error: message,
  });
};

export default errorMiddleware;
