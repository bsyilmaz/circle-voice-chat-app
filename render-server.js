const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  pingTimeout: 60000,
  pingInterval: 25000
});
const rooms = new Map();
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>BizXM Signaling Server</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            line-height: 1.6;
          }
          h1 { color: #4f46e5; }
          .card {
            background: #f9f9f9;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          code {
            background: #eee;
            padding: 2px 5px;
            border-radius: 4px;
          }
          .rooms {
            margin-top: 20px;
          }
        </style>
      </head>
      <body>
        <h1>BizXM Signaling Server</h1>
        <div class="card">
          <p>✅ Server is running!</p>
          <p>This server handles WebRTC signaling for BizXM application. It doesn't serve any UI components.</p>
          <p>Active rooms: ${rooms.size}</p>
          <p>Server time: ${new Date().toISOString()}</p>
        </div>
        <div class="card">
          <h2>Usage</h2>
          <p>In your BizXM app, set the signaling server URL to:</p>
          <code>${req.protocol}:
        </div>
      </body>
    </html>
  `);
});
app.get('/status', (req, res) => {
  const roomsInfo = [];
  rooms.forEach((room, roomId) => {
    roomsInfo.push({
      id: roomId,
      participants: room.participants.size,
      hasPassword: !!room.password,
      host: room.host
    });
  });
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    activeRooms: rooms.size,
    timestamp: new Date().toISOString(),
    rooms: roomsInfo
  });
});
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  socket.on('create-room', ({ username, password }, callback) => {
    try {
      const roomId = Math.random().toString(16).substring(2, 10);
      rooms.set(roomId, {
        host: socket.id,
        password: password || null,
        participants: new Map([[socket.id, { username, isHost: true }]]),
        lastActivity: Date.now(),
        screenSharing: false
      });
      socket.join(roomId);
      socket.room = roomId;
      callback({
        success: true,
        roomId,
        isHost: true
      });
      console.log(`Room created: ${roomId} by ${username}`);
    } catch (error) {
      console.error('Error creating room:', error);
      callback({ success: false, error: 'Server error creating room' });
    }
  });
  socket.on('join-room', ({ roomId, username, password }, callback) => {
    try {
      const room = rooms.get(roomId);
      if (!room) {
        return callback({ success: false, error: 'Room not found' });
      }
      if (room.password && room.password !== password) {
        return callback({ success: false, error: 'Incorrect password' });
      }
      room.lastActivity = Date.now();
      socket.join(roomId);
      socket.room = roomId;
      room.participants.set(socket.id, { 
        username, 
        isHost: false 
      });
      const participants = Array.from(room.participants).map(([id, data]) => ({
        id,
        username: data.username,
        isHost: id === room.host
      }));
      socket.to(roomId).emit('user-joined', { userId: socket.id, username });
      callback({
        success: true,
        roomId,
        isHost: socket.id === room.host,
        participants,
        screenSharing: room.screenSharing
      });
      console.log(`User ${username} joined room: ${roomId}`);
    } catch (error) {
      console.error('Error joining room:', error);
      callback({ success: false, error: 'Server error joining room' });
    }
  });
  socket.on('signal', ({ to, signal }) => {
    if (socket.room) {
      const room = rooms.get(socket.room);
      if (room && room.participants.has(socket.id)) {
        const participant = room.participants.get(socket.id);
        if (participant) {
          room.lastActivity = Date.now();
          io.to(to).emit('signal', { 
            from: socket.id, 
            username: participant.username, 
            signal 
          });
        }
      }
    }
  });
  socket.on('mute-update', ({ muted }) => {
    if (socket.room) {
      const room = rooms.get(socket.room);
      if (room) {
        room.lastActivity = Date.now();
        socket.to(socket.room).emit('user-mute-update', { userId: socket.id, muted });
      }
    }
  });
  socket.on('screen-sharing', ({ active }) => {
    if (socket.room) {
      const room = rooms.get(socket.room);
      if (room && room.participants.has(socket.id)) {
        const participant = room.participants.get(socket.id);
        if (participant) {
          room.screenSharing = active;
          room.lastActivity = Date.now();
          socket.to(socket.room).emit('screen-sharing-update', { 
            userId: socket.id, 
            username: participant.username, 
            active 
          });
        }
      }
    }
  });
  socket.on('leave-room', () => {
    handleDisconnect();
  });
  socket.on('heartbeat', () => {
    if (socket.room && rooms.has(socket.room)) {
      rooms.get(socket.room).lastActivity = Date.now();
    }
  });
  socket.on('disconnect', () => {
    handleDisconnect();
  });
  function handleDisconnect() {
    if (socket.room) {
      const room = rooms.get(socket.room);
      if (room) {
        const userData = room.participants.get(socket.id);
        room.participants.delete(socket.id);
        if (userData) {
          socket.to(socket.room).emit('user-left', { userId: socket.id, username: userData.username });
          console.log(`User ${userData.username} left room: ${socket.room}`);
        }
        if (room.participants.size === 0) {
          rooms.delete(socket.room);
          console.log(`Room deleted: ${socket.room} (empty)`);
        }
        else if (socket.id === room.host) {
          socket.to(socket.room).emit('room-closed', { reason: 'Host left the room' });
          rooms.delete(socket.room);
          console.log(`Room deleted: ${socket.room} (host left)`);
        }
      }
      socket.leave(socket.room);
      socket.room = null;
    }
  }
});
setInterval(() => {
  const now = Date.now();
  const inactiveTime = 60 * 60 * 1000; 
  for (const [roomId, room] of rooms.entries()) {
    if (room.lastActivity && now - room.lastActivity > inactiveTime) {
      io.to(roomId).emit('room-closed', { reason: 'Room closed due to inactivity' });
      for (const participantId of room.participants.keys()) {
        const socket = io.sockets.sockets.get(participantId);
        if (socket) {
          socket.leave(roomId);
          socket.room = null;
        }
      }
      rooms.delete(roomId);
      console.log(`Room deleted: ${roomId} (inactive)`);
    }
  }
}, 60 * 60 * 1000); 
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});
console.log(`Server starting up at ${new Date().toISOString()}`);
console.log(`Node.js version: ${process.version}`);
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
process.on('SIGINT', () => {
  console.log('Shutting down signaling server');
  server.close(() => {
    process.exit(0);
  });
}); 