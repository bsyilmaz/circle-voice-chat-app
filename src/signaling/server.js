const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const os = require('os');
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}
const localIp = getLocalIpAddress();
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  pingTimeout: 60000, 
  pingInterval: 25000 
});
const PORT = process.env.PORT || 3001;
const rooms = new Map();
const ROOM_CLEANUP_INTERVAL = 5 * 60 * 1000;
app.get('/', (req, res) => {
  res.send({ 
    status: 'ok',
    uptime: process.uptime(),
    activeRooms: rooms.size,
    timestamp: new Date().toISOString(),
    localIp: localIp
  });
});
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});
app.get('/status', (req, res) => {
  const roomsInfo = [];
  rooms.forEach((room, roomId) => {
    roomsInfo.push({
      id: roomId,
      participants: room.participants.size,
      hasPassword: !!room.password,
      lastActivity: new Date(room.lastActivity).toISOString(),
      screenSharing: room.screenSharing
    });
  });
  res.send(`
    <html>
      <head>
        <title>BizXM Signaling Server Status</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { color: #4f46e5; }
          .container { max-width: 800px; margin: 0 auto; }
          .card { background: #f9f9f9; border-radius: 5px; padding: 15px; margin-bottom: 15px; }
          .stats { display: flex; justify-content: space-between; flex-wrap: wrap; }
          .stat-box { background: #fff; border: 1px solid #ddd; border-radius: 5px; padding: 15px; margin: 10px 0; width: 45%; }
          table { width: 100%; border-collapse: collapse; }
          table th, table td { text-align: left; padding: 8px; border-bottom: 1px solid #ddd; }
          table tr:nth-child(even) { background-color: #f2f2f2; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>BizXM Signaling Server Status</h1>
          <div class="card">
            <h2>Server Info</h2>
            <div class="stats">
              <div class="stat-box">
                <h3>Uptime</h3>
                <p>${Math.floor(process.uptime() / 60)} minutes</p>
              </div>
              <div class="stat-box">
                <h3>Active Rooms</h3>
                <p>${rooms.size}</p>
              </div>
              <div class="stat-box">
                <h3>Local IP</h3>
                <p>${localIp}</p>
              </div>
              <div class="stat-box">
                <h3>Port</h3>
                <p>${PORT}</p>
              </div>
            </div>
          </div>
          <div class="card">
            <h2>Active Rooms</h2>
            <table>
              <tr>
                <th>Room ID</th>
                <th>Participants</th>
                <th>Password Protected</th>
                <th>Last Activity</th>
                <th>Screen Sharing</th>
              </tr>
              ${roomsInfo.map(room => `
                <tr>
                  <td>${room.id}</td>
                  <td>${room.participants}</td>
                  <td>${room.hasPassword ? 'Yes' : 'No'}</td>
                  <td>${room.lastActivity}</td>
                  <td>${room.screenSharing ? 'Yes' : 'No'}</td>
                </tr>
              `).join('')}
            </table>
          </div>
        </div>
      </body>
    </html>
  `);
});
function generateRoomId() {
  return crypto.randomBytes(4).toString('hex');
}
function createRoom(roomId, password = null) {
  const room = {
    id: roomId,
    password: password,
    participants: new Map(),
    host: null,
    lastActivity: Date.now(),
    screenSharing: false
  };
  rooms.set(roomId, room);
  return room;
}
function validateRoomAccess(roomId, password) {
  const room = rooms.get(roomId);
  if (!room) {
    return { valid: false, reason: 'Room does not exist' };
  }
  if (room.password && room.password !== password) {
    return { valid: false, reason: 'Incorrect password' };
  }
  return { valid: true };
}
function cleanupInactiveRooms() {
  const now = Date.now();
  let roomsRemoved = 0;
  for (const [roomId, room] of rooms.entries()) {
    if (now - room.lastActivity > ROOM_CLEANUP_INTERVAL) {
      if (room.participants.size > 0) {
        io.to(roomId).emit('room-closed', { reason: 'Room inactive' });
      }
      rooms.delete(roomId);
      roomsRemoved++;
      console.log(`Room ${roomId} removed due to inactivity`);
    }
  }
  if (roomsRemoved > 0) {
    console.log(`Cleaned up ${roomsRemoved} inactive rooms. Active rooms: ${rooms.size}`);
  }
}
setInterval(cleanupInactiveRooms, ROOM_CLEANUP_INTERVAL);
io.on('connection', (socket) => {
  console.log(`New connection: ${socket.id} from ${socket.handshake.address}`);
  let currentRoom = null;
  let username = null;
  socket.on('create-room', ({ username: requestedUsername, password }, callback) => {
    username = requestedUsername || 'Anonymous';
    const roomId = generateRoomId();
    const room = createRoom(roomId, password);
    room.host = socket.id;
    room.participants.set(socket.id, { id: socket.id, username });
    socket.join(roomId);
    currentRoom = roomId;
    console.log(`Room created: ${roomId} by ${username} (${socket.id})`);
    callback({
      success: true,
      roomId,
      isHost: true
    });
  });
  socket.on('join-room', ({ roomId, username: requestedUsername, password }, callback) => {
    const validation = validateRoomAccess(roomId, password);
    if (!validation.valid) {
      return callback({
        success: false,
        error: validation.reason
      });
    }
    username = requestedUsername || 'Anonymous';
    const room = rooms.get(roomId);
    room.lastActivity = Date.now();
    room.participants.set(socket.id, { id: socket.id, username });
    socket.join(roomId);
    currentRoom = roomId;
    console.log(`User ${username} (${socket.id}) joined room ${roomId}`);
    socket.to(roomId).emit('user-joined', {
      userId: socket.id,
      username
    });
    callback({
      success: true,
      roomId,
      isHost: room.host === socket.id,
      participants: Array.from(room.participants.values()).map(p => ({
        id: p.id,
        username: p.username,
        isHost: p.id === room.host
      })),
      screenSharing: room.screenSharing
    });
  });
  socket.on('leave-room', () => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (room) {
      room.participants.delete(socket.id);
      socket.to(currentRoom).emit('user-left', {
        userId: socket.id,
        username
      });
      console.log(`User ${username} (${socket.id}) left room ${currentRoom}`);
      if (room.host === socket.id) {
        io.to(currentRoom).emit('room-closed', { reason: 'Host left' });
        rooms.delete(currentRoom);
        console.log(`Room ${currentRoom} closed because host left`);
      }
      else if (room.participants.size === 0) {
        console.log(`Room ${currentRoom} is empty, will be removed later`);
      } else {
        room.lastActivity = Date.now();
      }
    }
    socket.leave(currentRoom);
    currentRoom = null;
    username = null;
  });
  socket.on('signal', ({ to, signal }) => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room || !room.participants.has(to)) return;
    io.to(to).emit('signal', {
      from: socket.id,
      username: username,
      signal
    });
  });
  socket.on('screen-sharing', ({ active }) => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room) return;
    room.screenSharing = active;
    socket.to(currentRoom).emit('screen-sharing-update', {
      userId: socket.id,
      username,
      active
    });
  });
  socket.on('mute-update', ({ muted }) => {
    if (!currentRoom) return;
    socket.to(currentRoom).emit('user-mute-update', {
      userId: socket.id,
      muted
    });
  });
  socket.on('heartbeat', () => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (room) {
      room.lastActivity = Date.now();
    }
  });
  socket.on('disconnect', () => {
    console.log(`Connection closed: ${socket.id}`);
    if (currentRoom) {
      const room = rooms.get(currentRoom);
      if (room) {
        room.participants.delete(socket.id);
        socket.to(currentRoom).emit('user-left', {
          userId: socket.id,
          username
        });
        if (room.host === socket.id) {
          io.to(currentRoom).emit('room-closed', { reason: 'Host disconnected' });
          rooms.delete(currentRoom);
          console.log(`Room ${currentRoom} closed because host disconnected`);
        }
        else if (room.participants.size === 0) {
          console.log(`Room ${currentRoom} is empty, will be removed later`);
        } else {
          room.lastActivity = Date.now();
        }
      }
    }
  });
});
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Signaling server running on http:
});
process.on('SIGINT', () => {
  console.log('Shutting down signaling server');
  server.close(() => {
    process.exit(0);
  });
}); 