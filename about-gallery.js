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
  .ag-timeline{position:relative;max-width:1040px;margin:48px auto 0}
  .ag-timeline::before{content:"";position:absolute;top:4px;bottom:24px;left:50%;width:3px;margin-left:-1.5px;background:linear-gradient(#1a3a6b,#c9d6ea)}
  .ag-tl{position:relative;width:50%;box-sizing:border-box;padding:0 46px 46px 0;opacity:0;transform:translateX(-44px);transition:opacity .7s cubic-bezier(.2,.7,.2,1),transform .7s cubic-bezier(.2,.7,.2,1)}
  .ag-tl:nth-child(even){margin-left:50%;padding:0 0 46px 46px;transform:translateX(44px)}
  .ag-tl.in{opacity:1;transform:translateX(0)}
  .ag-dot{position:absolute;top:2px;width:38px;height:38px;border-radius:50%;background:#1a3a6b;color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;letter-spacing:1px;box-shadow:0 0 0 5px #eef3fa;z-index:2;transform:scale(.35);transition:transform .45s cubic-bezier(.34,1.56,.64,1) .12s}
  .ag-tl.in .ag-dot{transform:scale(1)}
  .ag-tl:nth-child(odd) .ag-dot{right:-19px}
  .ag-tl:nth-child(even) .ag-dot{left:-19px}
  .ag-ph{cursor:zoom-in;border-radius:14px;overflow:hidden;box-shadow:0 8px 24px rgba(26,58,107,.16);transition:transform .18s,box-shadow .18s}
  .ag-ph:hover{transform:translateY(-2px);box-shadow:0 12px 30px rgba(26,58,107,.24)}
  .ag-ph img{display:block;width:100%;height:224px;object-fit:cover}
  .ag-tx{margin-top:13px}
  .ag-tx p{font-size:15px;line-height:1.92;color:#41506a;margin:0}
  .ag-tl:nth-child(odd) .ag-tx{text-align:right}
  .ag-hint{text-align:center;color:#8a9ab0;font-size:13px;margin-top:8px}
  @media(max-width:760px){
    .ag-timeline::before{left:20px}
    .ag-tl,.ag-tl:nth-child(even){width:100%;margin-left:0;padding:0 0 38px 54px}
    .ag-tl:nth-child(odd) .ag-dot,.ag-tl:nth-child(even) .ag-dot{left:1px;right:auto}
    .ag-tl:nth-child(odd) .ag-tx{text-align:left}
    .ag-ph img{height:200px}
  }
  /* 燈箱 */
  .ag-lb{position:fixed;inset:0;background:rgba(8,15,30,.92);display:none;align-items:center;justify-content:center;z-index:3000;padding:24px}
  .ag-lb.open{display:flex}
  .ag-lb img{max-width:96vw;max-height:86vh;border-radius:10px;box-shadow:0 12px 50px rgba(0,0,0,.5)}
  .ag-lb .ag-cap{position:absolute;bottom:18px;left:0;right:0;text-align:center;color:#dfe8f5;font-size:14px;padding:0 16px}
  .ag-lb button{position:absolute;background:rgba(255,255,255,.15);border:none;color:#fff;cursor:pointer}
  .ag-lb .ag-x{top:18px;right:24px;font-size:30px;width:46px;height:46px;border-radius:50%;line-height:1}
  .ag-lb .ag-nav{top:50%;transform:translateY(-50%);font-size:26px;width:50px;height:50px;border-radius:50%}
  .ag-lb .ag-prev{left:20px}.ag-lb .ag-next{right:20px}
  /* 後台分頁內容 */
  #tab-aboutgallery .ag-h{margin:0 0 4px;font-size:18px;color:#1a2333;font-weight:700}
  #tab-aboutgallery .ag-desc{color:#8a9ab0;font-size:13px;margin:0 0 16px}
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
  let host = section.querySelector(".ag-timeline");
  const visible = CURRENT.filter(x => x.active !== false).sort((a, b) => (a.order || 0) - (b.order || 0));
  lbList = visible;
  if (!host) {
    // 移除原本單張 figure / 舊版版面，建立時間軸容器
    const old = section.querySelector("figure") || section.querySelector(".ag-story") || section.querySelector(".ag-gallery");
    host = document.createElement("div");
    host.className = "ag-timeline";
    if (old) old.replaceWith(host);
    else section.appendChild(host);
  }
  host.innerHTML = visible.map((s, i) => `
    <div class="ag-tl">
      <div class="ag-dot">${String(i + 1).padStart(2, '0')}</div>
      <div class="ag-ph" data-i="${i}"><img loading="lazy" src="${s.url}" alt="${(s.caption || '活動照片').replace(/"/g, '')}"></div>
      <div class="ag-tx"><p>${s.caption || ''}</p></div>
    </div>`).join("");
  host.querySelectorAll(".ag-ph").forEach(el => {
    el.addEventListener("click", () => showLb(+el.dataset.i));
  });
  // 捲動滑入效果：捲到視窗才淡入＋滑進來
  const tlItems = host.querySelectorAll(".ag-tl");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    tlItems.forEach(el => io.observe(el));
  } else {
    tlItems.forEach(el => el.classList.add("in"));
  }
  // 點擊放大提示（只加一次）
  if (!host.nextElementSibling || !host.nextElementSibling.classList.contains("ag-hint")) {
    const hint = document.createElement("div");
    hint.className = "ag-hint"; hint.textContent = "🔍 點圖片看完整大圖";
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

/* ---------- 後台管理（整合進既有後台分頁列）---------- */
let paneEl = null, tabBtnEl = null;
function injectAdminTab() {
  const tabs = document.querySelector(".admin-tabs");
  if (!tabs) return false;
  if (document.getElementById("ag-admin-tab")) return true;

  // 分頁按鈕（與「最新消息／輪播照片／管理者」同列）
  tabBtnEl = document.createElement("button");
  tabBtnEl.id = "ag-admin-tab";
  tabBtnEl.className = "admin-tab";
  tabBtnEl.type = "button";
  tabBtnEl.textContent = "🖼️ 關於相簿";
  tabBtnEl.addEventListener("click", showMyTab);
  tabs.appendChild(tabBtnEl);

  // 分頁內容區
  const refPane = document.getElementById("tab-carousel") || document.querySelector(".admin-tab-pane");
  const parent = refPane ? refPane.parentElement : tabs.parentElement;
  paneEl = document.createElement("div");
  paneEl.className = "admin-tab-pane";
  paneEl.id = "tab-aboutgallery";
  paneEl.style.display = "none";
  paneEl.innerHTML = `
      <h3 class="ag-h">關於協會 — 相簿管理</h3>
      <p class="ag-desc">可上傳照片、編輯說明文字、調整排序與顯示。修改後按該列「儲存」。</p>
      <div id="ag-list"></div>
      <button class="ag-btn ag-add" id="ag-add" type="button">＋ 上傳新照片</button>
      <input type="file" id="ag-file" accept="image/*" style="display:none">`;
  parent.appendChild(paneEl);
  paneEl.querySelector("#ag-add").addEventListener("click", () => paneEl.querySelector("#ag-file").click());
  paneEl.querySelector("#ag-file").addEventListener("change", handleUpload);

  // 點其他分頁時，隱藏本分頁並取消其 active
  tabs.querySelectorAll(".admin-tab").forEach(b => {
    if (b !== tabBtnEl) b.addEventListener("click", () => {
      paneEl.style.display = "none";
      tabBtnEl.classList.remove("active");
    });
  });
  return true;
}

function showMyTab() {
  document.querySelectorAll(".admin-tab-pane").forEach(p => { p.style.display = "none"; });
  document.querySelectorAll(".admin-tab").forEach(b => b.classList.remove("active"));
  paneEl.style.display = "block";
  tabBtnEl.classList.add("active");
  openManage();
}
async function openManage() {
  await ensureDbItems();
  renderAdminList();
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

function renderAdminList() {
  const list = document.getElementById("ag-list");
  if (!list) return;
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
  const btn = document.getElementById("ag-add");
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
    if (isAdmin) tryInjectAdmin();
  });
}
function tryInjectAdmin() {
  if (injectAdminTab()) return;
  // 後台 DOM 可能在登入後才建立，觀察其出現再注入分頁
  const obs = new MutationObserver(() => { if (injectAdminTab()) obs.disconnect(); });
  obs.observe(document.body, { childList: true, subtree: true });
  setTimeout(() => obs.disconnect(), 20000);
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
else start();
