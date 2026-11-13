/* 點圖放大：輪播、文章內的照片、活動海報、RoboRAVE／消息彈窗內的圖。
   手機：點圖 → 全螢幕檢視，可雙指縮放、點圖切換放大／還原、點黑色背景／右上角 ✕／手機返回鍵關閉。
   關於協會的時間軸相簿 (.ag-ph) 有自己的放大功能，這裡不處理。 */
(function () {
  var SEL = '#carousel img, #news-modal-dynamic img, #news-modal-dronesoccer img, #news-modal-founding img, #news-modal-chasing img, #modal-roborave img, #events img';
  var css = document.createElement('style');
  css.textContent =
    SEL.split(', ').map(function (s) { return s + ':not(.ag-ph img):not([data-nolb])'; }).join(',') + '{cursor:zoom-in}' +
    '#hcd-lb{position:fixed;inset:0;z-index:100000;background:rgba(6,12,24,.94);display:none;flex-direction:column;-webkit-tap-highlight-color:transparent}' +
    '#hcd-lb.show{display:flex}' +
    '#hcd-lb .lb-stage{flex:1;overflow:auto;-webkit-overflow-scrolling:touch;display:flex;touch-action:pan-x pan-y pinch-zoom}' +
    '#hcd-lb img{margin:auto;max-width:100%;max-height:100%;object-fit:contain;cursor:zoom-in;user-select:none;-webkit-user-drag:none}' +
    '#hcd-lb.zoom img{max-width:none;max-height:none;width:250%;cursor:zoom-out}' +
    '#hcd-lb .lb-x{position:absolute;top:max(12px,env(safe-area-inset-top));right:12px;width:44px;height:44px;border-radius:50%;border:none;background:rgba(255,255,255,.18);color:#fff;font-size:26px;line-height:1;cursor:pointer;z-index:2}' +
    '#hcd-lb .lb-cap{color:#dbe4f3;font-size:14px;text-align:center;padding:10px 16px max(12px,env(safe-area-inset-bottom));line-height:1.5}' +
    '#hcd-lb .lb-cap:empty{display:none}';
  document.head.appendChild(css);

  var box = document.createElement('div');
  box.id = 'hcd-lb'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', '放大檢視照片');
  box.innerHTML = '<button class="lb-x" type="button" aria-label="關閉">&times;</button><div class="lb-stage"><img alt=""></div><div class="lb-cap"></div>';
  document.body.appendChild(box);
  var stage = box.querySelector('.lb-stage'), im = box.querySelector('img'), cap = box.querySelector('.lb-cap');
  var isOpen = false, prevOverflow = '';

  function open(src, alt) {
    im.src = src; im.alt = alt || ''; cap.textContent = alt || '';
    box.classList.remove('zoom'); box.classList.add('show'); stage.scrollTop = 0; stage.scrollLeft = 0;
    prevOverflow = document.documentElement.style.overflow; document.documentElement.style.overflow = 'hidden';
    isOpen = true;
    try { clearInterval(window._autoplayTimer); } catch (e) {}
    try { history.pushState({ lb: 1 }, '', location.href); } catch (e) {}
  }
  function hide() {
    if (!isOpen) return;
    isOpen = false; box.classList.remove('show', 'zoom'); im.removeAttribute('src');
    document.documentElement.style.overflow = prevOverflow;
    try { if (typeof startAutoplay === 'function' && document.getElementById('carousel')) startAutoplay(); } catch (e) {}
  }
  function close() {
    if (!isOpen) return;
    if (history.state && history.state.lb) history.back(); else hide();
  }
  window.addEventListener('popstate', hide);
  box.querySelector('.lb-x').addEventListener('click', function (e) { e.stopPropagation(); close(); });
  box.addEventListener('click', function (e) { if (e.target === box || e.target === stage || e.target === cap) close(); });
  im.addEventListener('click', function (e) {
    e.stopPropagation();
    var z = box.classList.toggle('zoom');
    if (z) { // 放大時把點到的位置置中
      var r = im.getBoundingClientRect();
      setTimeout(function () {
        stage.scrollLeft = (stage.scrollWidth - stage.clientWidth) / 2;
        stage.scrollTop = (stage.scrollHeight - stage.clientHeight) / 2;
      }, 0);
    }
  });
  document.addEventListener('keydown', function (e) { if (isOpen && e.key === 'Escape') close(); });

  document.addEventListener('click', function (e) {
    if (isOpen) return;
    var t = e.target; if (!t || t.tagName !== 'IMG') return;
    if (!t.closest(SEL.replace(/ img/g, '')) || t.closest('.ag-ph') || t.hasAttribute('data-nolb')) return;
    if (/logo/i.test(t.currentSrc || t.src) || t.closest('[id^="admin"]')) return;
    var r = t.getBoundingClientRect(); if (r.width < 100 || r.height < 70) return;
    var src = t.currentSrc || t.src; if (!src) return;
    e.preventDefault(); // 活動海報外面包著連結（原本開新分頁），改成就地放大
    e.stopPropagation();
    open(src, t.alt);
  }, true);
})();
