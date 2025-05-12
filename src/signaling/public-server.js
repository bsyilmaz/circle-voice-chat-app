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
  }
});
const rooms = new Map();
app.get('/', (req, res) => {
  res.send('BizXM Signaling Server Running');
});
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  socket.on('create-room', ({ username, password }, callback) => {
    try {
      const roomId = Math.random().toString(16).substring(2, 10);
      rooms.set(roomId, {
        host: socket.id,
        password: password || null,
        participants: new Map([[socket.id, { username, isHost: true }]])
      });
      socket.join(roomId);
      socket.room = roomId;
      callback({
        success: true,
        roomId
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
      socket.join(roomId);
      socket.room = roomId;
      room.participants.set(socket.id, { username, isHost: false });
      const participants = Array.from(room.participants).map(([id, data]) => ({
        id,
        username: data.username,
        isHost: data.isHost
      }));
      socket.to(roomId).emit('user-joined', { userId: socket.id, username });
      callback({
        success: true,
        roomId,
        participants
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
        const { username } = room.participants.get(socket.id);
        io.to(to).emit('signal', { from: socket.id, username, signal });
      }
    }
  });
  socket.on('mute-update', ({ muted }) => {
    if (socket.room) {
      socket.to(socket.room).emit('user-mute-update', { userId: socket.id, muted });
    }
  });
  socket.on('screen-sharing', ({ active }) => {
    if (socket.room) {
      const room = rooms.get(socket.room);
      if (room && room.participants.has(socket.id)) {
        const { username } = room.participants.get(socket.id);
        socket.to(socket.room).emit('screen-sharing-update', { userId: socket.id, username, active });
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
process.on('SIGINT', () => {
  console.log('Shutting down signaling server');
  server.close(() => {
    process.exit(0);
  });
});
module.exports = { app, server, io }; 