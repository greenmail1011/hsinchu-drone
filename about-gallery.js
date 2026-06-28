/* ============================================================
   關於協會 — 相簿模組 (about-gallery.js)
   自包含：前台縮圖牆 + 點擊放大燈箱 + 後台管理（登入後出現）
   資料來源：Firestore 集合 "aboutGallery" {url, caption, order, active}
   ============================================================ */
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyD2rqiTQjgYQN4JrLlVFJZbmgLuQvliySk",
  authDomain: "hsinchu-drone.firebaseapp.com",
  projectId: "hsinchu-drone",
  storageBucket: "hsinchu-drone.firebasestorage.app",
  messagingSenderId: "944428960229",
  appId: "1:944428960229:web:a3d7a894cb312458a9870c"
};

// 共用首頁已初始化的 App（共享登入狀態）；若尚未初始化則自行建立
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
// 存進現有且已具備管理員寫入權限的 content 集合，用 kind 欄位區分（免改 Firestore 規則）
const COL = "content";
const KIND = "aboutGallery";

// 預設備援照片（資料庫尚無資料時顯示）
const DEFAULTS = [
  { url: "about-1.webp", caption: "追風少年科技培力課程", order: 1, active: true },
  { url: "about-3.webp", caption: "追風少年科技培力課程", order: 2, active: true },
  { url: "about-2.webp", caption: "追風少年科技培力課程", order: 3, active: true }
];

let CURRENT = [];      // 目前清單（含 id）
let isAdmin = false;

/* ---------- 樣式 ---------- */
function injectCSS() {
  if (document.getElementById("ag-style")) return;
  const css = `
  .ag-gallery{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin:48px auto 0;max-width:980px}
  .ag-item{margin:0;position:relative;cursor:zoom-in;border-radius:14px;overflow:hidden;box-shadow:0 6px 22px rgba(26,58,107,.14);transition:transform .18s,box-shadow .18s}
  .ag-item:hover{transform:translateY(-3px);box-shadow:0 10px 30px rgba(26,58,107,.22)}
  .ag-item img{display:block;width:100%;height:180px;object-fit:cover}
  .ag-item figcaption{position:absolute;left:0;right:0;bottom:0;padding:18px 12px 8px;font-size:13px;color:#fff;background:linear-gradient(transparent,rgba(10,22,40,.82))}
  .ag-hint{text-align:center;color:#8a9ab0;font-size:13px;margin-top:16px}
  @media(max-width:640px){.ag-gallery{grid-template-columns:1fr 1fr}.ag-item img{height:140px}}
  /* 燈箱 */
  .ag-lb{position:fixed;inset:0;background:rgba(8,15,30,.92);display:none;align-items:center;justify-content:center;z-index:3000;padding:24px}
  .ag-lb.open{display:flex}
  .ag-lb img{max-width:96vw;max-height:86vh;border-radius:10px;box-shadow:0 12px 50px rgba(0,0,0,.5)}
  .ag-lb .ag-cap{position:absolute;bottom:18px;left:0;right:0;text-align:center;color:#dfe8f5;font-size:14px;padding:0 16px}
  .ag-lb button{position:absolute;background:rgba(255,255,255,.15);border:none;color:#fff;cursor:pointer}
  .ag-lb .ag-x{top:18px;right:24px;font-size:30px;width:46px;height:46px;border-radius:50%;line-height:1}
  .ag-lb .ag-nav{top:50%;transform:translateY(-50%);font-size:26px;width:50px;height:50px;border-radius:50%}
  .ag-lb .ag-prev{left:20px}.ag-lb .ag-next{right:20px}
  /* 後台 */
  #ag-admin-fab{position:fixed;bottom:28px;right:28px;z-index:2500;background:#1a3a6b;color:#fff;border:none;border-radius:24px;padding:12px 18px;font-size:14px;cursor:pointer;box-shadow:0 4px 20px rgba(26,58,107,.35);display:none}
  #ag-admin-fab:hover{background:#234e8f}
  .ag-modal{position:fixed;inset:0;background:rgba(10,22,40,.55);z-index:3200;display:none;align-items:flex-start;justify-content:center;padding:40px 16px;overflow:auto}
  .ag-modal.open{display:flex}
  .ag-panel{background:#fff;border-radius:14px;max-width:680px;width:100%;padding:24px;box-shadow:0 20px 60px rgba(0,0,0,.3)}
  .ag-panel h3{margin:0 0 4px;font-size:19px;color:#1a2333}
  .ag-panel .desc{color:#8a9ab0;font-size:13px;margin:0 0 18px}
  .ag-row{display:flex;gap:12px;align-items:center;border:1px solid #e6ebf3;border-radius:10px;padding:10px;margin-bottom:10px}
  .ag-row img{width:84px;height:60px;object-fit:cover;border-radius:6px;flex:none}
  .ag-row .f{flex:1;display:flex;flex-direction:column;gap:6px}
  .ag-row input[type=text]{border:1px solid #d6deea;border-radius:6px;padding:7px 9px;font-size:13px;width:100%}
  .ag-row .meta{display:flex;gap:10px;align-items:center;font-size:12px;color:#5a6880}
  .ag-row .meta input[type=number]{width:56px;border:1px solid #d6deea;border-radius:6px;padding:4px 6px}
  .ag-btn{border:none;border-radius:7px;padding:8px 14px;font-size:13px;cursor:pointer}
  .ag-save{background:#1a3a6b;color:#fff}
  .ag-del{background:#fff;color:#c0392b;border:1px solid #e3b4ad}
  .ag-add{background:#0a7d33;color:#fff;width:100%;padding:11px;margin-top:6px}
  .ag-close{background:#eef2f8;color:#33415c}
  .ag-foot{display:flex;justify-content:flex-end;gap:10px;margin-top:14px}
  .ag-up{font-size:12px;color:#0077cc}
  `;
  const s = document.createElement("style");
  s.id = "ag-style"; s.textContent = css;
  document.head.appendChild(s);
}

