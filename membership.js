// 官網「新會員入會申請」線上表單：送到 Google Apps Script 入會申請系統（網址在 member-config.js）
(function () {
  const form = document.getElementById('member-form');
  if (!form) return;
  const CFG = window.HCD_MEMBER || {};
  const $ = (s) => form.querySelector(s);
  const errBox = document.getElementById('mf-error');
  const btn = document.getElementById('mf-submit');

  /* ---------- 簽名板 ---------- */
  const canvas = document.getElementById('mf-sig');
  const ph = document.getElementById('mf-sig-ph');
  const ctx = canvas.getContext('2d');
  let drawing = false, last = null, strokes = 0, inkLen = 0;

  function fit() {
    const r = canvas.getBoundingClientRect();
    if (!r.width) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const keep = strokes ? canvas.toDataURL() : null;
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#111'; ctx.lineWidth = 2.6;
    if (keep) { const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0, r.width, r.height); img.src = keep; }
  }
  function pos(e) { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault(); canvas.setPointerCapture(e.pointerId);
    drawing = true; last = pos(e); strokes++; ph.style.display = 'none';
    ctx.beginPath(); ctx.arc(last.x, last.y, 1.2, 0, Math.PI * 2); ctx.fillStyle = '#111'; ctx.fill();
    markOk('signature');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drawing) return;
    const p = pos(e);
    ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    inkLen += Math.hypot(p.x - last.x, p.y - last.y); last = p;
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((t) => canvas.addEventListener(t, () => { drawing = false; }));
  document.getElementById('mf-sig-clear').addEventListener('click', () => {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.restore();
    strokes = 0; inkLen = 0; ph.style.display = '';
  });
  window.addEventListener('resize', fit);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((en, ob) => { if (en[0].isIntersecting) { fit(); ob.disconnect(); } }).observe(canvas);
  }
  fit();

  /** 簽名裁掉空白、縮到寬 ≤ 600，輸出透明底 PNG */
  function signaturePng() {
    const w = canvas.width, h = canvas.height;
    const d = ctx.getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
      if (d[(y * w + x) * 4 + 3] > 20) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    if (x1 < 0) return '';
    const pad = 12;
    x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w, x1 + pad); y1 = Math.min(h, y1 + pad);
    const cw = x1 - x0, ch = y1 - y0, s = Math.min(1, 600 / cw);
    const out = document.createElement('canvas');
    out.width = Math.max(1, Math.round(cw * s)); out.height = Math.max(1, Math.round(ch * s));
    out.getContext('2d').drawImage(canvas, x0, y0, cw, ch, 0, 0, out.width, out.height);
    return out.toDataURL('image/png');
  }

  /* ---------- 檢查 ---------- */
  function validId(id) {
    if (!/^[A-Z]([1289]\d{8}|[A-D]\d{8})$/.test(id)) return false;
    const L = 'ABCDEFGHJKLMNPQRSTUVXYWZIO';
    const n = L.indexOf(id[0]) + 10;
    let sum = Math.floor(n / 10) + (n % 10) * 9;
    sum += (/[A-D]/.test(id[1]) ? (L.indexOf(id[1]) + 10) % 10 : +id[1]) * 8;
    for (let i = 2; i < 9; i++) sum += (+id[i]) * (9 - i);
    return (sum + +id[9]) % 10 === 0;
  }
  function ageOf(s) {
    const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    const b = new Date(+m[1], +m[2] - 1, +m[3]), now = new Date();
    if (isNaN(b) || b > now || +m[1] < 1900) return null;
    let a = now.getFullYear() - b.getFullYear();
    if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) a--;
    return a;
  }
  const MSG = {
    name: '請填姓名', gender: '請選性別', birth: '請填正確的出生日期', age: '依本會章程，入會需年滿二十歲',
    idno: '身分證字號格式或檢查碼不正確，請再確認', edu: '請填學歷', job: '請填現職', addr: '請填聯絡地址',
    phone: '手機請填 09 開頭的 10 碼數字', signature: '請在簽名區簽名', agree: '請勾選贊同章程與入會資格',
    consent: '請勾選同意個人資料使用'
  };
  const FIELD = { age: 'birth' };
  function fieldEl(k) {
    k = FIELD[k] || k;
    if (k === 'signature') return canvas.closest('.mf-field');
    const el = form.elements[k];
    if (!el) return null;
    const one = el.length && !el.tagName ? el[0] : el;
    return one.closest('.mf-field, .mf-check');
  }
  function markOk(k) { const f = fieldEl(k); if (f) f.classList.remove('mf-bad'); }
  form.addEventListener('input', (e) => { if (e.target.name) markOk(e.target.name); errBox.textContent = ''; });
  form.addEventListener('change', (e) => { if (e.target.name) markOk(e.target.name); });
  form.elements.idno.addEventListener('blur', (e) => { e.target.value = e.target.value.toUpperCase().replace(/\s/g, ''); });

  function collect() {
    const f = form.elements;
    const v = (k) => String(f[k].value || '').trim();
    return {
      name: v('name'), gender: (form.querySelector('input[name=gender]:checked') || {}).value || '',
      birth: v('birth'), idno: v('idno').toUpperCase().replace(/\s/g, ''), edu: v('edu'), job: v('job'),
      addr: v('addr'), phone: v('phone').replace(/[^\d]/g, ''), tel: v('tel'), line: v('line'), hope: v('hope'),
      agree: f.agree.checked, consent: f.consent.checked, website: v('website')
    };
  }
  function check(d) {
    const bad = [];
    if (!d.name) bad.push('name');
    if (!d.gender) bad.push('gender');
    const a = ageOf(d.birth);
    if (a === null) bad.push('birth'); else if (a < 20) bad.push('age');
    if (!validId(d.idno)) bad.push('idno');
    if (!d.edu) bad.push('edu');
    if (!d.job) bad.push('job');
    if (!d.addr) bad.push('addr');
    if (!/^09\d{8}$/.test(d.phone)) bad.push('phone');
    if (!strokes || inkLen < 25) bad.push('signature');
    if (!d.agree) bad.push('agree');
    if (!d.consent) bad.push('consent');
    return bad;
  }
  function showBad(bad) {
    form.querySelectorAll('.mf-bad').forEach((x) => x.classList.remove('mf-bad'));
    bad.forEach((k) => { const f = fieldEl(k); if (f) f.classList.add('mf-bad'); });
    errBox.textContent = bad.map((k) => MSG[k] || k).filter((x, i, a) => a.indexOf(x) === i).slice(0, 3).join('；');
    const first = fieldEl(bad[0]);
    if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /* ---------- 送出 ---------- */
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = collect();
    const bad = check(d);
    if (bad.length) return showBad(bad);
    if (!CFG.API_URL) { errBox.textContent = '線上申請系統尚未開放，請來電 ' + (CFG.PHONE || '') + ' 洽詢'; return; }
    d.signature = signaturePng();
    d.action = 'apply';
    btn.disabled = true; btn.textContent = '送出中…'; errBox.textContent = '';
    try {
      const r = await fetch(CFG.API_URL, { method: 'POST', body: JSON.stringify(d), credentials: 'omit', redirect: 'follow' });
      const j = await r.json();
      if (j.ok) return done(j, d);
      if (j.error === 'invalid') return showBad(j.fields || []);
      errBox.textContent = j.error === 'busy' ? '目前申請人數較多，請稍後再試' : '送出失敗，請稍後再試或來電 ' + (CFG.PHONE || '');
    } catch (err) {
      errBox.textContent = '網路連線有問題，送出失敗，請稍後再試';
    } finally {
      btn.disabled = false; btn.textContent = '送出入會申請';
    }
  });

  function done(j, d) {
    form.hidden = true;
    const box = document.getElementById('mf-done');
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    if (j.dup) {
      document.getElementById('mf-done-title').textContent = '你之前已經送出過入會申請';
      document.getElementById('mf-done-text').innerHTML = '申請編號：<b>' + esc(j.no) + '</b>　目前狀態：<b>' + esc(j.status || '待審核') +
        '</b><br>不用重複申請，我們會用你留的手機與你聯繫。';
    } else {
      document.getElementById('mf-done-text').innerHTML = esc(d.name) + ' 你好，你的申請編號是 <b>' + esc(j.no) +
        '</b>。<br>理事會審查通過後，我們會打 <b>' + esc(d.phone) + '</b> 與你聯繫。';
    }
    box.hidden = false;
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
})();
