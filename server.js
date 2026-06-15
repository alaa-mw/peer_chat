const express = require('express');
const http = require('http');
const { Server } = require('socket.io'); // export class that allows real time connection between server and browser
const pool = require('./database');
const { PORT, PUBLIC_DIR } = require('./config');
const { registerConnectionHandlers } = require('./handlers/connection'); // export method that handles on every user connection

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve the browser client and its assets from the public folder.
app.use(express.static(PUBLIC_DIR));

// Forward each socket connection to the dedicated connection handler.
// كلما عميل جديد يتصل عبر Socket.IO، ينفذ هذا الكود.
// يمرر:
// io لإرسال/استقبال رسائل سوكِت،
// pool للتعامل مع قاعدة البيانات،
// socket وهو اتصال المستخدم الحالي.
io.on('connection', (socket) => {
  registerConnectionHandlers(io, pool, socket);
});

// Start the HTTP server on the configured port.
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});