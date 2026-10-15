(function () {
  'use strict';

  var root = document.getElementById('app');
  var tabsEl = document.getElementById('tabs');
  var state = { site: {}, apps: [] };
  var current = { app: null, view: 'about', index: 0 };
  var NEW_DAYS = 7;
  var SWIPE_MIN = 48;
  var VIEWS = [
    { id: 'about', label: '소개' },
    { id: 'usage', label: '사용법' },
    { id: 'features', label: '기능' },
    { id: 'history', label: '업데이트' }
  ];

  // ---- theme ---------------------------------------------------------------

  function storedTheme() {
    try { return localStorage.getItem('theme'); } catch (e) { return null; }
  }
  function applyTheme(theme) {
    if (theme) document.documentElement.setAttribute('data-theme', theme);
    else document.documentElement.removeAttribute('data-theme');
  }
  applyTheme(storedTheme());
  document.getElementById('themeToggle').addEventListener('click', function () {
    var active = document.documentElement.getAttribute('data-theme') ||
      (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    var next = active === 'light' ? 'dark' : 'light';
    applyTheme(next);
    try { localStorage.setItem('theme', next); } catch (e) {}
  });

  // ---- helpers -------------------------------------------------------------

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function formatDate(value) {
    if (!value) return '';
    var match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    return match ? match[1] + '.' + match[2] + '.' + match[3] : value;
  }

  function formatSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  function isNew(value) {
    var time = Date.parse(value || '');
    return !isNaN(time) && Date.now() - time < NEW_DAYS * 86400000;
  }

  function fetchJson(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (response) {
      if (!response.ok) throw new Error(response.status);
      return response.json();
    });
  }

  function accentStyle(app) {
    return '--a:' + esc(app.accent || '#b9a2ff') + ';--a2:' + esc(app.accent2 || app.accent || '#7c6cff');
  }

  /** Short feature list for the main view: `core` in apps.json, else the first item of each group. */
  function coreFeatures(app) {
    if (app.core && app.core.length) return app.core;
    return (app.featureGroups || []).map(function (g) { return (g.items || [])[0]; }).filter(Boolean).slice(0, 4);
  }

  function list(items, cls) {
    return '<ul class="' + cls + '">' + items.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul>';
  }

  var ICON_DOWNLOAD = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 20h14"/></svg>';
  var ICON_PREV = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
  var ICON_NEXT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';

  // ---- data ----------------------------------------------------------------

  function load() {
    return fetchJson('apps.json').then(function (data) {
      state.site = data.site || {};
      state.apps = data.apps || [];
      return Promise.all(state.apps.map(function (app) {
        var jobs = [];
        if (app.manifest) {
          jobs.push(fetchJson(app.manifest).then(function (latest) { app.latest = latest; }, function () {}));
        }
        if (app.history) {
          jobs.push(fetchJson(app.history).then(function (history) { app.historyList = history; }, function () {}));
        }
        return Promise.all(jobs);
      }));
    });
  }

  /** Normalized release info: from latest.json, or the static entry in apps.json. */
  function release(app) {
    if (app.latest) {
      return {
        version: app.latest.versionName,
        date: app.latest.publishedAt,
        size: formatSize(app.latest.size),
        url: app.latest.apkUrl,
        sha256: app.latest.sha256,
        notes: app.latest.notes
      };
    }
    var r = app.release || {};
    return { version: r.versionName, date: r.publishedAt, size: r.sizeLabel || formatSize(r.size), url: r.apkUrl, sha256: r.sha256 };
  }

  // ---- download ------------------------------------------------------------

  /**
   * Installer APK stored in this repository: served from the same origin, so the
   * browser downloads it directly instead of following GitHub release redirects.
   */
  function installerUrl(app) {
    return app.installer && app.installer.path ? app.installer.path : '';
  }

  function installerFileName(app) {
    return installerUrl(app).split('/').pop();
  }

  function installerNote(app, rel) {
    var inst = app.installer;
    if (!inst || !inst.versionName || !rel.version || inst.versionName === rel.version) return '';
    return '<p class="download-note">설치 파일 v' + esc(inst.versionName) +
      (app.inAppUpdate ? ' · 앱에서 최신으로 업데이트' : '') + '</p>';
  }

  function downloadButton(app, rel) {
    var local = installerUrl(app);
    if (local) {
      return '<a class="btn btn-primary" href="' + esc(local) + '" download="' + esc(installerFileName(app)) + '" type="application/vnd.android.package-archive">' + ICON_DOWNLOAD + 'APK 다운로드</a>';
    }
    if (rel.url) {
      return '<a class="btn btn-primary" href="' + esc(rel.url) + '" download>' + ICON_DOWNLOAD + 'APK 다운로드</a>';
    }
    return '<button class="btn btn-primary" type="button" disabled>' + ICON_DOWNLOAD + 'APK 준비 중</button>';
  }

  // ---- routing -------------------------------------------------------------

  function findApp(id) {
    return state.apps.filter(function (a) { return a.id === id; })[0];
  }

  function viewExists(id) {
    return VIEWS.some(function (v) { return v.id === id; });
  }

  /** `#/<app>/<view>/<step>`; the step is 1-based in the URL. */
  function hashFor(app, view, index) {
    if (!view || view === 'about') return '#/' + app.id;
    return '#/' + app.id + '/' + view + (index ? '/' + (index + 1) : '');
  }

  function parseHash() {
    var parts = location.hash.replace(/^#\/?/, '').split('/');
    return {
      app: findApp(parts[0]) || state.apps[0],
      view: viewExists(parts[1]) ? parts[1] : 'about',
      index: Math.max(0, (parseInt(parts[2], 10) || 1) - 1)
    };
  }

  // ---- views ---------------------------------------------------------------

  function tabs() {
    tabsEl.innerHTML = state.apps.map(function (app, i) {
      var selected = app === current.app;
      return '<a class="tab" role="tab" href="' + hashFor(app) + '" data-key="tab-' + esc(app.id) + '"' +
        ' aria-selected="' + selected + '" style="' + accentStyle(app) + '" title="' + (i + 1) + '. ' + esc(app.name) + '">' +
        '<span class="tab-num">' + (i + 1) + '</span><span class="tab-name">' + esc(app.name) + '</span></a>';
    }).join('');
    fitTabs();
  }

  /** Inactive tabs collapse to their number when all names do not fit in one row. */
  function fitTabs() {
    tabsEl.classList.remove('compact');
    if (tabsEl.scrollWidth > tabsEl.clientWidth + 1) tabsEl.classList.add('compact');
    var active = tabsEl.querySelector('[aria-selected="true"]');
    if (active) {
      var left = active.offsetLeft - tabsEl.offsetLeft;
      if (left < tabsEl.scrollLeft) tabsEl.scrollLeft = left;
      else if (left + active.offsetWidth > tabsEl.scrollLeft + tabsEl.clientWidth) {
        tabsEl.scrollLeft = left + active.offsetWidth - tabsEl.clientWidth;
      }
    }
  }

  function appHead(app, rel) {
    var meta = [rel.version ? 'v' + rel.version : '버전 준비 중', app.platform || 'Android'].join(' · ');
    return '<div class="app-head">' +
      '<div class="app-icon" aria-hidden="true">' + esc(app.icon || app.name.charAt(0)) + '</div>' +
      '<div class="app-title"><h1>' + esc(app.name) +
      (app.edition ? '<span class="edition">' + esc(app.edition) + '</span>' : '') + '</h1>' +
      '<p class="app-meta">' + esc(meta) + '</p></div>' +
      (isNew(rel.date) ? '<span class="new-badge">NEW</span>' : '') +
      '</div>';
  }

  function segments(app) {
    return '<nav class="seg" role="tablist" aria-label="' + esc(app.name) + ' 정보">' + VIEWS.map(function (v) {
      return '<a role="tab" href="' + hashFor(app, v.id) + '" data-key="seg-' + v.id + '" aria-selected="' + (v.id === current.view) + '">' + v.label + '</a>';
    }).join('') + '</nav>';
  }

  function aboutView(app, rel) {
    return '<div class="about">' +
      '<p class="highlight"><span class="pill">핵심</span>' + esc(app.highlight) + '</p>' +
      (app.summary ? '<p class="summary">' + esc(app.summary) + '</p>' : '') +
      list(coreFeatures(app), 'features core') +
      '<div class="about-spacer"></div>' +
      '<div class="release-row">' +
      (rel.date ? '<span>' + esc(formatDate(rel.date)) + '</span>' : '') +
      (app.inAppUpdate ? '<span class="chip-ok">앱 안에서 업데이트</span>' : '') +
      '<span class="grow"></span>' +
      (rel.size ? '<span>' + esc(rel.size) + '</span>' : '') +
      '</div>' +
      (app.requirement ? '<p class="requirement">' + esc(app.requirement) + '</p>' : '') +
      '</div>';
  }

  /** Pages for the paged views. Each page: { mark, label, kicker, title, body, big }. */
  function pages(app, view) {
    if (view === 'usage') {
      var steps = (app.usage || []).map(function (u, i, all) {
        return {
          kicker: 'STEP ' + (i + 1) + ' / ' + all.length,
          title: u.title,
          body: '<p>' + esc(u.body) + '</p>',
          big: i + 1
        };
      });
      if ((app.notes || []).length) {
        steps.push({ mark: '!', label: '알아두세요', kicker: 'NOTE', title: '알아두세요', body: list(app.notes, 'notes') });
      }
      return steps;
    }
    if (view === 'features') {
      return (app.featureGroups || []).map(function (g, i, all) {
        return { kicker: '기능 ' + (i + 1) + ' / ' + all.length, title: g.title, body: list(g.items || [], 'features') };
      });
    }
    if (view === 'history') {
      var versions = app.historyList || (app.latest ? [app.latest] : []);
      return versions.map(function (h, i) {
        var latest = i === 0;
        return {
          kicker: [formatDate(h.publishedAt), formatSize(h.size)].filter(Boolean).join(' · ') + (latest ? ' · 최신' : ''),
          title: 'v' + h.versionName,
          body: (latest && h.sha256 ? '<div class="verify"><span>SHA-256</span><code>' + esc(h.sha256) + '</code>' +
              '<button class="copy" type="button" data-copy="' + esc(h.sha256) + '">복사</button></div>' : '') +
            '<p class="pre">' + esc(h.notes || '변경 내용이 없습니다.') + '</p>' +
            (!latest && h.apkUrl ? '<p><a class="text-link" href="' + esc(h.apkUrl) + '" download>이 버전 받기</a></p>' : '')
        };
      });
    }
    return [];
  }

  function pager(items, index, dir) {
    if (!items.length) return '<p class="empty">아직 내용이 없습니다.</p>';
    var page = items[index];
    var last = items.length - 1;
    var nums = items.length <= 9
      ? '<div class="nums">' + items.map(function (it, i) {
        return '<button class="num" type="button" data-step="' + i + '" data-key="num-' + i + '"' +
          ' aria-label="' + esc(it.label || (i + 1) + '번째') + '"' + (i === index ? ' aria-current="step"' : '') + '>' +
          esc(it.mark || i + 1) + '</button>';
      }).join('') + '</div>'
      : '<p class="count">' + (index + 1) + ' / ' + items.length + '</p>';
    return '<div class="pager">' +
      '<section class="slide"' + (dir ? ' data-dir="' + dir + '"' : '') + ' aria-roledescription="slide">' +
      (page.big ? '<span class="big" aria-hidden="true">' + page.big + '</span>' : '') +
      '<p class="kicker">' + esc(page.kicker) + '</p>' +
      '<h2>' + esc(page.title) + '</h2>' +
      '<div class="slide-body">' + page.body + '</div>' +
      '</section>' +
      '<div class="pager-nav">' +
      '<button class="arrow" type="button" data-step="' + (index - 1) + '" data-key="prev" aria-label="이전"' + (index === 0 ? ' disabled' : '') + '>' + ICON_PREV + '</button>' +
      nums +
      '<button class="arrow" type="button" data-step="' + (index + 1) + '" data-key="next" aria-label="다음"' + (index === last ? ' disabled' : '') + '>' + ICON_NEXT + '</button>' +
      '</div></div>';
  }

  function render(dir) {
    var app = current.app;
    var rel = release(app);
    var items = pages(app, current.view);
    current.index = Math.min(current.index, Math.max(0, items.length - 1));
    current.count = items.length;

    var focusKey = document.activeElement && document.activeElement.getAttribute('data-key');
    tabs();
    root.innerHTML =
      '<article class="app" style="' + accentStyle(app) + '">' +
      appHead(app, rel) +
      segments(app) +
      '<div class="view">' + (current.view === 'about' ? aboutView(app, rel) : pager(items, current.index, dir)) + '</div>' +
      '<div class="dock">' + downloadButton(app, rel) + installerNote(app, rel) + '</div>' +
      '</article>';
    markOverflow();
    if (focusKey) {
      var target = document.querySelector('[data-key="' + focusKey + '"]:not([disabled])');
      if (target) target.focus({ preventScroll: true });
    }
    document.title = app.name + ' · ' + (state.site.title || '앱 다운로드');
  }

  /** Long text that cannot fit on a phone scrolls inside its card; fade the edge to show there is more. */
  function markOverflow() {
    var body = root.querySelector('.slide-body, .about');
    if (!body) return;
    var update = function () {
      body.classList.toggle('more', body.scrollTop + body.clientHeight < body.scrollHeight - 2);
    };
    body.addEventListener('scroll', update, { passive: true });
    update();
  }

  function route() {
    var next = parseHash();
    var dir = next.app === current.app && next.view === current.view && next.index !== current.index
      ? (next.index > current.index ? 'next' : 'prev') : '';
    current.app = next.app;
    current.view = next.view;
    current.index = next.index;
    render(dir);
  }

  /** Steps replace the URL instead of adding history entries, so Back leaves the page. */
  function step(index) {
    if (current.view === 'about' || index < 0 || index >= current.count || index === current.index) return;
    var dir = index > current.index ? 'next' : 'prev';
    current.index = index;
    history.replaceState(null, '', hashFor(current.app, current.view, index));
    render(dir);
  }

  // ---- input ---------------------------------------------------------------

  root.addEventListener('click', function (event) {
    var stepButton = event.target.closest('[data-step]');
    if (stepButton) {
      step(parseInt(stepButton.getAttribute('data-step'), 10));
      return;
    }
    var button = event.target.closest('[data-copy]');
    if (!button) return;
    var text = button.getAttribute('data-copy');
    var done = function () { button.textContent = '복사됨'; setTimeout(function () { button.textContent = '복사'; }, 1500); };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, function () {});
  });

  document.addEventListener('keydown', function (event) {
    if (event.altKey || event.ctrlKey || event.metaKey || !current.app) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) return;
    if (/^[1-9]$/.test(event.key)) {
      var app = state.apps[parseInt(event.key, 10) - 1];
      if (app) location.hash = hashFor(app);
    } else if (event.key === 'ArrowLeft') {
      step(current.index - 1);
    } else if (event.key === 'ArrowRight') {
      step(current.index + 1);
    }
  });

  var touch = null;
  root.addEventListener('touchstart', function (event) {
    var t = event.touches[0];
    touch = event.touches.length === 1 && event.target.closest('.pager') ? { x: t.clientX, y: t.clientY } : null;
  }, { passive: true });
  root.addEventListener('touchend', function (event) {
    if (!touch) return;
    var t = event.changedTouches[0];
    var dx = t.clientX - touch.x;
    var dy = t.clientY - touch.y;
    touch = null;
    if (Math.abs(dx) >= SWIPE_MIN && Math.abs(dx) > Math.abs(dy) * 1.5) step(current.index + (dx < 0 ? 1 : -1));
  }, { passive: true });

  window.addEventListener('hashchange', route);
  window.addEventListener('resize', function () { if (current.app) fitTabs(); });

  load().then(function () {
    if (!state.apps.length) throw new Error('no apps');
    document.getElementById('footerMaxKey').textContent = Math.min(state.apps.length, 9);
    route();
  }).catch(function () {
    root.innerHTML = '<div class="error-box">앱 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</div>';
  });
})();
