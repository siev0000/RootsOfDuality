// p2p.js（クライアント側 WebRTC + WebSocket 連携）
const peerConnections = {}; // userId → RTCPeerConnection
const dataChannels = {};    // userId → RTCDataChannel
const receivedAnswerFlags = {}; // userId → true/false

const config = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" }
  ]
};

function setupRoom(roomId, isHostFlag) {
  isHost = isHostFlag;
  currentRoomId = roomId;

  const wsProtocol = location.protocol === 'https:' ? 'wss' : 'ws';
  socket = new WebSocket(`${wsProtocol}://${location.host}`);

  socket.onopen = () => {
    socket.send(JSON.stringify({
      type: isHost ? "createRoom" : "joinRoom",
      userId,
      roomId,
      username,
      selectedDeckId,
      selectedDeckName
    }));
  };

  socket.onmessage = async (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log("受信:",data.userId, data.type, data.state);
  
      switch (data.type) {
        case "roomCreated":
          console.log("部屋作成完了。相手の参加を待ちます。");
          break;
  
        case "joinedRoom":
          console.log("部屋参加成功。既存プレイヤー:", data.players);
          data.players.forEach(p => {
            addOpponentToUI(p);
            if (!isHost) {
              initializeWebRTC(p.userId, false);
            }
          });
          break;
  
        case "playerJoined":
          addOpponentToUI(data);
          if (isHost && !peerConnections[data.userId]) {
            initializeWebRTC(data.userId, true);
          }
          break;

        case "playerReady":
          if (data.userId !== userId) {
            document.getElementById("opponent-status").textContent = "準備完了";
            document.getElementById("opponent-status").style.color = "#0f0";
            enemyState = data.state
            opponentReady = true;
          }
          checkBothReady();
          break;
  
        case "cancelReady":
          if (data.userId !== userId) {
            document.getElementById("opponent-status").textContent = "未準備";
            document.getElementById("opponent-status").style.color = "#f33";
            opponentReady = false;
          }
          checkBothReady();
          break;

        case "offer":
          await handleOffer(data);
          break;
  
        case "answer":
          if (peerConnections[data.userId]?.signalingState === "stable") {
            console.warn("受信した answer を無視（状態はすでに stable）");
            return;
          }
          await handleAnswer(data);
          break;

        case "iceCandidate":
          await handleIceCandidate(data);
          break;
  
        case "candidate":
          await handleIceCandidate(data);
          break;
      }
    } catch (err) {
      console.error("onmessage内でエラー:", err);
    }
  };
  
}

function initializeWebRTC(remoteUserId, isInitiator) {
  console.warn(" initializeWebRTC : ", remoteUserId, isInitiator);
  const pc = new RTCPeerConnection(config);
  peerConnections[remoteUserId] = pc;

  pc.oniceconnectionstatechange = () => {
    console.log("ICE Connection State (", remoteUserId, "):", pc.iceConnectionState);
  };

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      // console.log("送信 ICE Candidate initializeWebRTC:", event.candidate);
      socket.send(JSON.stringify({
        type: "candidate",
        target: remoteUserId,
        candidate: event.candidate,
        userId,
        roomId: currentRoomId
      }));
    }
  };


  if (isInitiator) {
    console.log("送信 ICE Candidate initializeWebRTC: offerを出した");
    const channel = pc.createDataChannel("battle");
    dataChannels[remoteUserId] = channel;
    setupRTCMessageHandler(channel);

    pc.createOffer()
      .then(offer => pc.setLocalDescription(offer))
      .then(() => {
        socket.send(JSON.stringify({
          type: "offer",
          target: remoteUserId,
          offer: pc.localDescription,
          userId,
          roomId: currentRoomId
        }));
      })
      .catch(err => {
        console.error("Offer作成/送信失敗:", err);
      });
    
  } else {
    console.log("送信 ICE Candidate initializeWebRTC: ☓");
    pc.ondatachannel = (event) => {
      const channel = event.channel;
      dataChannels[remoteUserId] = channel;
      setupRTCMessageHandler(channel);
    };
  }
}

function handleBattleData(event) {
  const data = JSON.parse(event.data);

  switch (data.type) {
    case "ping":
      console.log("Ping受信:", data);
      break;

    case "updateBattle":
      updateBattleUI(data.state); // ← あなたの処理に応じて調整
      break;

    default:
      console.warn("未定義のデータタイプ:", data);
  }
}

