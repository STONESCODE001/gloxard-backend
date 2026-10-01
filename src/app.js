import express from "express";
import path from "path";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env.js";
import authRouter from "./routes/auth.routes.js";
import uploadRouter from "./routes/upload.routes.js";
import categoryRoutes from "./routes/category.routes.js";
import courseRoutes from "./routes/course.routes.js";
import tutorRoutes from "./routes/tutor.routes.js";
import adminRouter from "./routes/admin.routes.js";
import enrollmentRoutes from "./routes/enrollment.routes.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";

const app = express();

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: false, // Allows inline CSS/JS in docs.html
  })
);

// Cross-Origin Resource Sharing
app.use(
  cors({
    origin: env.FRONTEND_ORIGIN || "http://localhost:3000",
    credentials: true,
  })
);

// Body parser middleware with 16kb limit
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));

// Interactive HTML API Documentation
app.get("/", (req, res) => {
  res.sendFile(path.resolve("src/views/docs.html"));
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok", uptime: process.uptime() });
});

// Mount auth routes under /api/auth
app.use("/api/auth", authRouter);

// Mount upload routes under /api/upload
app.use("/api/upload", uploadRouter);

// Mount tutor onboarding & analytics routes under /api/tutor
app.use("/api/tutor", tutorRoutes);

// Mount admin routes under /api/admin
app.use("/api/admin", adminRouter);

// Mount enrollment routes under /api/enrollments
app.use("/api/enrollments", enrollmentRoutes);

// Mount category taxonomy & course catalog routes under /api
app.use("/api", categoryRoutes);
app.use("/api", courseRoutes);


// Global 404 handler for unmatched routes
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Centralized error handler
app.use(errorMiddleware);

export { app };
export default app;
