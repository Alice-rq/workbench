/* ============================================================
 * global-bar.js — 全局顶栏（番茄钟 + 当前项目 + 时钟）
 * 放在每个 HTML 的 <head> 里：
 *   <script src="./global-bar.js"></script>
 * ============================================================ */
(function () {
  'use strict';
  if (window.GlobalBar) return;

  var GLOBAL_KEY = 'workbench-global-v1';
  var THEME_KEY  = 'workbench-theme-v1';
  var BAR_H = 46;

  /* ---------- 存储 ---------- */
  function readGlobal() {
    try { return JSON.parse(localStorage.getItem(GLOBAL_KEY) || '{}') || {}; }
    catch (e) { return {}; }
  }
  function writeGlobal(patch) {
    var cur = readGlobal(), next = {};
    for (var k in cur) if (Object.prototype.hasOwnProperty.call(cur, k)) next[k] = cur[k];
    for (var k2 in patch) if (Object.prototype.hasOwnProperty.call(patch, k2)) next[k2] = patch[k2];
    try { localStorage.setItem(GLOBAL_KEY, JSON.stringify(next)); } catch (e) {}
    return next;
  }
  function getAccent() {
    try {
      var t = JSON.parse(localStorage.getItem(THEME_KEY) || '{}');
      if (/^#[0-9a-f]{6}$/i.test(t.accent || '')) return t.accent;
    } catch (e) {}
    return '#4f7cff';
  }
  function hexToRgba(hex, a) {
    var m = /^#([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return 'rgba(79,124,255,' + a + ')';
    var n = parseInt(m[1], 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  /* ---------- 番茄钟 ---------- */
  function getPomo() { return readGlobal().pomodoro || null; }
  function getRemaining() {
    var p = getPomo();
    if (!p) return 0;
    if (p.running && p.endAt) return Math.max(0, Math.round((p.endAt - Date.now()) / 1000));
    return p.pausedRemaining || 0;
  }
  function start(label, seconds) {
    seconds = Math.round(seconds);
    if (!seconds || seconds <= 0) return;
    writeGlobal({
      pomodoro: {
        running: true,
        endAt: Date.now() + seconds * 1000,
        totalSeconds: seconds,
        label: label || '专注',
        mode: 'focus',
        pausedRemaining: 0
      }
    });
    sync();
  }
  function pause() {
    var p = getPomo();
    if (!p || !p.running) return;
    p.pausedRemaining = Math.max(0, Math.round((p.endAt - Date.now()) / 1000));
    p.running = false;
    p.endAt = 0;
    writeGlobal({ pomodoro: p });
    sync();
  }
  function resume() {
    var p = getPomo();
    if (!p) return;
    var left = p.pausedRemaining || 0;
    if (left <= 0) return;
    p.running = true;
    p.endAt = Date.now() + left * 1000;
    p.pausedRemaining = 0;
    writeGlobal({ pomodoro: p });
    sync();
  }
  function toggle() {
    var p = getPomo();
    if (!p) { start('专注', 25 * 60); return; }
    if (p.running) pause(); else resume();
  }
  function reset() { writeGlobal({ pomodoro: null }); sync(); }
  function addMinutes(m) {
    var p = getPomo();
    if (!p) return;
    var sec = m * 60;
    if (p.running && p.endAt) p.endAt += sec * 1000;
    else p.pausedRemaining = (p.pausedRemaining || 0) + sec;
    p.totalSeconds = (p.totalSeconds || 0) + sec;
    writeGlobal({ pomodoro: p });
    sync();
  }

  /* ---------- 音效 ---------- */
  var audioCtx = null;
  function unlockAudio() {
    try {
      if (!audioCtx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        audioCtx = new AC();
      }
      if (audioCtx.state === 'suspended') audioCtx.resume();
    } catch (e) {}
  }
  ['pointerdown', 'touchstart', 'keydown'].forEach(function (ev) {
    window.addEventListener(ev, unlockAudio, { passive: true });
  });
  function chime() {
    unlockAudio();
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    var t0 = audioCtx.currentTime + 0.02;
    for (var i = 0; i < 4; i++) {
      var t = t0 + i * 0.34;
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, t);
      osc.frequency.setValueAtTime(1245, t + 0.09);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.28, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.start(t); osc.stop(t + 0.3);
    }
    if (navigator.vibrate) { try { navigator.vibrate([160, 80, 160, 80, 220]); } catch (e) {} }
  }

  /* ---------- 样式 ---------- */
  function injectStyle() {
    var old = document.getElementById('gbar-style');
    if (old) old.remove();
    var accent = getAccent();
    var css =
      '#gbar{position:fixed;top:0;left:0;right:0;height:' + BAR_H + 'px;z-index:9999;' +
      'display:flex;align-items:center;gap:8px;box-sizing:border-box;' +
      'padding:0 10px;padding-left:max(10px,env(safe-area-inset-left));' +
      'padding-right:max(10px,env(safe-area-inset-right));' +
      'background:rgba(255,255,255,.94);color:#1b2230;' +
      '-webkit-backdrop-filter:blur(14px) saturate(180%);backdrop-filter:blur(14px) saturate(180%);' +
      'border-bottom:1px solid rgba(0,0,0,.07);' +
      'font:500 13px/1 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;' +
      'user-select:none;-webkit-user-select:none;transition:background .2s,color .2s;}' +
      '#gbar.dark{background:rgba(20,23,32,.9);color:#e6e9f0;border-bottom-color:rgba(255,255,255,.08);}' +
      '#gbar .gbar-home{flex:none;width:30px;height:30px;border-radius:9px;display:flex;align-items:center;' +
      'justify-content:center;text-decoration:none;color:inherit;font-size:15px;' +
      'background:rgba(0,0,0,.06);transition:background .15s;}' +
      '#gbar .gbar-home:hover{background:rgba(0,0,0,.12);}' +
      '#gbar.dark .gbar-home{background:rgba(255,255,255,.1);}' +
      '#gbar .gbar-home[hidden]{display:none;}' +
      '#gbar .gbar-pick{display:flex;align-items:center;gap:6px;min-width:0;max-width:46vw;' +
      'padding:5px 10px;border-radius:9px;background:rgba(0,0,0,.05);}' +
      '#gbar.dark .gbar-pick{background:rgba(255,255,255,.08);}' +
      '#gbar .gbar-pick-text{font-size:12.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
      '#gbar .gbar-pick-go{flex:none;text-decoration:none;color:' + accent + ';font-size:12px;font-weight:700;}' +
      '#gbar .gbar-pick-go[hidden]{display:none;}' +
      '#gbar .gbar-grow{flex:1;min-width:0;}' +
      '#gbar .gbar-pomo{display:flex;align-items:center;gap:4px;padding:4px 4px 4px 10px;border-radius:9px;' +
      'background:rgba(0,0,0,.05);transition:background .2s,color .2s;}' +
      '#gbar.dark .gbar-pomo{background:rgba(255,255,255,.08);}' +
      '#gbar .gbar-pomo[data-state="running"]{background:' + hexToRgba(accent, .14) + ';color:' + accent + ';}' +
      '#gbar .gbar-pomo-label{font-size:11.5px;font-weight:600;max-width:76px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;opacity:.75;}' +
      '#gbar .gbar-pomo-time{font-variant-numeric:tabular-nums;font-weight:800;font-size:13.5px;letter-spacing:.2px;min-width:46px;text-align:center;}' +
      '#gbar .gbar-pomo-btn{width:24px;height:24px;border:none;border-radius:7px;background:transparent;color:inherit;' +
      'font-size:11.5px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;' +
      'transition:background .15s;font-family:inherit;padding:0;}' +
      '#gbar .gbar-pomo-btn:hover{background:rgba(0,0,0,.1);}' +
      '#gbar.dark .gbar-pomo-btn:hover{background:rgba(255,255,255,.15);}' +
      '#gbar .gbar-clock{display:flex;align-items:baseline;gap:8px;flex:none;}' +
      '#gbar .gbar-date{font-size:11.5px;opacity:.6;white-space:nowrap;}' +
      '#gbar .gbar-time{font-size:13.5px;font-weight:800;font-variant-numeric:tabular-nums;letter-spacing:-.2px;white-space:nowrap;}' +
      '@media (max-width:640px){' +
        '#gbar .gbar-date{display:none;}' +
        '#gbar .gbar-pomo-label{display:none;}' +
        '#gbar .gbar-pomo-btn[data-pomo="add"]{display:none;}' +
        '#gbar .gbar-pick{max-width:36vw;}' +
      '}' +
      '#gbar-toast{position:fixed;left:50%;top:' + (BAR_H + 12) + 'px;transform:translate(-50%,-8px);' +
      'padding:9px 16px;border-radius:10px;background:rgba(27,34,48,.94);color:#fff;font-size:13px;font-weight:600;' +
      'z-index:10000;opacity:0;pointer-events:none;transition:opacity .22s,transform .22s;max-width:80vw;text-align:center;}' +
      '#gbar-toast.show{opacity:1;transform:translate(-50%,0);}';

    var s = document.createElement('style');
    s.id = 'gbar-style';
    s.textContent = css;
    document.head.appendChild(s);
  }

  /* ---------- DOM ---------- */
  var elBar, elHome, elPickText, elPickGo, elPomo, elPomoLabel, elPomoTime,
      elPomoToggle, elClockDate, elClockTime, elToast;

  function buildDOM() {
    if (document.getElementById('gbar')) return;
    elBar = document.createElement('div');
    elBar.id = 'gbar';
    elBar.innerHTML =
      '<a class="gbar-home" href="./index.html" title="返回工作台">←</a>' +
      '<div class="gbar-pick"><span>🎯</span>' +
        '<span class="gbar-pick-text">今天做什么</span>' +
        '<a class="gbar-pick-go" href="#" hidden>进入</a></div>' +
      '<div class="gbar-grow"></div>' +
      '<div class="gbar-pomo" data-state="idle">' +
        '<span class="gbar-pomo-label">番茄</span>' +
        '<span class="gbar-pomo-time">00:00</span>' +
        '<button class="gbar-pomo-btn" type="button" data-pomo="toggle" title="开始/暂停">▶</button>' +
        '<button class="gbar-pomo-btn" type="button" data-pomo="reset" title="重置">↺</button>' +
        '<button class="gbar-pomo-btn" type="button" data-pomo="add" title="加 5 分钟">+5</button>' +
      '</div>' +
      '<div class="gbar-clock"><span class="gbar-date"></span><span class="gbar-time"></span></div>';
    document.body.appendChild(elBar);

    elToast = document.createElement('div');
    elToast.id = 'gbar-toast';
    document.body.appendChild(elToast);

    elHome       = elBar.querySelector('.gbar-home');
    elPickText   = elBar.querySelector('.gbar-pick-text');
    elPickGo     = elBar.querySelector('.gbar-pick-go');
    elPomo       = elBar.querySelector('.gbar-pomo');
    elPomoLabel  = elBar.querySelector('.gbar-pomo-label');
    elPomoTime   = elBar.querySelector('.gbar-pomo-time');
    elPomoToggle = elBar.querySelector('[data-pomo="toggle"]');
    elClockDate  = elBar.querySelector('.gbar-date');
    elClockTime  = elBar.querySelector('.gbar-time');

    var last = (location.pathname.split('/').pop() || '').toLowerCase();
    if (last === '' || last === 'index.html' || last === 'index.htm') elHome.hidden = true;

    elBar.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-pomo]') : null;
      if (!b) return;
      var act = b.getAttribute('data-pomo');
      if (act === 'toggle') toggle();
      else if (act === 'reset') reset();
      else if (act === 'add') addMinutes(5);
    });
  }

  /* ---------- 布局适配：关键部分 ---------- */
  function applyLayout() {
    if (!document.body) return;
    var h = BAR_H;

    // 1. CSS 变量（备用）
    document.documentElement.style.setProperty('--gbar-h', h + 'px');

    // 2. 关键：强制 body 加 padding-top，用内联 style + important
    document.body.style.setProperty('padding-top', h + 'px', 'important');

    // 3. writer.html 的全屏 flex 布局：.app 高度要减掉顶栏
    var app = document.querySelector('.app');
    if (app) {
      var cs = getComputedStyle(app);
      if (cs.display === 'flex' && cs.flexDirection === 'column') {
        app.style.height = 'calc(100vh - ' + h + 'px)';
      }
    }

    // 4. 各页面里的 sticky / fixed 元素
    var list = document.querySelectorAll(
      '.topbar, .sidebar, .rightbar, .mobile-header, .sidebar-overlay'
    );
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      var c = getComputedStyle(el);
      if (c.position === 'fixed' || c.position === 'sticky') {
        var curTop = el.style.top;
        // 只处理 top 为空或 0 的情况，避免覆盖用户手动设置的 top
        if (!curTop || curTop === '0px' || curTop === '0') {
          el.style.top = h + 'px';
        }
      }
      // study.html 的侧栏高度
      if (c.position === 'fixed' && el.classList.contains('sidebar')) {
        el.style.height = 'calc(100vh - ' + h + 'px)';
      }
    }

    // 5. 弹窗遮罩：从顶栏下方开始
    var overlays = document.querySelectorAll(
      '.modal-overlay, .modal, .search-modal, .form-modal, .sidebar-overlay'
    );
    for (var j = 0; j < overlays.length; j++) {
      var ov = overlays[j];
      var oc = getComputedStyle(ov);
      if (oc.position === 'fixed' && oc.top === '0px') {
        ov.style.top = h + 'px';
      }
    }
  }

  /* ---------- 渲染 ---------- */
  function fmt(sec) {
    sec = Math.max(0, Math.round(sec));
    var m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }
  function renderPomo() {
    if (!elPomo) return;
    var p = getPomo();
    var left = getRemaining();
    if (!p) {
      elPomo.setAttribute('data-state', 'idle');
      elPomoLabel.textContent = '番茄';
      elPomoTime.textContent = '00:00';
      elPomoToggle.textContent = '▶';
      return;
    }
    elPomoLabel.textContent = p.label || '专注';
    elPomoTime.textContent = fmt(left);
    var running = p.running && left > 0;
    elPomo.setAttribute('data-state', running ? 'running' : 'paused');
    elPomoToggle.textContent = running ? '❚❚' : '▶';
  }
  function renderPick() {
    if (!elPickText) return;
    var pick = readGlobal().wheelPick;
    if (!pick || !pick.name) {
      elPickText.textContent = '今天做什么';
      elPickGo.hidden = true;
      return;
    }
    var txt = pick.name;
    if (pick.minutes > 0) txt += ' · ' + pick.minutes + '分';
    elPickText.textContent = txt;
    if (pick.url) { elPickGo.hidden = false; elPickGo.href = pick.url; }
    else { elPickGo.hidden = true; }
  }
  function renderClock() {
    if (!elClockTime) return;
    var d = new Date();
    var wk = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
    var p = function (n) { return n < 10 ? '0' + n : '' + n; };
    elClockDate.textContent = (d.getMonth() + 1) + '月' + d.getDate() + '日 周' + wk;
    elClockTime.textContent = p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }
  function sync() { renderPomo(); renderPick(); }

  /* ---------- 结束检测 ---------- */
  var finishing = false;
  function checkFinish() {
    if (finishing) return;
    var p = getPomo();
    if (!p || !p.running || !p.endAt) return;
    if (p.endAt - Date.now() > 0) return;
    finishing = true;
    var done = {};
    for (var k in p) if (Object.prototype.hasOwnProperty.call(p, k)) done[k] = p[k];
    writeGlobal({ pomodoro: null });
    renderPomo();
    chime();
    try {
      window.dispatchEvent(new CustomEvent('global-pomodoro-end', { detail: done }));
    } catch (e) {}
    toast('⏰ ' + (done.label || '专注') + ' 时间到！');
    setTimeout(function () { finishing = false; }, 1200);
  }

  /* ---------- Toast ---------- */
  var toastTimer = null;
  function toast(msg) {
    if (!elToast) return;
    elToast.textContent = msg;
    elToast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { elToast.classList.remove('show'); }, 2400);
  }

  /* ---------- 主题识别 ---------- */
  function detectTheme() {
    var t = document.documentElement.getAttribute('data-theme');
    if (t === 'dark') return 'dark';
    if (t === 'light') return 'light';
    try {
      var wp = JSON.parse(localStorage.getItem('writer-app-prefs-v1') || '{}');
      if (wp.theme === 'dark') return 'dark';
      if (wp.theme === 'light') return 'light';
    } catch (e) {}
    try {
      var st = localStorage.getItem('study_workbench_theme') || 'auto';
      if (st === 'dark') return 'dark';
      if (st === 'light') return 'light';
      if (st === 'auto') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
    } catch (e) {}
    return 'light';
  }
  function applyTheme() {
    if (!elBar) return;
    elBar.classList.toggle('dark', detectTheme() === 'dark');
  }

  /* ---------- 启动 ---------- */
  function boot() {
    injectStyle();
    buildDOM();
    applyLayout();
    applyTheme();
    sync();
    renderClock();

    setInterval(function () {
      renderClock();
      renderPomo();
      checkFinish();
    }, 300);

    window.addEventListener('storage', function (e) {
      if (e.key === GLOBAL_KEY) sync();
      if (e.key === THEME_KEY) { injectStyle(); applyTheme(); }
      if (e.key === 'writer-app-prefs-v1' || e.key === 'study_workbench_theme') applyTheme();
    });

    window.addEventListener('resize', applyLayout);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) { sync(); renderClock(); applyLayout(); applyTheme(); }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  /* ---------- 对外 API ---------- */
  window.GlobalBar = {
    start: start,
    pause: pause,
    resume: resume,
    toggle: toggle,
    reset: reset,
    addMinutes: addMinutes,
    getRemaining: getRemaining,
    getPomo: getPomo,
    toast: toast,
    refreshAccent: function () { injectStyle(); }
  };
})();
