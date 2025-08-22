const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const SSHManager = require('./ssh-manager');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Enable CORS
app.use(cors({
  origin: "http://localhost:3000", // React dev server
  credentials: true
}));

const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Store active SSH sessions
const activeSessions = new Map();

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Handle SSH connection request
  socket.on('ssh-connect', (credentials) => {
    console.log('SSH connection requested for:', credentials.host);

    const sshManager = new SSHManager(credentials);
    activeSessions.set(socket.id, sshManager);

    // Set up SSH events
    sshManager.on('ready', () => {
      console.log('SSH connection established');
      socket.emit('ssh-ready');
    });

    sshManager.on('data', (data) => {
      socket.emit('ssh-data', data.toString());
    });

    sshManager.on('error', (error) => {
      console.error('SSH error:', error);
      socket.emit('ssh-error', error.message);
    });

    sshManager.on('close', () => {
      console.log('SSH connection closed');
      socket.emit('ssh-close');
      activeSessions.delete(socket.id);
    });

    // Connect SSH
    sshManager.connect();
  });

  // Handle terminal input
  socket.on('terminal-input', (data) => {
    const sshManager = activeSessions.get(socket.id);
    if (sshManager && sshManager.isConnected()) {
      sshManager.write(data);
    }
  });

  // Handle terminal resize
  socket.on('terminal-resize', (dimensions) => {
    const sshManager = activeSessions.get(socket.id);
    if (sshManager && sshManager.isConnected()) {
      sshManager.resize(dimensions.cols, dimensions.rows);
    }
  });

  // Handle command execution (needed for file manager)
  socket.on('execute-command', (command) => {
    const sshManager = activeSessions.get(socket.id);
    if (!sshManager || !sshManager.isConnected()) {
      return socket.emit('command-result', { output: '', errorOutput: 'Not connected', code: 1, signal: null });
    }
    sshManager.exec(command, (err, result) => {
      if (err) {
        return socket.emit('command-result', { output: '', errorOutput: err.message, code: 1, signal: null });
      }
      socket.emit('command-result', result);
    });
  });

  // Handle SFTP fetch
  socket.on('sftp-fetch', (remotePath) => {
    const sshManager = activeSessions.get(socket.id);
    if (!sshManager) return socket.emit('sftp-error', 'No SSH session');

    sshManager.fetchFile(remotePath, (err, data) => {
      if (err) {
        socket.emit('sftp-error', err.message);
      } else {
        socket.emit('sftp-file', { path: remotePath, content: data.toString('base64') });
      }
    });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    const sshManager = activeSessions.get(socket.id);
    if (sshManager) {
      sshManager.disconnect();
      activeSessions.delete(socket.id);
    }
  });

  // Handle manual disconnect
  socket.on('ssh-disconnect', () => {
    const sshManager = activeSessions.get(socket.id);
    if (sshManager) {
      sshManager.disconnect();
      activeSessions.delete(socket.id);
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    activeSessions: activeSessions.size,
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`SSH Terminal Server running on port ${PORT}`);
  console.log(`Active sessions tracked: ${activeSessions.size}`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  activeSessions.forEach((sshManager) => {
    sshManager.disconnect();
  });
  activeSessions.clear();

  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = { app, server, io };
