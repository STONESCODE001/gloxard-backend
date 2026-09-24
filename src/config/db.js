import mongoose from "mongoose";
import { env } from "./env.js";
import { DB_NAME } from "../constants/index.js";

const connectDB = async () => {
  try {
    let uri = env.MONGODB_URI || process.env.MONGODB_URI;
    if (uri && !uri.includes(".net/") && !uri.split("?")[0].endsWith(`/${DB_NAME}`)) {
      uri = uri.endsWith("/") ? `${uri}${DB_NAME}` : `${uri}/${DB_NAME}`;
    }
    const connectionInstance = await mongoose.connect(uri);
    console.log(`\nMongoDB connected! DB HOST: ${connectionInstance.connection.host}`);
    return connectionInstance;
  } catch (error) {
    console.error("MongoDB connection failed:", error);
    process.exit(1);
  }
};

export default connectDB;