async function handleOffer(data) {
  const pc = new RTCPeerConnection(config);
  peerConnections[data.userId] = pc;

  pc.oniceconnectionstatechange = () => {
    console.log("ICE Connection State (", data.userId, "):", pc.iceConnectionState);
  };

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      console.log("送信 ICE Candidate handleOffer:", event.candidate);
      socket.send(JSON.stringify({
        type: "candidate",
        target: data.userId,
        candidate: event.candidate,
        userId,
        roomId: currentRoomId
      }));
    }
  };

  pc.ondatachannel = (event) => {
    const channel = event.channel;
    dataChannels[data.userId] = channel;
    setupRTCMessageHandler(channel);
  };

  try {
    await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socket.send(JSON.stringify({
      type: "answer",
      target: data.userId,
      answer: pc.localDescription,
      userId,
      roomId: currentRoomId
    }));
  } catch (err) {
    console.error("handleOffer 失敗:", err);
  }
}

async function handleAnswer(data) {
  const pc = peerConnections[data.userId];
  if (!pc) {
    console.warn("PeerConnectionが見つかりません（answer）:", data.userId);
    return;
  }

  // ✅ すでに処理済みなら絶対に return
  if (receivedAnswerFlags[data.userId]) {
    console.warn("この相手の answer はすでに処理済みです:", data.userId);
    return;
  }

  // ✅ signalingState が不正なら return
  if (pc.signalingState !== "have-local-offer") {
    console.warn("受信した answer を無視（状態は", pc.signalingState, "）");
    return;
  }

  try {
    console.log("Remote answer を適用します:", data.answer);
    await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
    receivedAnswerFlags[data.userId] = true; // ✅ 処理済みフラグを立てる
  } catch (err) {
    console.error("setRemoteDescription 失敗:", err);
  }
}

async function handleIceCandidate(data) {
  const pc = peerConnections[data.userId];
  if (!pc) {
    console.warn("PeerConnectionが見つかりません（ICE）:", data.userId);
    return;
  }

  console.log("受信 ICE Candidate:", data.candidate);

  try {
    await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
    console.log("ICE Candidate 追加完了:", data.candidate);
  } catch (err) {
    console.error("ICE Candidate追加エラー:", err);
  }
}

function enterRoomUI(roomId) {
  currentRoomId = roomId;

  // UI切替
  document.getElementById("matching-options").style.display = "none";
  document.getElementById("room-ui").style.display = "block";

  // 表示内容の更新
  document.getElementById("room-id-label").textContent = roomId;
  document.getElementById("self-name").textContent = username;
  updateSelectedDeckDisplay();

  // 退出ボタン
  document.getElementById("exit-room-button").onclick = () => {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          type: "leaveRoom",
          userId: userId,
          roomId: currentRoomId,
          state: playerState
        })
      );
      socket.close();
    }

    document.getElementById("room-ui").style.display = "none";
    document.getElementById("matching-options").style.display = "block";

    currentRoomId = null;
    isHost = false;
    isReady = false;
    opponentReady = false;
    peerConnections = {};
    dataChannels = {};
  };


  // 準備ボタン
  document.getElementById("ready-button").onclick = () => {
    const btn = document.getElementById("ready-button");
    const settingsBtn = document.getElementById("open-settings-button");
    if (!isReady) {
      isReady = true;
      btn.textContent = "準備済み（解除する）";
      btn.classList.add("ready-state");
      document.getElementById("self-deck-label").style.color = "#0f0";

      if (isHost && settingsBtn) settingsBtn.disabled = true;

      socket?.readyState === WebSocket.OPEN &&
        socket.send(
          JSON.stringify({
            type: "playerReady",
            username: username,
            userId: userId,
            roomId: currentRoomId,
            state: playerState
          })
        );
    } else {
      isReady = false;
      btn.textContent = "準備完了";
      btn.classList.remove("ready-state");
      document.getElementById("self-deck-label").style.color = "";

      if (isHost && settingsBtn) settingsBtn.disabled = false;

      socket?.readyState === WebSocket.OPEN &&
        socket.send(
          JSON.stringify({
            type: "cancelReady",
            username: username,
            userId: userId,
            roomId: currentRoomId,
            state: playerState
          })
        );
    }
    checkBothReady()
  };

  // ホストなら設定ボタンを表示
  if (isHost) {
    document.getElementById("open-settings-button").style.display = "inline-block";
  }

  // ボタン動作
  document.getElementById("open-settings-button").onclick = () => {
    document.getElementById("settings-dialog").style.display = "flex";
  };

  document.getElementById("close-settings-button").onclick = () => {
    document.getElementById("settings-dialog").style.display = "none";
  };

  document.getElementById("save-settings-button").onclick = () => {
    matchSettings = {
      maxHP: parseInt(document.getElementById("setting-maxhp").value),
      initialPP: parseInt(document.getElementById("setting-initpp").value),
      ppGainPerTurn: parseInt(document.getElementById("setting-ppgain").value),
      initialHand: parseInt(document.getElementById("setting-inithand").value),
      maxPP: parseInt(document.getElementById("setting-maxpp").value),
      firstPlayerMethod: document.getElementById("setting-firstplayer").value,
      firstPlayerDraws: document.getElementById("setting-firstdraw").value
    };
    console.log("✅ 対戦設定を保存:", matchSettings);
    document.getElementById("settings-dialog").style.display = "none";
  };
  // P2Pで送信
  sendWebRTCData({
    type: "matchSettings",
    settings: matchSettings
  });
}

