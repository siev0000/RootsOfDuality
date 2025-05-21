let allFiles = [];

async function loadEffectFileList() {
  try {
    const res = await fetch("/list-all");
    const list = await res.json();
    if (Array.isArray(list)) {
      allFiles = list;
      console.log("✅ エフェクト一覧:", allFiles);
      populateEffectSelector()
    } else {
      console.error("❌ 無効な形式:", list);
    }
  } catch (err) {
    console.error("❌ エフェクト一覧取得失敗:", err);
  }
}

// 取得したファイル名でセレクトを埋める
function populateEffectSelector() {
  const selector = document.getElementById("effect-selector");
  selector.innerHTML = "";

  allFiles.forEach(file => {
    const option = document.createElement("option");
    option.value = file;
    option.textContent = file;
    selector.appendChild(option);
  });
}

function playSelected() {
  const selector = document.getElementById("effect-selector");
  const selectedFile = selector.value;
  const effectFrame = document.getElementById("effect-frame");

  if (!selectedFile) {
    alert("ファイルを選択してください");
    return;
  }

  const src = `/assets/effect/エフェクト集/320×240/${encodeURIComponent(selectedFile)}`;
  effectFrame.src = src;
}

function playSpriteAnimation({
  frameWidth = 120,
  frameCount = 6,
  interval = 100, // ms
  imageId = "sprite-image"
}) {
  const img = document.getElementById(imageId);
  let current = 0;

  const timer = setInterval(() => {
    const x = -frameWidth * current;
    img.style.objectPosition = `${x}px 0`;
    current++;

    if (current >= frameCount) {
      clearInterval(timer);
    }
  }, interval);
}
