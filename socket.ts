import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';

let io: SocketIOServer;

export const initializeSocket = (server: HTTPServer) => {
  const allowedOrigins = process.env.CLIENT_URL 
    ? [process.env.CLIENT_URL, "http://localhost:3000", "http://localhost:5176"]
    : ["http://localhost:3000", "http://localhost:5176"];
    
  io = new SocketIOServer(server, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST"]
    }
  });

  // Authentication middleware for socket connections
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next();  // Allow anonymous connections for public listings
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      socket.data.user = decoded;
      next();
    } catch (error) {
      next();  // Continue without auth if token is invalid
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Join user-specific room for personalized notifications
    if (socket.data.user) {
      socket.join(`user_${socket.data.user.id}`);
      console.log(`User ${socket.data.user.id} joined personal room`);
    }

    // Join location-based rooms for local listings
    socket.on('joinLocation', (location: { city: string; state: string }) => {
      const roomName = `${location.city}_${location.state}`.toLowerCase();
      socket.join(roomName);
      console.log(`Socket ${socket.id} joined location room: ${roomName}`);
    });

    // Join make/model specific rooms for targeted updates
    socket.on('joinInterests', (interests: { makes: string[]; bodyTypes: string[] }) => {
      interests.makes.forEach(make => {
        socket.join(`make_${make.toLowerCase()}`);
      });
      interests.bodyTypes.forEach(bodyType => {
        socket.join(`bodyType_${bodyType.toLowerCase()}`);
      });
      console.log(`Socket ${socket.id} joined interest rooms`);
    });

    // Handle real-time search
    socket.on('liveSearch', (searchQuery: string) => {
      // Emit search suggestions or results
      socket.emit('searchSuggestions', {
        query: searchQuery,
        suggestions: [] // This would be populated with actual search logic
      });
    });

    // Handle message events
    socket.on('sendMessage', (messageData) => {
      console.log('Message received:', messageData);
      // Broadcast to all admin users
      socket.broadcast.emit('newMessage', messageData);
    });

    socket.on('joinAdminRoom', () => {
      if (socket.data.user && socket.data.user.role === 'vendor') {
        socket.join('admins');
        console.log(`Admin ${socket.data.user.id} joined admin room`);
      }
    });

    socket.on('joinUserRoom', () => {
      if (socket.data.user) {
        socket.join(`user_${socket.data.user.id}`);
        console.log(`User ${socket.data.user.id} joined user room`);
      }
    });

    // Handle price alerts
    socket.on('setPriceAlert', (alert: { 
      make: string; 
      model: string; 
      maxPrice: number; 
      location?: string 
    }) => {
      if (socket.data.user) {
        socket.join(`priceAlert_${socket.data.user.id}`);
        console.log(`Price alert set for user ${socket.data.user.id}`);
      }
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const getIO = (): SocketIOServer => {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
};

// Helper functions for emitting events
export const emitToLocation = (city: string, state: string, event: string, data: any) => {
  const roomName = `${city}_${state}`.toLowerCase();
  io.to(roomName).emit(event, data);
};

export const emitToMakeInterests = (make: string, event: string, data: any) => {
  io.to(`make_${make.toLowerCase()}`).emit(event, data);
};

export const emitToUser = (userId: string, event: string, data: any) => {
  io.to(`user_${userId}`).emit(event, data);
};