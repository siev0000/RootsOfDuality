const express = require('express');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');
const cors = require('cors');
const dotenv = require('dotenv');
const { setupWebRTC } = require('./webrtcHandler');

dotenv.config();
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
setupWebRTC(wss);

wss.on('connection', ws => {
  console.log('クライアント接続');
  ws.on('close', () => {
    console.log('切断されました');
  });
});

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// 静的ファイル提供
app.use(express.static(path.join(__dirname, 'public')));

// ルートアクセス
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html')); // または dashboard.html
});

app.use(cors());
app.use(express.json());
app.use('./data/assets', express.static('assets'));
app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res) => {
  res.status(404).send('404: ページが見つかりません');
});

server.listen(PORT, HOST, () => {
  console.log(`サーバーが起動しました: http://localhost:${PORT}`);
});
