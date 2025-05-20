function openUniversalModal({
  type = "info",
  title = "ファンタジー風モーダル",
  content = "",
  buttons = [],
  vertical = false, // 縦に並べるかどうか
  backgroundOpacity = 1.0, // モーダル本体の透明度 (0.0 ～ 1.0)
}) {
  const modal = document.getElementById("universal-modal");
  const modalTitle = document.getElementById("modal-title");
  const modalBody = document.getElementById("modal-body");
  const modalFooter = document.getElementById("modal-footer");
  const modalIcon = document.getElementById("modal-icon");
  const modalHeader = modal.querySelector(".u-modal__header");
  const modalContent = modal.querySelector(".u-modal__content");
  const modalClose = modal.querySelector(".u-modal__close");
  const overlay = document.querySelector('modal-overlay');

  // 背景透明度が0の場合、モーダル全体を透明化（ボーダーや影も削除）
  if (backgroundOpacity === 0) {
    modalContent.style.background = "none";
    modalContent.style.border = "none";
    modalContent.style.boxShadow = "none";

    // タイトル、本文、アイコン、ヘッダーの境界線を非表示
    modalTitle.style.display = "none";
    modalBody.style.display = "none";
    modalIcon.style.display = "none";
    modalHeader.style.borderBottom = "none";
    modalClose.style.display = "none";
  } else {
    // 通常表示
    modalContent.style.background = `radial-gradient(circle, rgba(253, 241, 220, ${backgroundOpacity}), rgba(219, 192, 151, ${backgroundOpacity}))`;
    modalContent.style.border = "0.5em solid #6b4226";
    modalContent.style.boxShadow = "0 0 2em rgba(0, 0, 0, 0.5)";

    // タイトル、本文、アイコン、ヘッダーの境界線を表示
    modalTitle.style.display = "block";
    modalBody.style.display = "block";
    modalIcon.style.display = "inline-block";
    modalHeader.style.borderBottom = "0.1em solid #5a3e2b"; // 元のスタイルに戻す
    modalClose.style.display = "block";
  }

  // タイプに応じたアイコン設定
  const iconMap = {
    info: "🪄",
    warning: "⚠️",
    error: "❌",
    success: "✅",
  };
  modalIcon.textContent = iconMap[type] || "🪄";

  // タイトルと本文の設定
  modalTitle.textContent = title;
  modalBody.innerHTML = content;

  // フッターボタンを生成
  modalFooter.innerHTML = "";
  modalFooter.className = vertical
    ? "u-modal__footer u-modal__footer--vertical" // 縦並びのクラス
    : "u-modal__footer";
  buttons.forEach((button) => {
    const btn = document.createElement("button");
    btn.textContent = button.label;
    btn.className = "u-modal__button";
    btn.onclick = button.onClick;
    modalFooter.appendChild(btn);
  });

  // モーダルを表示
  modal.style.display = "block";

  // 必要に応じてテーブルヘッダーを調整
  setTimeout(() => {
    adjustTableHeader();
  }, 0);
}

function closeUniversalModal() {
  const modal = document.getElementById("universal-modal");
  overlay = "none";
  modal.style.display = "none";
}

function adjustTableHeader() {
const table = document.querySelector(".u-modal__table");
if (!table) {
  console.warn(
    "テーブルが見つかりません。adjustTableHeaderの呼び出しタイミングを確認してください。"
  );
  return;
}

const thead = table.querySelector("thead");
const tbody = table.querySelector("tbody");

if (!thead || !tbody) {
  console.warn("theadまたはtbodyが見つかりません。");
  return;
}

// スクロールバー幅を取得
const scrollbarWidth = tbody.offsetWidth - tbody.clientWidth;

// theadの幅を調整
thead.style.width = `calc(100% - ${scrollbarWidth}px)`;
}

// テスト ================================================================
async function openUniversalModalWithSwitch() {
  const initialContent = "choices"; // 初期コンテンツを設定 ("choices" または "table")

  let currentContent = initialContent;

  function showChoices() {
    openUniversalModal({
      type: "info",
      title: "選択肢",
      content: `
            <p>冒険者よ、どの項目を選びますか？</p>
          `,
      buttons: [
        {
          label: "テーブル一覧を表示",
          onClick: showTable,
        },
        {
          label: "閉じる",
          onClick: closeUniversalModal,
        },
      ],
      vertical: true,
    });
  }

  function showTable() {
    openUniversalModal({
      type: "info",
      title: "冒険者の一覧",
      content: `
            <p>冒険者たちのステータスを確認できます。</p>
            <table class="u-modal__table">
              <thead>
                <tr>
                  <th>名前</th>
                  <th>職業</th>
                  <th>レベル</th>
                  <th>HP</th>
                </tr>
              </thead>
              <tbody>
                ${Array(10)
                  .fill(null)
                  .map(
                    (_, i) =>
                      `<tr>
                         <td>冒険者${i + 1}</td>
                         <td>${["戦士", "盗賊", "僧侶", "魔法使い"][i % 4]}</td>
                         <td>${10 + i}</td>
                         <td>${100 + i * 5}</td>
                       </tr>`
                  )
                  .join("")}
              </tbody>
            </table>
          `,
      buttons: [
        {
          label: "選択肢に戻る",
          onClick: showChoices,
        },
        {
          label: "閉じる",
          onClick: closeUniversalModal,
        },
      ],
      vertical: true,
    });

    // adjustTableHeaderを描画後に実行
    setTimeout(() => {
      adjustTableHeader();
    }, 0);
  }

  // 初期コンテンツを表示
  if (currentContent === "choices") {
    showChoices();
  } else {
    showTable();
  }
}

function openModal(){
  openUniversalModal({
    type: "info",
    title: "半透明背景のモーダル",
    content: "<p>このモーダルの背景は半透明です。</p>",
    buttons: [{ label: "閉じる", onClick: closeUniversalModal }],
    vertical: false,
    backgroundOpacity: 0.0, // 背景を50%の透明度に
  });
}

