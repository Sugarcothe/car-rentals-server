import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer as createHttpServer } from "http";
import connectDB from "./config/database";
import { handleDemo } from "./routes/demo";
import { initializeSocket } from "./socket";

export async function createServer() {
  const app = express();
  const server = createHttpServer(app);

  // Initialize Socket.IO
  const io = initializeSocket(server);
  console.log('Socket.IO initialized successfully');

  // Middleware
  app.use(
    cors({
      origin: ["http://localhost:3000", "http://localhost:5176"],
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);

  // App API routes
  app.use("/api/auth", (await import("./routes/auth")).default);
  app.use("/api/cars", (await import("./routes/cars")).default);
  app.use("/api/vendors", (await import("./routes/vendors")).default);
  app.use("/api/messages", (await import("./routes/messages")).default);
  app.use(
    "/api/notifications",
    (await import("./routes/notifications")).default
  );
  app.use("/api/upload", (await import("./routes/upload")).default);

  return { app, server };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  // Connect to MongoDB
  try {
    await connectDB();
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection failed:', error);
    console.log('Please set up MongoDB Atlas or install MongoDB locally');
    process.exit(1);
  }

  const { server } = await createServer();
  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Socket.IO enabled for real-time messaging`);
    console.log(`Visit http://localhost:${PORT} to access the application`);
  });
}