/* ---------- 燈箱 ---------- */
let lbEl, lbImg, lbCap, lbIndex = 0, lbList = [];
function buildLightbox() {
  if (lbEl) return;
  lbEl = document.createElement("div");
  lbEl.className = "ag-lb";
  lbEl.innerHTML = `<button class="ag-x">&times;</button>
    <button class="ag-nav ag-prev">&#8249;</button>
    <img alt="">
    <button class="ag-nav ag-next">&#8250;</button>
    <div class="ag-cap"></div>`;
  document.body.appendChild(lbEl);
  lbImg = lbEl.querySelector("img"); lbCap = lbEl.querySelector(".ag-cap");
  lbEl.querySelector(".ag-x").onclick = () => lbEl.classList.remove("open");
  lbEl.querySelector(".ag-next").onclick = (e) => { e.stopPropagation(); showLb(lbIndex + 1); };
  lbEl.querySelector(".ag-prev").onclick = (e) => { e.stopPropagation(); showLb(lbIndex - 1); };
  lbEl.addEventListener("click", (e) => { if (e.target === lbEl) lbEl.classList.remove("open"); });
  document.addEventListener("keydown", (e) => {
    if (!lbEl.classList.contains("open")) return;
    if (e.key === "Escape") lbEl.classList.remove("open");
    if (e.key === "ArrowRight") showLb(lbIndex + 1);
    if (e.key === "ArrowLeft") showLb(lbIndex - 1);
  });
}
function showLb(i) {
  if (!lbList.length) return;
  lbIndex = (i + lbList.length) % lbList.length;
  lbImg.src = lbList[lbIndex].url;
  lbCap.textContent = lbList[lbIndex].caption || "";
  lbEl.classList.add("open");
}

/* ---------- 前台渲染 ---------- */
function render() {
  const section = document.getElementById("about");
  if (!section) return;
  let host = section.querySelector(".ag-gallery");
  const visible = CURRENT.filter(x => x.active !== false).sort((a, b) => (a.order || 0) - (b.order || 0));
  lbList = visible;
  if (!host) {
    // 移除原本單張 figure，建立 gallery 容器
    const oldFig = section.querySelector("figure");
    host = document.createElement("div");
    host.className = "ag-gallery";
    if (oldFig) oldFig.replaceWith(host);
    else section.appendChild(host);
  }
  host.innerHTML = visible.map((s, i) => `
    <figure class="ag-item" data-i="${i}">
      <img loading="lazy" src="${s.url}" alt="${(s.caption || '活動照片').replace(/"/g, '')}">
      ${s.caption ? `<figcaption>${s.caption}</figcaption>` : ""}
    </figure>`).join("");
  host.querySelectorAll(".ag-item").forEach(el => {
    el.addEventListener("click", () => showLb(+el.dataset.i));
  });
  // 點擊放大提示（只加一次）
  if (!host.nextElementSibling || !host.nextElementSibling.classList.contains("ag-hint")) {
    const hint = document.createElement("div");
    hint.className = "ag-hint"; hint.textContent = "🔍 點縮圖看完整大圖";
    host.after(hint);
  }
}

/* ---------- 載入資料 ---------- */
async function load() {
  try {
    const snap = await getDocs(collection(db, COL));
    CURRENT = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(x => x.kind === KIND)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  } catch (e) {
    CURRENT = [];
  }
  if (!CURRENT.length) CURRENT = DEFAULTS.map(d => ({ ...d })); // 備援
  render();
}

