export const roleGuard = (...allowedRoles) => {
  return (req, res, next) => {
    const isAllowed =
      req.user &&
      (allowedRoles.includes(req.user.role) ||
        (req.user.role === "admin" && allowedRoles.includes("instructor")));

    if (!isAllowed) {
      if (allowedRoles.includes("instructor")) {
        return res.status(403).json({
          error: "Access denied. Instructor role required",
        });
      }
      if (allowedRoles.includes("admin")) {
        return res.status(403).json({
          error: "Access denied. Admin role required",
        });
      }
      if (allowedRoles.includes("institution_admin")) {
        return res.status(403).json({
          error: "Access denied. Institution admin role required",
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

