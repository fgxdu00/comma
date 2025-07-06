const express = require('express');
const WebSocket = require('ws');
const http = require('http');

const app = express();
app.use(express.static('public'));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('🟢 Client connected. Total:', wss.clients.size);

  ws.on('message', (msg) => {
    // always broadcast text
    const str = typeof msg === 'string' ? msg : msg.toString();
    console.log('📨 Relaying message:', str.slice(0, 50), '…');
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(str);
      }
    });
  });

  ws.on('close', () => {
    console.log('🔴 Client disconnected. Total:', wss.clients.size);
  });
});

server.listen(3000, () =>
  console.log('🚀 Server listening on http://localhost:3000')
);
