import dotenv from "dotenv";
dotenv.config();

import { env } from "./config/env.js";
import connectDB from "./config/db.js";
import { app } from "./app.js";

const startServer = async () => {
  try {
    await connectDB();

    app.on("error", (error) => {
      console.error("Server error:", error);
    });

    const PORT = env.PORT || process.env.PORT || 3001;
    app.listen(PORT, () => {
      console.log(`⚙️  Server running on port: ${PORT}`);
      console.log(`⚡ API Documentation available at: http://localhost:${PORT}/`);
    });
  } catch (err) {
    console.error("MongoDB connection failed !!! ", err);
    process.exit(1);
  }
};

startServer();
