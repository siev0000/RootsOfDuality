// webrtcHandler.js
const rooms = {}; // 部屋ID → ルーム情報

function setupWebRTC(wss) {
  wss.on('connection', ws => {
    ws.on('message', message => {
      const data = JSON.parse(message);

      switch (data.type) {
        case "createRoom": {
          if (rooms[data.roomId]) {
            ws.send(JSON.stringify({ type: "error", message: "その部屋IDは既に存在します" }));
            return;
          }

          const newPlayer = {
            userId: data.userId,
            username: data.username,
            ws: ws
          };

          rooms[data.roomId] = {
            host: data.userId,
            players: [newPlayer]
          };

          ws.send(JSON.stringify({ type: "roomCreated", roomId: data.roomId }));
          break;
        }

        case "joinRoom": {
          const room = rooms[data.roomId];
          if (!room) {
            ws.send(JSON.stringify({ type: "error", message: "部屋が存在しません" }));
            return;
          }

          const newPlayer = {
            userId: data.userId,
            username: data.username,
            ws: ws
          };
          room.players.push(newPlayer);

          // 参加者に既存プレイヤー情報を送る
          const otherPlayers = room.players.filter(p => p.userId !== data.userId);
          ws.send(JSON.stringify({
            type: "joinedRoom",
            roomId: data.roomId,
            players: otherPlayers.map(p => ({ userId: p.userId, username: p.username }))
          }));

          // 既存プレイヤーに新規参加者を通知
          room.players.forEach(p => {
            if (p.userId !== data.userId && p.ws.readyState === ws.OPEN) {
              p.ws.send(JSON.stringify({
                type: "playerJoined",
                userId: newPlayer.userId,
                username: newPlayer.username
              }));
            }
          });
          break;
        }
        case "playerReady": {
          const room = rooms[data.roomId];
          if (!room) break;
        
          if (!room.ready) room.ready = new Set();
          room.ready.add(data.userId);
        
          // 中継：相手に送信
          room.players.forEach(p => {
            if (p.ws !== ws && p.ws.readyState === ws.OPEN) {
              p.ws.send(JSON.stringify(data));
            }
          });
        
          // 両方準備完了 → battleStartを送る（任意）
          if (room.ready.size === 2) {
            room.players.forEach(p => {
              if (p.ws.readyState === ws.OPEN) {
                p.ws.send(JSON.stringify({ type: "bothReady" }));
              }
            });
          }
          break;
        }
        
        case "cancelReady": {
          const room = rooms[data.roomId];
          if (!room) break;
        
          if (!room.ready) room.ready = new Set();
          room.ready.delete(data.userId);
        
          // 中継：相手に送信
          room.players.forEach(p => {
            if (p.ws !== ws && p.ws.readyState === ws.OPEN) {
              p.ws.send(JSON.stringify(data));
            }
          });
        
          break;
        }
        
        case "offer":
        case "answer":
        case "candidate": {
          const room = rooms[data.roomId];
          if (!room) break;
        
          const targetPlayer = room.players.find(p => p.userId === data.target);
          if (targetPlayer && targetPlayer.ws.readyState === ws.OPEN) {
            const forwardData = {
              type: data.type,
              userId: data.userId,
              roomId: data.roomId
            };
        
            if (data.type === "offer") {
              forwardData.offer = data.offer;
            } else if (data.type === "answer") {
              forwardData.answer = data.answer;
            } else if (data.type === "candidate") {
              forwardData.candidate = data.candidate;
            }
        
            targetPlayer.ws.send(JSON.stringify(forwardData));
          }
          break;
        }
      }
    });
  });
}

module.exports = { setupWebRTC };  // 再登録