function setupRTCMessageHandler(channel) {
  console.log("setupRTCMessageHandler", channel)
  channel.onopen = () => {
    console.log("[WebRTC] DataChannel OPEN:", channel.label);
  };

  channel.onmessage = (event) => {
    const data = JSON.parse(event.data);
    handleRTCData(data);
  };
}

// ＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝
// P2P機能
// ＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝

// メッセージ送信処理
function sendTestMessage() {
  const msg = document.getElementById("messageInput").value;
  const chatData = {
    type: "chatMessage",
    content: msg,
    from: userId,
    username: username,
  };
  sendWebRTCData(chatData);
}
// メッセージ表示
function displayChatMessage(data) {
  console.log(`[メッセージ表示] ${data.username}: ${data.content}`);
}

// Battleデータ送信
function sendBattleUpdate() {
  const BattleData = {
    type: "updateBattle",
    from: userId,
    username: username,
    state: playerState, // ← 自分の現在のステータスを送信
  };
  sendWebRTCData(BattleData);
}
// Battleデータ受信
async function updateBattleUI(data) {
  console.log("updateBattleUI", data);
  enemyState = data.state;
  // await updateZoneCounts(data.playerState, "enemy-ui-bar");
  updateZoneCounts( enemyState, "enemy-ui-bar");
  renderEnemyField();
  renderCostBar( enemyState.pp, enemyState.maxpp, true );
  updateLifeDisplay()
}


// ======================================
// P2P通信処理
// ======================================

// P2P送信処理
function sendWebRTCData(data) {
  if (!data || !data.type) {
    console.warn("送信データに 'type' が指定されていません", data);
    return;
  }

  Object.values(dataChannels).forEach(channel => {
    if (channel.readyState === "open") {
      channel.send(JSON.stringify(data));
      console.log("[送信]", data);
    } else {
      console.warn("DataChannel が open ではありません", channel);
    }
  });
}

// PsP受信処理
function handleRTCData(data) {
  console.log(`[受信] ${data.username}`, data);
  
  switch (data.type) {
    case "battleStart":
      // 例: battle.js にある処理を呼び出し
      handleBattleStart(data);
      break;

    case "updateBattle":
      updateBattleUI(data);
      break;

    case "turnStart":
      // 例: battle.js にある処理を呼び出し
      handleBattleStart(data);
      break;

    case "turnEnd":
      updateBattleUI(data);
      break;

    case "turnPassed":
      enemyState.isTurn = false;
      playerState.isTurn = true;
      playerState.turnStarted = false;
    
      showTurnDialog(playerState.settings.username);
      updateTurnButtons(); // ← ボタン更新
      break;
      

    case "chatMessage":
      displayChatMessage(data);
      break;

    case "cardMoved":
      onOpponentMoveCard(data);
      break;

    case "effectTriggered":
      handleEffectTrigger(data.effectId);
      break;

      case "matchSettings":
        console.log("対戦設定を受信:", data.settings);
        matchSettings = data.settings;
        break;      
     

    case "battleEnd":
      console.log("相手からバトル終了:", data.reason, "→ 自分の結果:", data.result);
    
      // カウント用変数があれば加算
      if (data.result === "win") battleStats.win++;
      else if (data.result === "lose") battleStats.lose++;
      else battleStats.draw++;
    
      console.log(`勝利:${battleStats.win} 敗北:${battleStats.lose} 引き分け:${battleStats.draw}`);    
      // 表示メッセージ（任意）
      alert(`バトル終了：あなたの${data.result === "win" ? "勝利" : data.result === "lose" ? "敗北" : "引き分け"}`);
    
      initDeckState()
      updateWinDisplay()
      resetBattleUI()
      break;
    

    default:
      console.warn("未定義の WebRTC type:", data.type);
  }
}


