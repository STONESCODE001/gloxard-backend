import { verifyToken } from "../utils/jwt.js";
import { User } from "../models/User.model.js";

export const optionalAuthMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      if (token) {
        let decoded;
        try {
          decoded = verifyToken(token);
        } catch (err) {
          req.user = null;
          return next();
        }

        if (decoded && decoded.sub) {
          const user = await User.findById(decoded.sub).select("-password");
          if (user && user.isActive !== false) {
            if (
              decoded.tokenVersion === undefined ||
              user.tokenVersion === undefined ||
              decoded.tokenVersion === user.tokenVersion
            ) {
              req.user = user;
            }
          }
        }
      }
    }
  } catch (error) {
    // Silently ignore expired/invalid tokens for optional auth
    req.user = null;
  }
  next();
};

export default optionalAuthMiddleware;
