export const roleGuard = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      if (allowedRoles.includes("admin")) {
        return res.status(403).json({
          error: "Access denied. Admin role required",
        });
      }
      return res.status(403).json({
        error: "Access forbidden: insufficient role permissions",
      });
    }
    next();
  };
};

export const roleMiddleware = roleGuard;
export default roleGuard;

