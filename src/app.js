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
import webhookRoutes from "./routes/webhook.routes.js";
import learningRouter from "./routes/learning.routes.js";
import messageRoutes from "./routes/message.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import { renderApiDocs } from "./controllers/docs.controller.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";

const app = express();

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: false, // Allows inline CSS/JS in docs.html
  })
);

// Cross-Origin Resource Sharing (Multi-Origin Support)
const allowedOrigins = (env.FRONTEND_ORIGINS && env.FRONTEND_ORIGINS.length > 0)
  ? env.FRONTEND_ORIGINS
  : ["http://localhost:3000"];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
  })
);

// Body parser middleware with 16kb limit & rawBody preservation for signature verification
app.use(
  express.json({
    limit: "16kb",
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: "16kb" }));

// Interactive HTML API Documentation Portal
app.get("/", renderApiDocs);

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

// Mount webhook routes under /api/webhooks
app.use("/api/webhooks", webhookRoutes);

// Mount learning engine routes under /api/learning
app.use("/api/learning", learningRouter);

// Mount messaging routes under /api/messages
app.use("/api/messages", messageRoutes);

// Mount notification routes under /api/notifications
app.use("/api/notifications", notificationRoutes);

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
