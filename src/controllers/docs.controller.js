import path from "path";
import fs from "fs";

/**
 * Controller to serve the interactive HTML API documentation portal at GET /
 */
export const renderApiDocs = (req, res, next) => {
  try {
    const docsPath = path.resolve("src/views/docs.html");

    if (!fs.existsSync(docsPath)) {
      return res.status(500).json({ error: "Documentation template unavailable" });
    }

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.sendFile(docsPath);
  } catch (error) {
    return next(error);
  }
};
