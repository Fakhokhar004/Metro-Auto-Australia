/* Metro Auto product page (sections/ma-product.liquid).
   Gallery thumbs, variant switching, quantity, add to cart, "Check it fits", and tabs / phone sections.
   Uses window.MA from ma-theme.js (garage, VehicleSelect, addToCart, fitUrl). */
(function () {
  'use strict';

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function readJson(el) { try { return JSON.parse(el.textContent); } catch (e) { return null; } }
  var PHONE = window.matchMedia ? window.matchMedia('(max-width: 640px)') : { matches: false };

  function init(root) {
    if (root._maInit) return;
    root._maInit = true;
    var MA = window.MA || {};
    var data = readJson($('[data-pdp-variants]', root)) || { variants: [] };
    var money = new Intl.NumberFormat('en-AU', { style: 'currency', currency: data.currency || 'AUD' });
    var fmt = function (cents) { return money.format(cents / 100); };

    var form = $('.ma-pdp__form', root);
    var idInput = $('[data-pdp-variant-id]', root);
    var qtyInput = $('[data-pdp-qty-input]', root);
    var atc = $('[data-pdp-atc]', root);
    var added = $('[data-pdp-added]', root);
    var errorEl = $('[data-pdp-error]', root);
    var current = data.variants.filter(function (v) { return String(v.id) === idInput.value; })[0] || data.variants[0];

    /* ---------- gallery ---------- */
    var main = $('.ma-pdp__img', root);
    function showMedia(btn) {
      if (!btn || !main) return;
      main.src = btn.getAttribute('data-src');
      main.srcset = btn.getAttribute('data-srcset');
      main.alt = btn.getAttribute('data-alt') || '';
      $$('[data-pdp-thumb]', root).forEach(function (b) { b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'); });
    }
    $$('[data-pdp-thumb]', root).forEach(function (b) { b.addEventListener('click', function () { showMedia(b); }); });

    /* ---------- variant, stock, price ---------- */
    function maxQty(v) { return v && v.tracked && v.deny && v.qty > 0 ? Math.min(99, v.qty) : 99; }
    function atcLabel() {
      if (!current || !current.available) return 'Out of stock';
      return 'Add to cart, ' + fmt(current.price * (parseInt(qtyInput.value, 10) || 1));
    }
    function resetAtc() {
      atc.disabled = !current || !current.available;
      atc.textContent = atcLabel();
      added.hidden = true;
      errorEl.hidden = true;
    }
    function applyVariant(v) {
      current = v;
      idInput.value = v.id;
      var stock = $('[data-pdp-stock]', root);
      var text = 'In stock', mod = 'in';
      if (!v.available) { text = 'Out of stock'; mod = 'out'; }
      else if (v.tracked && v.qty > 0 && v.qty <= 5) { text = 'Only ' + v.qty + ' left in Melbourne'; mod = 'low'; }
      else if (v.tracked && v.qty > 0) { text = 'In stock in Melbourne, ' + v.qty + ' available'; }
      stock.textContent = text;
      stock.className = 'ma-pdp__stock ma-pdp__stock--' + mod;
      $('[data-pdp-price]', root).textContent = fmt(v.price);
      var onSale = v.compare > v.price;
      var cmp = $('[data-pdp-compare]', root);
      cmp.hidden = !onSale;
      if (onSale) cmp.textContent = fmt(v.compare);
      var sale = $('[data-pdp-sale]', root);
      if (sale) { sale.hidden = !onSale; if (onSale) sale.textContent = Math.round((1 - v.price / v.compare) * 100) + '% off'; }
      $$('[data-pdp-sku]', root).forEach(function (el) { el.textContent = v.sku || ''; });
      var skuWrap = $('[data-pdp-sku-wrap]', root);
      if (skuWrap) skuWrap.hidden = !v.sku;
      qtyInput.max = maxQty(v);
      setQty(parseInt(qtyInput.value, 10));
      if (v.media) showMedia($('[data-pdp-thumb][data-media-id="' + v.media + '"]', root));
    }
    var variantSel = $('[data-pdp-variant]', root);
    if (variantSel) variantSel.addEventListener('change', function () {
      var v = data.variants.filter(function (x) { return String(x.id) === variantSel.value; })[0];
      if (v) applyVariant(v);
    });

    /* ---------- quantity ---------- */
    function setQty(n) {
      var q = Math.max(1, Math.min(maxQty(current), isNaN(n) ? 1 : n));
      qtyInput.value = q;
      resetAtc();
      return q;
    }
    $$('[data-pdp-qty]', root).forEach(function (b) {
      b.addEventListener('click', function () { setQty((parseInt(qtyInput.value, 10) || 1) + parseInt(b.getAttribute('data-pdp-qty'), 10)); });
    });
    qtyInput.addEventListener('change', function () { setQty(parseInt(String(qtyInput.value).replace(/\D/g, ''), 10)); });

    /* ---------- add to cart (falls back to the normal form post without JS) ---------- */
    form.addEventListener('submit', function (e) {
      if (!MA.addToCart) return;
      e.preventDefault();
      if (!current || !current.available) return;
      var qty = setQty(parseInt(qtyInput.value, 10));
      atc.disabled = true;
      atc.textContent = 'Adding…';
      MA.addToCart(current.id, qty)
        .then(function () {
          atc.textContent = 'Added ' + qty + ' to cart';
          added.hidden = false;
        })
        .catch(function (err) {
          atc.disabled = false;
          atc.textContent = atcLabel();
          errorEl.textContent = (err && err.description) || "Couldn't add this to your cart. Please try again.";
          errorEl.hidden = false;
        });
    });

    /* ---------- Check it fits ---------- */
    var fitBox = $('[data-pdp-fit]', root);
    var fitToggle = $('[data-pdp-fit-toggle]', root);
    if (fitToggle) fitToggle.addEventListener('click', function () {
      if (!PHONE.matches) return;
      var open = !fitBox.classList.contains('is-open');
      fitBox.classList.toggle('is-open', open);
      fitToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    var fitData = readJson($('[data-pdp-fitdata]', root)) || { tags: [], lines: [], rows: [] };
    fitData.lines = fitData.lines || [];

    /* ---------- description reader: move spec and vehicle sections into their own tabs ----------
       Any heading (h1–h6, or a paragraph that is only bold text) whose name matches is read:
       - specs: tables (key | value) and "Key: value" lines go to the Specifications tab;
       - vehicles: lines that read as "Make Model Year …" go to Compatible vehicles and the fit check.
       A section only moves if its content actually reads that way; anything else stays in the description. */
    var HEAD_FIT = /^(compatible vehicles?|vehicle compatibility|compatibility( list)?|vehicle fitment|fitment( list| guide| information| details)?|vehicle applications?|applications? \(guide only\)|suitable vehicles|vehicle list)$/;
    var HEAD_SPEC = /^(specifications?|specs|technical (details|specifications?|data|information)|product (details|specifications?|information)|information|dimensions|additional information|more information|key specifications?)$/;
    var descEl = $('[data-pdp-desc]', root);
    var specsEl = $('[data-pdp-specs]', root);
    var foundFitLines = [];
    function headingText(el) {
      if (/^H[1-6]$/.test(el.tagName)) return el.textContent;
      if (el.tagName === 'P' || el.tagName === 'DIV') {
        var b = el.querySelector('strong, b'), t = el.textContent.trim();
        if (b && t && t === b.textContent.trim() && t.length <= 50) return t;
      }
      return null;
    }
    /* Some imported descriptions contain a literal "\n" (backslash + n) as text: treat it as a space. */
    function clean(t) { return String(t).replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim(); }
    function headName(t) { return String(t).toLowerCase().replace(/\s+/g, ' ').replace(/[\s:]+$/, '').trim(); }
    function sectionNodes(h) {
      var out = [], n = h.nextSibling;
      while (n) { if (n.nodeType === 1 && headingText(n) !== null) break; out.push(n); n = n.nextSibling; }
      return out;
    }
    function readLines(nodes) {
      var lines = [];
      var push = function (t) { t = clean(t); if (t) lines.push({ text: t }); };
      nodes.forEach(function (n) {
        if (n.nodeType === 3) { push(n.textContent); return; }
        if (n.nodeType !== 1) return;
        var trs = n.tagName === 'TR' ? [n] : $$('tr', n);
        if (trs.length) {
          trs.forEach(function (tr) {
            var cells = $$('th, td', tr).map(function (c) { return clean(c.textContent); }).filter(Boolean);
            if (cells.length) lines.push({ cells: cells, text: cells.join(' ') });
          });
          return;
        }
        var lis = n.tagName === 'LI' ? [n] : $$('li', n);
        if (lis.length) { lis.forEach(function (li) { push(li.textContent); }); return; }
        n.innerHTML.split(/<br\s*\/?>/i).forEach(function (part) { var d = document.createElement('div'); d.innerHTML = part; push(d.textContent); });
      });
      return lines;
    }
    function specRows(lines) {
      var rows = [], notes = [];
      lines.forEach(function (l) {
        if (l.cells && l.cells.length >= 2) { rows.push([l.cells[0], l.cells.slice(1).join(' ')]); return; }
        var i = l.text.indexOf(':');
        if (i > 0 && i < 60 && l.text.slice(i + 1).trim()) rows.push([l.text.slice(0, i), l.text.slice(i + 1).trim()]);
        else notes.push(l.text);
      });
      if (rows.length && notes.length) rows.push(['Notes', notes.join(', ')]);
      return rows;
    }
    function addSpecs(rows) {
      if (!specsEl) return;
      var have = {};
      $$('dt', specsEl).forEach(function (dt) { have[headName(dt.textContent)] = 1; });
      rows.forEach(function (r) {
        var key = String(r[0]).replace(/[\s:]+$/, '').trim(), k = headName(key);
        if (!key || have[k]) return;
        have[k] = 1;
        var row = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd');
        dt.textContent = key; dd.textContent = r[1];
        row.appendChild(dt); row.appendChild(dd); specsEl.appendChild(row);
      });
    }
    if (descEl) {
      try {
        var walker = document.createTreeWalker(descEl, NodeFilter.SHOW_TEXT), tn, fix = [];
        while ((tn = walker.nextNode())) { if (tn.nodeValue.indexOf('\\n') > -1) fix.push(tn); }
        fix.forEach(function (n) { n.nodeValue = n.nodeValue.replace(/\\n/g, ' '); });
        $$('h1, h2, h3, h4, h5, h6, p, div', descEl).forEach(function (h) {
          if (!descEl.contains(h)) return;
          var t = headingText(h);
          if (t === null) return;
          var name = headName(t), isFit = HEAD_FIT.test(name), isSpec = !isFit && HEAD_SPEC.test(name);
          if (!isFit && !isSpec) return;
          /* The section ends at its last node of real data, so plain sentences after it stay in the description. */
          var useful = isFit
            ? function (l) { return !!parseLine(l.text); }
            : function (l) { return (l.cells && l.cells.length >= 2) || /^[^:]{1,59}:\s*\S/.test(l.text); };
          var nodes = sectionNodes(h), last = -1;
          nodes.forEach(function (n, i) { if (readLines([n]).some(useful)) last = i; });
          nodes = nodes.slice(0, last + 1);
          var lines = readLines(nodes);
          if (!lines.length) return;
          if (isSpec) {
            var rows = specRows(lines);
            if (!rows.length) return;
            addSpecs(rows);
          } else {
            var texts = lines.map(function (l) { return l.text; });
            var ok = texts.filter(function (t) { return parseLine(t); });
            if (!ok.length || ok.length / texts.length < 0.6) return;
            foundFitLines = foundFitLines.concat(ok);
          }
          nodes.concat([h]).forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
        });
        if (!descEl.textContent.trim() && descEl.getAttribute('data-fallback')) {
          var p = document.createElement('p'); p.textContent = descEl.getAttribute('data-fallback'); descEl.appendChild(p);
        }
      } catch (e) { /* leave the description as it is */ }
      descEl.classList.remove('ma-pdp__rte--pending');
    }
    if (foundFitLines.length) {
      fitData.lines = fitData.lines.concat(foundFitLines);
      var has = $('[data-pdp-fit-has]', root), none = $('[data-pdp-fit-none]', root);
      if (has) has.hidden = false;
      if (none) none.parentNode.removeChild(none);
      $$('[data-pdp-fitpanel-none]', root).forEach(function (el) { el.parentNode.removeChild(el); });
      var sumEl = $('[data-pdp-fit-sum]', root);
      if (sumEl) sumEl.textContent = 'Tap to check';
    }

    /* Vehicle lines lifted from the description, e.g.
       "Hyundai Tucson 2015 TL,TLE 2.0 FWD Petrol 2.0L 4cyl 114kW G4NA" → make, model, year, detail */
    function parseLine(s) {
      var TWO_WORD = ['land rover', 'alfa romeo', 'aston martin', 'great wall', 'rolls royce', 'mercedes benz'];
      s = String(s).replace(/\s+/g, ' ').trim();
      var m = s.match(/^(.+?)\s+((?:19|20)\d{2})(?:\b|$)\s*(.*)$/);
      if (!m) return null;
      var head = m[1], low = head.toLowerCase(), make, model;
      var two = TWO_WORD.filter(function (t) { return low.indexOf(t + ' ') === 0; })[0];
      if (two) { make = head.slice(0, two.length); model = head.slice(two.length + 1); }
      else { var i = head.indexOf(' '); if (i < 0) return null; make = head.slice(0, i); model = head.slice(i + 1); }
      return { make: make, model: model, year: parseInt(m[2], 10), detail: m[3] };
    }
    var descRows = fitData && fitData.lines ? fitData.lines.map(parseLine).filter(Boolean) : [];
    if (descRows.length) {
      /* fit check: one row per vehicle-year */
      descRows.forEach(function (r) { fitData.rows.push({ make: r.make, model: r.model, years: String(r.year) }); });

      /* Compatible vehicles: group the same make, model and variant into a year range */
      var groups = {}, order = [];
      descRows.forEach(function (r) {
        var k = [r.make, r.model, r.detail].join('|').toLowerCase();
        if (!groups[k]) { groups[k] = { make: r.make, model: r.model, detail: r.detail, years: [] }; order.push(k); }
        if (groups[k].years.indexOf(r.year) < 0) groups[k].years.push(r.year);
      });
      var rows = order.map(function (k) { return groups[k]; });
      rows.forEach(function (g) { g.years.sort(); });
      rows.sort(function (a, b) {
        return a.make.localeCompare(b.make) || a.model.localeCompare(b.model) || a.years[0] - b.years[0] || a.detail.localeCompare(b.detail);
      });
      var yearsText = function (y) {
        var lo = y[0], hi = y[y.length - 1];
        if (lo === hi) return String(lo);
        return y.length === hi - lo + 1 ? lo + '–' + hi : y.join(', ');
      };
      var esc = function (s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; };
      var grouped = $('[data-pdp-fit-grouped]', root);
      var raw = $('[data-pdp-fit-raw]', root);
      if (grouped) {
        var check = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#15803D" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"></path></svg>';
        grouped.innerHTML =
          '<p class="ma-pdp__fit-count">' + rows.length + (rows.length === 1 ? ' vehicle' : ' vehicles') + '</p>' +
          '<div class="ma-pdp__fit-table-wrap"><table class="ma-pdp__fit-table"><thead><tr>' +
          '<th scope="col">Make</th><th scope="col">Model</th><th scope="col">Variant and engine</th><th scope="col">Years</th>' +
          '</tr></thead><tbody>' +
          rows.map(function (g) {
            return '<tr><td>' + esc(g.make) + '</td><td>' + esc(g.model) + '</td><td>' + esc(g.detail) + '</td><td>' + yearsText(g.years) + '</td></tr>';
          }).join('') +
          '</tbody></table></div>' +
          '<ul class="ma-pdp__fit-cards">' +
          rows.map(function (g) {
            return '<li><span><strong>' + esc(g.make + ' ' + g.model) + '</strong><span>' + (g.detail ? esc(g.detail) + ', ' : '') + 'Years ' + yearsText(g.years) + '</span></span>' + check + '</li>';
          }).join('') +
          '</ul>';
        grouped.hidden = false;
        if (raw) raw.hidden = true;
      }
    }
    var selRoot = $('[data-pdp-fitsel]', root);
    if (selRoot && MA.VehicleSelect && (fitData.tags.length || fitData.rows.length)) {
      var norm = function (s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ''); };
      var fits = function (v) {
        if (fitData.tags.indexOf(MA.vTag(v)) > -1) return true;
        var y = parseInt(v.year, 10);
        return fitData.rows.some(function (r) {
          if (norm(r.make) !== norm(v.make) || norm(r.model) !== norm(v.model)) return false;
          var ys = String(r.years == null ? '' : r.years).match(/\d{4}/g);
          if (!ys) return true;
          var lo = Math.min.apply(null, ys), hi = Math.max.apply(null, ys);
          if (ys.length === 1 && /\+|on|onward|later|-\s*$/i.test(String(r.years))) hi = 9999;
          return y >= lo && y <= hi;
        });
      };
      var sum = $('[data-pdp-fit-sum]', root);
      var states = $$('[data-pdp-fit-state]', root);
      var show = function (name) { states.forEach(function (el) { el.hidden = el.getAttribute('data-pdp-fit-state') !== name; }); };
      var saveBtn = $('[data-pdp-fit-save]', root);
      var seeLink = $('[data-pdp-fit-see]', root);
      var picked = null;

      var update = function (v) {
        picked = v;
        var active = MA.garage.load().vehicle;
        sum.classList.remove('is-good', 'is-bad');
        if (!v) {
          show('incomplete');
          var activeFits = active && fits(active);
          sum.textContent = activeFits ? 'Fits your ' + active.model : 'Tap to check';
          if (activeFits) sum.classList.add('is-good');
          return;
        }
        var label = MA.vKey(v);
        $$('[data-pdp-fit-label]', root).forEach(function (el) { el.textContent = label; });
        if (fits(v)) {
          show('yes');
          sum.textContent = 'Fits ' + v.model + ' ' + v.year;
          sum.classList.add('is-good');
          saveBtn.hidden = !!(active && MA.vKey(active) === label);
        } else {
          show('no');
          sum.textContent = "Doesn't fit " + v.model;
          sum.classList.add('is-bad');
          seeLink.href = MA.fitUrl(v);
        }
      };
      var vs = MA.VehicleSelect(selRoot, update);
      vs.ready.then(function () { var g = MA.garage.load(); if (g.vehicle) vs.set(g.vehicle); });
      saveBtn.addEventListener('click', function () { if (picked) { MA.garage.select(picked); saveBtn.hidden = true; } });
      seeLink.addEventListener('click', function () { if (picked) MA.garage.select(picked); });
    }

    /* ---------- tabs (desktop) and open/close sections (phone) ---------- */
    var tabs = $$('[data-pdp-tab]', root);
    var panels = $$('[data-pdp-panel]', root);
    function selectTab(name, focus) {
      tabs.forEach(function (t) {
        var on = t.getAttribute('data-pdp-tab') === name;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
        if (on && focus) t.focus();
      });
      panels.forEach(function (p) { p.classList.toggle('is-active', p.getAttribute('data-pdp-panel') === name); });
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { selectTab(t.getAttribute('data-pdp-tab')); });
      t.addEventListener('keydown', function (e) {
        var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        selectTab(tabs[(i + d + tabs.length) % tabs.length].getAttribute('data-pdp-tab'), true);
      });
    });
    if (window.location.hash === '#compatible-vehicles') {
      selectTab('fit');
      var fitPanel = $('[data-pdp-panel="fit"]', root);
      if (fitPanel) setTimeout(function () { fitPanel.closest('[data-pdp-tabs]').scrollIntoView(); }, 50);
    }
    $$('[data-pdp-acc]', root).forEach(function (b) {
      b.addEventListener('click', function () {
        var panel = b.closest('[data-pdp-panel]');
        var open = !panel.classList.contains('is-open');
        panel.classList.toggle('is-open', open);
        b.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    });

    /* ---------- fitment request pop-up ---------- */
    var reqVehicle = $('[data-pdp-req-vehicle]', root);
    var fillReqVehicle = function () {
      var v = MA.garage && MA.garage.load().vehicle;
      if (reqVehicle && v && !reqVehicle.value) reqVehicle.value = MA.vKey(v);
    };
    $$('[data-ma-open="fitreq"]', root).forEach(function (b) { b.addEventListener('click', fillReqVehicle); });
    /* After the form posts, Shopify reloads the page: reopen the pop-up to show "sent" or the errors. */
    if ((window.location.hash === '#fitment-request' || $('[data-pdp-autopen]', root)) && MA.openModal && $('[data-ma-modal="fitreq"]', root)) {
      fillReqVehicle();
      MA.openModal('fitreq');
      if (window.history && history.replaceState) history.replaceState(null, '', window.location.pathname + window.location.search.replace(/[?&]contact_posted=true/, ''));
    }

    /* ---------- Pair it with: Shopify recommendations when there's no collection ---------- */
    var recs = $('[data-pdp-recs]', root);
    if (recs) {
      var pid = root.getAttribute('data-product-id');
      var cardsFrom = function (url) {
        return fetch(url)
          .then(function (r) { return r.ok ? r.text() : ''; })
          .then(function (html) {
            return $$('[data-ma-card]', new DOMParser().parseFromString(html, 'text/html'))
              .filter(function (c) { return c.getAttribute('data-product-id') !== pid; });
          });
      };
      /* Shopify recommendations first; if it has none for this product, other products from the same brand.
         Fetched only when the shopper scrolls near the details tabs. */
      var loadRecs = function () {
      cardsFrom(recs.getAttribute('data-pdp-recs'))
        .then(function (cards) {
          var vendorUrl = recs.getAttribute('data-pdp-recs-vendor');
          return cards.length || !vendorUrl ? cards : cardsFrom(vendorUrl);
        })
        .then(function (cards) {
          cards = cards.slice(0, 4);
          if (!cards.length) return;
          var grid = $('[data-pdp-recs-grid]', recs);
          cards.forEach(function (c) { grid.appendChild(document.importNode(c, true)); });
          recs.hidden = false;
          if (MA.updateFitBadges) MA.updateFitBadges(MA.garage.load().vehicle, grid);
          if (MA.paintWishlist) MA.paintWishlist(grid);
        })
        .catch(function () {});
      };
      if (MA.whenNear) MA.whenNear($('[data-pdp-tabs]', root) || recs.parentNode, loadRecs); else loadRecs();
    }

    resetAtc();
  }

  function boot() { $$('[data-ma-pdp]').forEach(init); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  document.addEventListener('shopify:section:load', boot);
})();