// ==============================
// 🔽 マッチング機能（HTML読み込み後に実行）
// ==============================

function bindMatchingEvents() {
  const createBtn = document.getElementById("create-room-button");
  const joinBtn = document.getElementById("join-room-button");

  if (createBtn && joinBtn) {
    createBtn.addEventListener("click", createRoom);
    joinBtn.addEventListener("click", joinRoom);
  } else {
    console.warn("マッチングボタンが見つかりませんでした");
  }
}

// 部屋作成
function createRoom() {
  console.log("部屋作成:");
  const roomId = generateRoomId();
  isHost = true;
  setupRoom(roomId, isHost);
  enterRoomUI(roomId);
}

// 部屋参加
function joinRoom() {
  console.log("参加する :");
  document.getElementById("matching-options").style.display = "none";
  document.getElementById("room-info").style.display = "block";
  document.getElementById("room-id-input").style.display = "inline-block";
  document.getElementById("cancel-join-button").style.display = "inline-block";
  document.getElementById("submit-room-button").style.display = "inline-block";

  document.getElementById("submit-room-button").onclick = () => {
    const roomId = document.getElementById("room-id-input").value.trim();

    // 🔍 5桁チェック（数字限定 or 任意の文字列どちらでも対応）
    if (!/^\d{5}$/.test(roomId)) {
      alert("部屋番号は5桁の数字で入力してください。");
      return;
    }

    isHost = false;
    setupRoom(roomId, isHost);
    enterRoomUI(roomId);

    document.getElementById("room-info").style.display = "none";
  };

  // 退出ボタン
  document.getElementById("cancel-join-button").onclick = () => {
    document.getElementById("room-id-input").value = ""; // 入力初期化
    document.getElementById("room-info").style.display = "none";
    document.getElementById("matching-options").style.display = "block";
    document.getElementById("cancel-join-button").style.display = "none"; // ✅ 戻ると非表示に
  };
  
}

// サーバーに準備完了を送る処理
function sendReadyStatus() {
  if (
    socket &&
    socket.readyState === WebSocket.OPEN &&
    currentRoomId &&
    userId
  ) {
    socket.send(
      JSON.stringify({
        type: "playerReady",
        userId: userId,
        roomId: currentRoomId,
      })
    );
  } else {
    console.warn("WebSocket接続または部屋情報が未定義です");
  }
}

function generateRoomId() {
  return Math.floor(10000 + Math.random() * 90000).toString();
}

// マッチング完了後の切替（例：WebRTCから呼び出し）
function onMatchingComplete(receivedDeck) {
  // EXと通常カードを分離
  const exDeck = [];
  const drawPile = [];

  for (const card of receivedDeck) {
    if (card.レアリティ === "EX") {
      exDeck.push(card);
    } else {
      drawPile.push(card);
    }
  }

  // 状態に反映
  playerState.exDeck = exDeck;
  playerState.drawPile = drawPile;
  localPlayerDeck = receivedDeck;
  console.log("onMatchingComplete :playerState", playerState)

  startBattleFlow();
}



// 6. 両者準備完了チェック
async function checkBothReady() {

  const notice = document.getElementById("both-ready-notice");
  if (isReady && opponentReady) {
    notice.textContent = "両者の準備が完了しました！";
    notice.style.display = "block";
    console.log("両者の準備が完了しました！", playerState);
    console.log("両者準備完了、バトル画面へ移行", enemyState);

    // マッチングエリア非表示
    document.getElementById("matching-area").style.display = "none";
    // バトルエリア表示
    document.getElementById("battle-area").style.display = "block";
		await battleStart()
  } else {
    notice.style.display = "none";
  }
  // sendBattleUpdate()
}

// Battle終了後のUI
function resetBattleUI() {
  document.getElementById("battle-area").style.display = "none";
  document.getElementById("matching-area").style.display = "block";
  document.getElementById("both-ready-notice").style.display = "none";

  isReady = false;
  opponentReady = false;

  const readyBtn = document.getElementById("ready-button");
  if (readyBtn) {
    readyBtn.textContent = "準備完了";
    readyBtn.classList.remove("ready-state");
  }

  document.getElementById("self-deck-label").style.color = "";
  document.getElementById("opponent-status").textContent = "未準備";
  document.getElementById("opponent-status").style.color = "#f33";
}
