import { verifyToken } from "../utils/jwt.js";
import { User } from "../models/User.model.js";

export const authGuard = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Authentication token missing or malformed",
      });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({
        error: "Authentication token missing or malformed",
      });
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      return res.status(401).json({
        error: "Authentication token missing or malformed",
      });
    }

    const user = await User.findById(decoded.sub).select("-password");
    if (!user || user.isActive === false) {
      return res.status(401).json({
        error: "User account not found or deactivated",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

export default authGuard;
