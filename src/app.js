import express from "express";
import userRouter from "./routes/auth.routes.js";

const app = express();

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true, limit: "16kb" }));

// Routes declaration
app.use("/api/v1/users", userRouter);

// Example route: http://localhost:8000/api/v1/users/register

app.get("/", (req, res) => {
    res.send("API is running...");
});

export { app };
