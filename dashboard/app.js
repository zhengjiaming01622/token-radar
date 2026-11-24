// Token Launch Radar's dashboard. It reads window.RADAR (written beside dashboard/ by main.ts) and
// renders the ranked board, filterable and sortable, a per-protocol detail view with the model's
// own arithmetic and the protocol's farm plan, and the live-token set kept apart from the ranking.
// No network: every byte it shows is in data.js, and every figure traces to the sealed snapshot.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', category: 'all', chain: 'all', tab: 'pre-token', sort: 'implied', dir: -1, selected: null };

  function fmtUsd(n) {
    if (n === null || n === undefined) return '—';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(n);
  }
  function fmtPct(n) { return n === null || n === undefined ? '—' : (n > 0 ? '+' : '') + n.toFixed(1) + '%'; }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days < 365) return days + 'd';
    return (days / 365).toFixed(1) + 'y';
  }
  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined) return;
      if (k === 'text') node.textContent = v;
      else if (k === 'class') node.className = v;
      else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v);
    });
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (child) node.appendChild(child);
    }
    return node;
  }
  function bySlug(slug) {
    for (var i = 0; i < DATA.rows.length; i++) if (DATA.rows[i].slug === slug) return DATA.rows[i];
    return null;
  }

  /* Hash state: the board's filters and the open detail survive a reload and a screenshot. */
  function readHash() {
    var h = window.location.hash.replace(/^#\/?/, '');
    var parts = h.split('&');
    var kv = {};
    parts.forEach(function (p) { var i = p.indexOf('='); if (i > 0) kv[p.slice(0, i)] = decodeURIComponent(p.slice(i + 1)); });
    if (kv.p) { state.selected = kv.p; return; }
    state.selected = null;
    if (kv.q !== undefined) state.q = kv.q;
    if (kv.cat) state.category = kv.cat;
    if (kv.chain) state.chain = kv.chain;
    if (kv.tab) state.tab = kv.tab;
  }
  function writeHash() {
    var bits = [];
    if (state.q) bits.push('q=' + encodeURIComponent(state.q));
    if (state.category !== 'all') bits.push('cat=' + encodeURIComponent(state.category));
    if (state.chain !== 'all') bits.push('chain=' + encodeURIComponent(state.chain));
    if (state.tab !== 'pre-token') bits.push('tab=' + state.tab);
    history.replaceState(null, '', bits.length ? '#/' + bits.join('&') : '#/');
  }
  function openDetail(slug) { state.selected = slug; history.replaceState(null, '', '#/p=' + encodeURIComponent(slug)); render(); window.scrollTo(0, 0); }
  function closeDetail() { state.selected = null; writeHash(); render(); }

  function visibleRows() {
    return DATA.rows.filter(function (r) {
      if (state.category !== 'all' && (r.category || 'Other') !== state.category) return false;
      if (state.chain !== 'all' && r.chains.indexOf(state.chain) < 0) return false;
      if (state.q) {
        var q = state.q.toLowerCase();
        if (r.name.toLowerCase().indexOf(q) < 0 && r.slug.indexOf(q) < 0) return false;
      }
      return true;
    });
  }
  function sorted(list) {
    var key = state.sort, dir = state.dir;
    var val = {
      implied: function (r) { return r.implied_value_usd; },
      tvl: function (r) { return r.tvl_usd; },
      growth: function (r) { return r.change_7d === null ? -Infinity : r.change_7d; },
      age: function (r) { return r.age_days === null ? -1 : r.age_days; },
      mult: function (r) { return r.category_multiple; },
      name: function (r) { return r.name.toLowerCase(); }
    }[key] || function (r) { return r.implied_value_usd; };
    return list.slice().sort(function (a, b) {
      var x = val(a), y = val(b);
      if (x < y) return -dir; if (x > y) return dir;
      return a.rank - b.rank;
    });
  }

  function radarMark() {
    var c = document.createElement('canvas');
    c.width = 88; c.height = 88;
    c.setAttribute('class', 'radar-mark');
    c.setAttribute('aria-hidden', 'true');
    var g = c.getContext('2d');
    if (!g) return c;
    g.strokeStyle = '#2dd4bf'; g.fillStyle = '#2dd4bf';
    [40, 27, 13].forEach(function (r, i) {
      g.globalAlpha = 0.45 + i * 0.18; g.lineWidth = 3 - i * 0.5;
      g.beginPath(); g.arc(44, 44, r, 0, Math.PI * 2); g.stroke();
    });
    g.globalAlpha = 0.3;
    g.beginPath(); g.moveTo(44, 44); g.lineTo(44, 4); g.arc(44, 44, 40, -Math.PI / 2, -Math.PI / 6); g.closePath(); g.fill();
    g.globalAlpha = 1; g.fillStyle = '#f5b544';
    g.beginPath(); g.arc(62, 30, 5, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2dd4bf';
    g.beginPath(); g.arc(30, 58, 4, 0, Math.PI * 2); g.fill();
    return c;
  }

  function header(compact) {
    var totalImplied = DATA.rows.reduce(function (s, r) { return s + r.implied_value_usd; }, 0);
    var head = el('div', { 'class': 'masthead' },
      el('div', { 'class': 'brand' }, radarMark(),
        el('div', null,
          el('h1', null, document.createTextNode('Token Launch Radar '), el('span', { 'class': 'thin', text: '— who issues next, and what it is worth' })))),
      el('div', { 'class': 'stamp' },
        el('div', null, document.createTextNode('Snapshot '), el('b', { text: DATA.as_of })),
        el('div', { text: DATA.source })));
    if (compact) return [head];
    var lede = el('p', { 'class': 'lede' },
      document.createTextNode('Every protocol here is ranked by an '),
      el('b', { text: 'implied value' }),
      document.createTextNode(': what its token would be worth if it issued at the value the market already gives its category. The board covers all '),
      el('b', { text: String(DATA.watchlist_size) + ' watchlist protocols' }),
      document.createTextNode(' at or above ' + fmtUsd(DATA.floor_usd) + ' TVL with no token yet, plus ' + DATA.early_size + ' early finds below the floor. Protocols whose token already trades are kept apart, at market value, under Live tokens.'));
    var stats = el('div', { 'class': 'stats' },
      stat('Watchlist covered', DATA.watchlist_size + ' / ' + DATA.watchlist_size),
      stat('Board rows', String(DATA.board_size), DATA.early_size + ' early'),
      stat('Implied value on board', fmtUsd(totalImplied)),
      stat('Live tokens set aside', String(DATA.live_size)),
      stat('Model', DATA.model_version, 'measured live'));
    return [head, lede, stats];
  }
  function stat(k, v, small) {
    return el('div', { 'class': 'stat' },
      el('div', { 'class': 'k', text: k }),
      el('div', { 'class': 'v' }, document.createTextNode(v), small ? el('small', { text: ' ' + small }) : null));
  }

  function modelPanel() {
    var m = DATA.model;
    var chips = DATA.categories.slice(0, 14).map(function (c) {
      return el('span', { 'class': 'mult' }, document.createTextNode(c.category + ' '), el('b', { text: '×' + c.multiple.toFixed(2) }), document.createTextNode(' · ' + c.peers + ' peers'));
    });
    return el('section', { 'class': 'model' },
      el('h2', { text: 'How a number is made — model ' + DATA.model_version }),
      el('p', null,
        document.createTextNode('Implied value = TVL × '), el('b', { text: 'category multiple' }),
        document.createTextNode(' × growth × maturity. The multiple is not a constant: it is the '),
        el('b', { text: 'median market-cap / TVL of the live-token protocols in the same category, measured from this snapshot' }),
        document.createTextNode(' (snapshot-wide median ×' + DATA.global_multiple.toFixed(2) + '), shrunk toward that median when a category has few peers and clamped to [0.03, 2.5]. Growth clamps the 7-day TVL change to [' + m.growth_floor + '%, +' + m.growth_cap + '%] at weight ' + m.growth_weight + '; maturity rises from ' + m.maturity_floor + ' to ' + (m.maturity_floor + m.maturity_range).toFixed(1) + ' over ' + m.maturity_days + ' days without a token. No protocol name is special-cased anywhere.')),
      el('div', { 'class': 'mult-grid' }, chips));
  }

  function controls(count) {
    var cats = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.reduce(function (a, r) { return a.concat(r.chains); }, []))).sort();
    var search = el('input', { type: 'search', placeholder: 'Search name or slug…', value: state.q, 'aria-label': 'Search protocols' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var catSel = el('select', { 'aria-label': 'Filter by category' },
      [el('option', { value: 'all', text: 'All categories' })].concat(cats.map(function (c) {
        return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null });
      })));
    catSel.addEventListener('change', function () { state.category = catSel.value; writeHash(); render(); });
    var chainSel = el('select', { 'aria-label': 'Filter by chain' },
      [el('option', { value: 'all', text: 'All chains' })].concat(chains.map(function (c) {
        return el('option', { value: c, text: c, selected: c === state.chain ? 'selected' : null });
      })));
    chainSel.addEventListener('change', function () { state.chain = chainSel.value; writeHash(); render(); });
    var pre = el('button', { type: 'button', 'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-token board', onclick: function () { state.tab = 'pre-token'; writeHash(); render(); } });
    var live = el('button', { type: 'button', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live tokens', onclick: function () { state.tab = 'live'; writeHash(); render(); } });
    return el('div', { 'class': 'controls' },
      el('div', { 'class': 'tabs' }, pre, live), search, catSel, chainSel,
      el('span', { 'class': 'count', text: count }));
  }

  function sortHeader(key, label, cls) {
    var arrow = state.sort === key ? (state.dir === -1 ? ' ↓' : ' ↑') : '';
    return el('th', { 'class': cls || '' },
      el('button', { type: 'button', text: label + arrow, onclick: function () {
        if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; }
        render();
      } }));
  }

  function boardTable() {
    var list = sorted(visibleRows());
    var parts = [controls(list.length + ' of ' + DATA.board_size + ' protocols')];
    if (list.length === 0) {
      parts.push(el('div', { 'class': 'empty' },
        el('p', { text: 'No protocol matches those filters.' }),
        el('button', { 'class': 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; writeHash(); render(); } })));
      return parts;
    }
    var head = el('thead', null, el('tr', null,
      el('th', { text: '#' }), sortHeader('name', 'Protocol'),
      el('th', { 'class': 'hide-s', text: 'Category' }),
      sortHeader('tvl', 'TVL', 'num'), sortHeader('growth', '7d', 'num hide-s'),
      sortHeader('age', 'No-token age', 'num hide-s'), sortHeader('mult', 'Multiple', 'num hide-s'),
      sortHeader('implied', 'Implied value', 'num')));
    var body = el('tbody', null, list.map(function (r) {
      var badge = r.watchlist
        ? el('span', { 'class': 'badge watch', text: 'WATCHLIST' })
        : el('span', { 'class': 'badge early', text: 'EARLY' });
      var tr = el('tr', { tabindex: '0', onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } } },
        el('td', { 'class': 'rank', text: String(r.rank) }),
        el('td', { 'class': 'name' }, document.createTextNode(r.name), badge, el('span', { 'class': 'slug', text: r.slug })),
        el('td', { 'class': 'cat hide-s', text: r.category || 'Other' }),
        el('td', { 'class': 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { 'class': 'num hide-s ' + (r.change_7d > 0 ? 'up' : r.change_7d < 0 ? 'down' : ''), text: fmtPct(r.change_7d) }),
        el('td', { 'class': 'num hide-s', text: fmtAge(r.age_days) }),
        el('td', { 'class': 'num hide-s', text: '×' + r.category_multiple.toFixed(2) }),
        el('td', { 'class': 'num implied', text: fmtUsd(r.implied_value_usd) }));
      return tr;
    }));
    parts.push(el('table', null, head, body));
    return parts;
  }

  function liveTable() {
    var parts = [controls(DATA.live.length + ' live-token protocols, at market value — never ranked')];
    var head = el('thead', null, el('tr', null,
      el('th', { text: 'Protocol' }), el('th', { 'class': 'hide-s', text: 'Category' }),
      el('th', { 'class': 'num', text: 'Market cap' }), el('th', { 'class': 'num', text: 'TVL' }),
      el('th', { 'class': 'num hide-s', text: '7d' })));
    var body = el('tbody', null, DATA.live.map(function (r) {
      return el('tr', null,
        el('td', { 'class': 'name' }, document.createTextNode(r.name), el('span', { 'class': 'slug', text: r.slug })),
        el('td', { 'class': 'cat hide-s', text: r.category || 'Other' }),
        el('td', { 'class': 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', { 'class': 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { 'class': 'num hide-s ' + (r.change_7d > 0 ? 'up' : r.change_7d < 0 ? 'down' : ''), text: fmtPct(r.change_7d) }));
    }));
    parts.push(el('table', null, head, body));
    return parts;
  }

  function detail(r) {
    var growthMult = r.growth_multiplier, matMult = r.maturity_multiplier;
    var back = el('div', { 'class': 'back' },
      el('button', { 'class': 'button', type: 'button', text: '← Back to the board', onclick: closeDetail }));
    var head = el('div', { 'class': 'detail-head' },
      el('div', null,
        el('h2', null, document.createTextNode(r.name),
          r.watchlist ? el('span', { 'class': 'badge watch', text: 'WATCHLIST' }) : el('span', { 'class': 'badge early', text: 'EARLY FIND' })),
        el('div', { 'class': 'sub', text: r.slug + ' · ' + (r.category || 'Other') + ' · rank #' + r.rank + ' of ' + DATA.board_size })),
      el('div', { 'class': 'big-implied' },
        el('div', { 'class': 'k', text: 'Implied value' }),
        el('div', { 'class': 'v', text: fmtUsd(r.implied_value_usd) })));
    var record = el('div', { 'class': 'card' },
      el('h3', { text: 'Snapshot record' }),
      kv('TVL', fmtUsd(r.tvl_usd)), kv('TVL change, 7 days', fmtPct(r.change_7d)),
      kv('Tracked since', r.listed_at || 'unknown'), kv('Time with no token', fmtAge(r.age_days)),
      kv('Chains', r.chains.join(', ') || '—'), kv('Token', 'none yet — pre-token'));
    var model = el('div', { 'class': 'card' },
      el('h3', { text: 'The model, on this row' }),
      el('p', { 'class': 'formula' },
        document.createTextNode(fmtUsd(r.tvl_usd) + ' TVL × '),
        el('b', { text: '×' + r.category_multiple.toFixed(2) }),
        document.createTextNode(' category multiple (' + (r.category_peers > 1 ? 'median of ' + r.category_peers + ' live ' + (r.category || '') + ' peers in the snapshot' : r.category_peers === 1 ? 'one live ' + (r.category || '') + ' peer in the snapshot, shrunk toward the snapshot median' : 'snapshot-wide median — no live peers in this category') + ') × '),
        el('b', { text: '×' + growthMult.toFixed(2) }),
        document.createTextNode(' growth × '),
        el('b', { text: '×' + matMult.toFixed(2) }),
        document.createTextNode(' maturity = '),
        el('b', { text: fmtUsd(r.implied_value_usd) })));
    var plan = el('div', { 'class': 'card' },
      el('h3', { text: 'Farm plan' }),
      el('ol', { 'class': 'plan' }, r.farm_steps.map(function (s) { return el('li', { text: s }); })));
    return [back, head, el('div', { 'class': 'cards' }, record, model), plan];
  }
  function kv(k, v) { return el('div', { 'class': 'kv' }, el('span', { 'class': 'k', text: k }), el('span', { 'class': 'v', text: v })); }

  function render() {
    readHash();
    app.setAttribute('aria-busy', 'false');
    app.innerHTML = '';
    var parts = header(!!state.selected);
    if (state.selected) {
      var row = bySlug(state.selected);
      if (row) { parts = parts.concat(detail(row)); appendAll(parts); return; }
      state.selected = null;
    }
    parts.push(modelPanel());
    parts = parts.concat(state.tab === 'live' ? liveTable() : boardTable());
    parts.push(el('footer', { text: 'Built from the sealed DefiLlama snapshot of ' + DATA.as_of + ' (' + DATA.source + '). Implied values are this board\u2019s own model claims, not prices or predictions: a protocol may never issue a token. Farm plans are checklists, not financial advice.' }));
    appendAll(parts);
  }
  function appendAll(parts) { parts.forEach(function (p) { if (Array.isArray(p)) p.forEach(function (x) { app.appendChild(x); }); else app.appendChild(p); }); }

  window.addEventListener('hashchange', render);
  render();
})();