/* ---------- 後台管理 ---------- */
let modalEl;
function buildAdminUI() {
  if (document.getElementById("ag-admin-fab")) return;
  const fab = document.createElement("button");
  fab.id = "ag-admin-fab"; fab.textContent = "✎ 編輯關於相簿";
  fab.onclick = openModal;
  document.body.appendChild(fab);

  modalEl = document.createElement("div");
  modalEl.className = "ag-modal";
  modalEl.innerHTML = `<div class="ag-panel">
      <h3>關於協會 — 相簿管理</h3>
      <p class="desc">可上傳照片、編輯說明文字、調整排序與顯示。修改後按該列「儲存」。</p>
      <div id="ag-list"></div>
      <button class="ag-btn ag-add" id="ag-add">＋ 上傳新照片</button>
      <input type="file" id="ag-file" accept="image/*" style="display:none">
      <div class="ag-foot"><button class="ag-btn ag-close" id="ag-close">關閉</button></div>
    </div>`;
  document.body.appendChild(modalEl);
  modalEl.addEventListener("click", e => { if (e.target === modalEl) modalEl.classList.remove("open"); });
  modalEl.querySelector("#ag-close").onclick = () => modalEl.classList.remove("open");
  modalEl.querySelector("#ag-add").onclick = () => modalEl.querySelector("#ag-file").click();
  modalEl.querySelector("#ag-file").addEventListener("change", handleUpload);
}

async function ensureDbItems() {
  // 若目前是備援（無 id），首次進後台時匯入資料庫以便編輯
  if (CURRENT.length && !CURRENT[0].id) {
    for (const d of DEFAULTS) {
      await addDoc(collection(db, COL), { kind: KIND, url: d.url, caption: d.caption, order: d.order, active: true });
    }
    await load();
  }
}

async function openModal() {
  await ensureDbItems();
  renderAdminList();
  modalEl.classList.add("open");
}

function renderAdminList() {
  const list = modalEl.querySelector("#ag-list");
  const items = [...CURRENT].sort((a, b) => (a.order || 0) - (b.order || 0));
  list.innerHTML = items.map(s => `
    <div class="ag-row" data-id="${s.id}">
      <img src="${s.url}" alt="">
      <div class="f">
        <input type="text" class="cap" value="${(s.caption || '').replace(/"/g, '&quot;')}" placeholder="說明文字">
        <div class="meta">
          排序 <input type="number" class="ord" value="${s.order || 0}">
          <label><input type="checkbox" class="act" ${s.active !== false ? "checked" : ""}> 顯示</label>
          <button class="ag-btn ag-save">儲存</button>
          <button class="ag-btn ag-del">刪除</button>
        </div>
      </div>
    </div>`).join("");
  list.querySelectorAll(".ag-row").forEach(row => {
    const id = row.dataset.id;
    row.querySelector(".ag-save").onclick = async () => {
      await updateDoc(doc(db, COL, id), {
        caption: row.querySelector(".cap").value,
        order: Number(row.querySelector(".ord").value) || 0,
        active: row.querySelector(".act").checked
      });
      await load(); renderAdminList();
    };
    row.querySelector(".ag-del").onclick = async () => {
      if (!confirm("確定刪除這張照片？")) return;
      await deleteDoc(doc(db, COL, id));
      await load(); renderAdminList();
    };
  });
}

async function handleUpload(e) {
  const file = e.target.files[0]; if (!file) return;
  const btn = modalEl.querySelector("#ag-add");
  btn.textContent = "上傳中… 0%";
  const { getStorage, ref, uploadBytesResumable, getDownloadURL } =
    await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js");
  const storage = getStorage(app);
  const storRef = ref(storage, `about/${Date.now()}_${file.name}`);
  const task = uploadBytesResumable(storRef, file);
  task.on("state_changed",
    snap => { btn.textContent = `上傳中… ${Math.round(snap.bytesTransferred / snap.totalBytes * 100)}%`; },
    err => { alert("上傳失敗：" + err.message); btn.textContent = "＋ 上傳新照片"; },
    async () => {
      const url = await getDownloadURL(task.snapshot.ref);
      const maxOrder = CURRENT.reduce((m, x) => Math.max(m, x.order || 0), 0);
      await addDoc(collection(db, COL), { kind: KIND, url, caption: "", order: maxOrder + 1, active: true });
      btn.textContent = "＋ 上傳新照片";
      e.target.value = "";
      await load(); renderAdminList();
    }
  );
}

/* ---------- 啟動 ---------- */
function start() {
  injectCSS();
  buildLightbox();
  load();
  onAuthStateChanged(auth, user => {
    isAdmin = !!user;
    if (isAdmin) {
      buildAdminUI();
      document.getElementById("ag-admin-fab").style.display = "block";
    } else {
      const f = document.getElementById("ag-admin-fab");
      if (f) f.style.display = "none";
    }
  });
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
else start();
