import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export const signToken = (payload, options = {}) => {
  const secret = env.JWT_SECRET || process.env.JWT_SECRET;
  const expiresIn = options.expiresIn || env.JWT_EXPIRES_IN || "7d";
  return jwt.sign(payload, secret, { expiresIn, ...options });
};

export const verifyToken = (token) => {
  const secret = env.JWT_SECRET || process.env.JWT_SECRET;
  return jwt.verify(token, secret);
};

export default {
  signToken,
  verifyToken,
};
