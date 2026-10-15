(function () {
  'use strict';

  var root = document.getElementById('app');
  var state = { site: {}, apps: [] };
  var NEW_DAYS = 7;

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
    var current = document.documentElement.getAttribute('data-theme') ||
      (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    var next = current === 'light' ? 'dark' : 'light';
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

  function allFeatures(app) {
    return (app.featureGroups || []).reduce(function (all, group) { return all.concat(group.items || []); }, []);
  }

  function accentStyle(app) {
    return '--a:' + esc(app.accent || '#b9a2ff') + ';--a2:' + esc(app.accent2 || app.accent || '#7c6cff');
  }

  var ICON_DOWNLOAD = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 20h14"/></svg>';
  var ICON_BACK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';

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

  // ---- views ---------------------------------------------------------------

  function downloadButton(app, rel) {
    if (rel.url) {
      return '<a class="btn btn-primary" href="' + esc(rel.url) + '" download>' + ICON_DOWNLOAD + 'APK 다운로드</a>';
    }
    return '<button class="btn btn-primary" type="button" disabled>' + ICON_DOWNLOAD + 'APK 준비 중</button>';
  }

  function appHead(app, rel, large) {
    var meta = [rel.version ? 'v' + rel.version : '버전 준비 중', app.platform || 'Android'].join(' · ');
    var tag = large ? 'h1' : 'h2';
    return '<div class="app-head">' +
      '<div class="app-icon' + (large ? ' lg' : '') + '" aria-hidden="true">' + esc(app.icon || app.name.charAt(0)) + '</div>' +
      '<div class="app-title"><' + tag + '>' + esc(app.name) +
      (app.edition ? '<span class="edition">' + esc(app.edition) + '</span>' : '') + '</' + tag + '>' +
      '<p class="app-meta">' + esc(meta) + '</p></div>' +
      (isNew(rel.date) ? '<span class="new-badge">NEW</span>' : '') +
      '</div>';
  }

  function card(app) {
    var rel = release(app);
    var features = allFeatures(app);
    var preview = features.slice(0, 6);
    var rest = features.length - preview.length;
    return '<article class="card" style="' + accentStyle(app) + '">' +
      appHead(app, rel, false) +
      '<p class="highlight"><span class="pill">핵심</span>' + esc(app.highlight) + '</p>' +
      '<p class="summary">' + esc(app.summary) + '</p>' +
      '<ul class="features">' + preview.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul>' +
      (rest > 0 ? '<p class="more-features">외 ' + rest + '개 기능</p>' : '') +
      (app.requirement ? '<p class="requirement">' + esc(app.requirement) + '</p>' : '') +
      '<div class="card-spacer"></div>' +
      '<div class="release-row">' +
      (rel.date ? '<span>' + esc(formatDate(rel.date)) + '</span>' : '') +
      (app.inAppUpdate ? '<span class="chip-ok">앱 안에서 업데이트</span>' : '') +
      '<span class="grow"></span>' +
      (rel.size ? '<span>' + esc(rel.size) + '</span>' : '') +
      '</div>' +
      '<div class="actions">' +
      '<a class="btn" href="#/' + esc(app.id) + '">상세 정보 · 사용법</a>' +
      downloadButton(app, rel) +
      '</div>' +
      '</article>';
  }

  function installGuide() {
    return '<section class="section" aria-labelledby="installTitle">' +
      '<h2 class="section-title" id="installTitle">APK 설치 방법</h2>' +
      '<ol class="steps cols">' +
      '<li><h3>APK 다운로드</h3><p>앱 카드의 APK 다운로드를 누릅니다. 브라우저가 경고하면 다운로드를 계속합니다.</p></li>' +
      '<li><h3>설치 허용</h3><p>받은 파일을 열고, 처음이면 브라우저나 파일 앱의 \'출처를 알 수 없는 앱 설치\'를 허용합니다.</p></li>' +
      '<li><h3>설치 후 업데이트</h3><p>앱 안에서 업데이트를 지원하는 앱은 새 버전이 나오면 앱이 알려 줍니다.</p></li>' +
      '</ol></section>';
  }

  function home() {
    var latestDate = state.apps.map(function (a) { return release(a).date || ''; }).sort().pop();
    var platforms = state.apps.map(function (a) { return a.platform || 'Android'; })
      .filter(function (p, i, all) { return all.indexOf(p) === i; });
    root.innerHTML =
      '<section class="hero">' +
      '<p class="eyebrow">APPS</p>' +
      '<h1>앱을 바로<br>다운로드하세요.</h1>' +
      '<p class="lead">' + esc(state.site.intro || '') + '</p>' +
      '<ul class="hero-stats">' +
      '<li>앱 <b>' + state.apps.length + '개</b></li>' +
      '<li><b>' + esc(platforms.join(' · ')) + '</b></li>' +
      (latestDate ? '<li>최근 업데이트 <b>' + esc(formatDate(latestDate)) + '</b></li>' : '') +
      '</ul></section>' +
      '<section class="grid" aria-label="앱 목록">' + state.apps.map(card).join('') + '</section>' +
      installGuide();
    document.title = state.site.title || '앱 다운로드';
  }

  function historyPanel(app) {
    var list = app.historyList || (app.latest ? [app.latest] : []);
    if (!list.length) return '<p class="empty">아직 게시된 버전이 없습니다.</p>';
    return '<div class="history">' + list.map(function (h, index) {
      return '<details' + (index === 0 ? ' open' : '') + '>' +
        '<summary>v' + esc(h.versionName) +
        (index === 0 ? '<span class="latest">최신</span>' : '') +
        '<small>' + esc(formatDate(h.publishedAt)) + (h.size ? ' · ' + esc(formatSize(h.size)) : '') + '</small>' +
        '</summary>' +
        '<div class="body">' + esc(h.notes || '변경 내용이 없습니다.') +
        (h.apkUrl && index > 0 ? '\n\n<a href="' + esc(h.apkUrl) + '" download>이 버전 받기</a>' : '') +
        '</div></details>';
    }).join('') + '</div>';
  }

  function detail(app) {
    var rel = release(app);
    root.innerHTML =
      '<div style="' + accentStyle(app) + '">' +
      '<a class="back" href="#">' + ICON_BACK + '전체 앱</a>' +
      '<section class="detail-hero">' +
      appHead(app, rel, true) +
      '<p class="highlight"><span class="pill">핵심</span>' + esc(app.highlight) + '</p>' +
      '<p class="summary">' + esc(app.summary) + '</p>' +
      '<div class="actions">' + downloadButton(app, rel) + '</div>' +
      '<p class="download-note">' + esc([rel.date && formatDate(rel.date), rel.size, app.requirement].filter(Boolean).join(' · ')) + '</p>' +
      (rel.sha256 ? '<div class="verify"><span>SHA-256</span><code>' + esc(rel.sha256) + '</code>' +
        '<button class="copy" type="button" data-copy="' + esc(rel.sha256) + '">복사</button></div>' : '') +
      '</section>' +
      '<div class="detail-grid">' +
      '<div class="col">' +
      '<section class="panel order-1"><h2>주요 기능</h2><div class="feature-groups">' +
      (app.featureGroups || []).map(function (g) {
        return '<div><h3>' + esc(g.title) + '</h3><ul class="features">' +
          (g.items || []).map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul></div>';
      }).join('') +
      '</div></section>' +
      '<section class="panel order-4"><h2>업데이트 기록</h2>' + historyPanel(app) + '</section>' +
      '</div>' +
      '<div class="col">' +
      '<section class="panel order-2"><h2>사용법</h2><ol class="steps">' +
      (app.usage || []).map(function (u) { return '<li><h3>' + esc(u.title) + '</h3><p>' + esc(u.body) + '</p></li>'; }).join('') +
      '</ol></section>' +
      ((app.notes || []).length ? '<section class="panel order-3"><h2>알아두세요</h2><ul class="notes">' +
        app.notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul></section>' : '') +
      '</div>' +
      '</div></div>';
    document.title = app.name + (app.edition ? ' ' + app.edition : '') + ' · ' + (state.site.title || '앱 다운로드');
  }

  // ---- routing -------------------------------------------------------------

  function route() {
    var id = (location.hash.match(/^#\/([\w-]+)/) || [])[1];
    var app = id && state.apps.filter(function (a) { return a.id === id; })[0];
    if (app) detail(app); else home();
    window.scrollTo(0, 0);
  }

  root.addEventListener('click', function (event) {
    var button = event.target.closest('[data-copy]');
    if (!button) return;
    var text = button.getAttribute('data-copy');
    var done = function () { button.textContent = '복사됨'; setTimeout(function () { button.textContent = '복사'; }, 1500); };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, function () {});
  });

  window.addEventListener('hashchange', route);

  load().then(function () {
    document.getElementById('footerApps').textContent = state.apps.map(function (a) { return a.name; }).join(' · ');
    route();
  }).catch(function () {
    root.innerHTML = '<div class="error-box">앱 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</div>';
  });
})();
