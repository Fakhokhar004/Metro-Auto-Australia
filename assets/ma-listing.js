/* Metro Auto listing pages (sections/ma-collection.liquid).
   Filter groups open/close, filters apply as soon as they change (normal GET, so URLs are shareable),
   the "Filters" button below 900px, and the "Only parts that fit my car" switch.
   Uses window.MA from ma-theme.js (garage, vKey, vTag). */
(function () {
  'use strict';

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function init(root) {
    if (root._maInit) return;
    root._maInit = true;
    var MA = window.MA || {};
    var form = $('[data-ma-filter-form]', root);

    /* ---------- filter groups ---------- */
    $$('[data-ma-facet-toggle]', root).forEach(function (b) {
      b.addEventListener('click', function () {
        var facet = b.closest('[data-ma-facet]');
        var body = $('.ma-facet__body', facet);
        var open = !facet.classList.contains('is-open') || facet.classList.contains('is-closing');
        b.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open) {
          facet.classList.remove('is-closing');
          facet.classList.add('is-open');
          if (MA.slide) MA.slide(body, true);
        } else {
          facet.classList.add('is-closing');
          var shut = function () { if (facet.classList.contains('is-closing')) facet.classList.remove('is-open', 'is-closing'); };
          if (MA.slide) MA.slide(body, false, shut); else shut();
        }
      });
    });
    $$('[data-ma-more-toggle]', root).forEach(function (b) {
      b.addEventListener('click', function () {
        $$('[data-ma-more]', b.closest('[data-ma-facet]')).forEach(function (el) { el.hidden = false; });
        b.parentNode.removeChild(b);
      });
    });

    /* ---------- apply filters ---------- */
    function submit() {
      if (!form) return;
      if (form.requestSubmit) form.requestSubmit(); else form.submit();
    }
    if (form) {
      /* keep URLs clean: leave empty price boxes out */
      form.addEventListener('submit', function () {
        $$('[data-ma-price-input]', form).forEach(function (i) { if (i.value === '') i.disabled = true; });
      });
      $$('[data-ma-auto]', form).forEach(function (i) { i.addEventListener('change', submit); });
      $$('[data-ma-price-input]', form).forEach(function (i) { i.addEventListener('change', submit); });
    }
    var sort = $('[data-ma-sort]', root);
    if (sort) sort.addEventListener('change', submit);

    /* ---------- "Filters" button (below 900px) ---------- */
    var panel = $('[data-ma-filters]', root);
    var toggle = $('[data-ma-filters-toggle]', root);
    if (panel && toggle) {
      toggle.addEventListener('click', function () {
        var open = !panel.classList.contains('is-open');
        panel.classList.toggle('is-open', open);
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        $('[data-ma-filters-label]', toggle).textContent = open ? 'Hide filters' : 'Filters';
        if (open) panel.scrollIntoView({ block: 'start', behavior: 'smooth' });
      });
    }

    /* ---------- "Only parts that fit my car" ----------
       Turning it on adds ?fit=1. The whole collection (with the current filters and sort) is read in
       batches of 250 from sections/ma-fit-scan, which lists each product's fitment keys (from the
       description's "Compatible Vehicles" list, fitment metafields or tags). Products that fit the
       garage vehicle are shown first, then products tagged "universal". */
    var bar = $('[data-ma-fitbar]', root);
    var sw = $('[data-ma-fit-switch]', root);
    var fitOn = /[?&]fit=1(&|$)/.test(window.location.search);
    var PAGE = 24;

    function fitText(v, n) {
      if (!fitOn) return 'Shopping for your ' + MA.vKey(v) + '? Turn this on to hide parts that don\'t fit.';
      if (n == null) return 'Finding parts that fit your ' + MA.vKey(v) + '…';
      return 'Showing ' + n + (n === 1 ? ' part' : ' parts') + ' listed for your ' + MA.vKey(v) + '.';
    }
    function paintFit() {
      var v = MA.garage && MA.garage.load().vehicle;
      if (!bar) return;
      if (!v) { bar.hidden = true; return; }
      bar.hidden = false;
      bar.classList.toggle('is-on', fitOn);
      sw.setAttribute('aria-checked', fitOn ? 'true' : 'false');
      $('[data-ma-fitbar-model]', bar).textContent = v.model;
      $('[data-ma-fitbar-text]', bar).textContent = fitText(v, bar._count);
    }
    function setFitParam(on) {
      var params = new URLSearchParams(window.location.search);
      params.delete('page');
      if (on) params.set('fit', '1'); else { params.delete('fit'); params.delete('model'); }
      var qs = params.toString();
      window.location.href = window.location.pathname + (qs ? '?' + qs : '');
    }
    if (sw) sw.addEventListener('click', function () { setFitParam(!fitOn); });
    $$('[data-ma-fit-off]', root).forEach(function (b) { b.addEventListener('click', function () { setFitParam(false); }); });

    function scanUrl(page, sid) {
      var params = new URLSearchParams(window.location.search);
      params.delete('fit'); params.delete('page'); params.delete('model');
      params.set('page', page); params.set('section_id', sid || 'ma-fit-scan');
      return window.location.pathname + '?' + params.toString();
    }
    function readScan(html) {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var el = doc.querySelector('[data-ma-fit-scan]');
      return el ? JSON.parse(el.textContent) : { pages: 0, items: [] };
    }
    function scanAll(sid) {
      sid = typeof sid === 'string' ? sid : null;
      var key = 'ma-fitscan:' + scanUrl(0, sid);
      try { var c = JSON.parse(sessionStorage.getItem(key) || 'null'); if (c && Date.now() - c.t < 10 * 60 * 1000) return Promise.resolve(c.items); } catch (e) {}
      var get = function (p) { return fetch(scanUrl(p, sid)).then(function (r) { return r.text(); }).then(readScan); };
      return get(1).then(function (first) {
        var rest = [];
        for (var p = 2; p <= first.pages; p++) rest.push(get(p));
        return Promise.all(rest).then(function (pages) {
          var items = pages.reduce(function (all, pg) { return all.concat(pg.items); }, first.items);
          try { sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), items: items })); } catch (e) {}
          return items;
        });
      });
    }
    function cardFor(handle) {
      return fetch('/products/' + encodeURIComponent(handle) + '?section_id=ma-card-results')
        .then(function (r) { return r.ok ? r.text() : ''; })
        .then(function (html) { return new DOMParser().parseFromString(html, 'text/html').querySelector('[data-ma-card]'); })
        .catch(function () { return null; });
    }

    /* Shows the products from the scan that match. opts: match(item) → 0 no, 1 fits, 2 universal;
       label (for the empty message); status (while loading); done(count). */
    function runFit(opts) {
      var box = $('[data-ma-fit-results]', root);
      if (!box) return;
      document.documentElement.classList.add('ma-fitmode');
      var grid = $('[data-ma-fit-grid]', box), more = $('[data-ma-fit-more]', box), status = $('[data-ma-fit-status]', box);
      var empty = $('[data-ma-fit-empty]', box), count = $('[data-ma-count]', root);
      var v = MA.garage && MA.garage.load().vehicle;
      box.hidden = false;
      status.hidden = false;
      status.textContent = opts.status;
      if (count) count.textContent = '';
      scanAll(opts.scan).then(function (items) {
        var fits = items.filter(function (i) { return opts.match(i) === 1; });
        var uni = items.filter(function (i) { return opts.match(i) === 2; });
        var list = fits.concat(uni).map(function (i) { return i.h; });
        if (count) count.textContent = list.length + (list.length === 1 ? ' product' : ' products');
        status.hidden = true;
        if (opts.done) opts.done(list.length);
        if (!list.length) {
          $('[data-ma-fit-vehicle]', empty).textContent = opts.label;
          empty.hidden = false;
          return;
        }
        var shown = 0;
        var showNext = function () {
          var batch = list.slice(shown, shown + PAGE);
          shown += batch.length;
          more.hidden = true;
          return Promise.all(batch.map(cardFor)).then(function (cards) {
            cards.forEach(function (c) { if (c) grid.appendChild(document.importNode(c, true)); });
            if (MA.updateFitBadges) MA.updateFitBadges(v, grid);
            if (MA.paintWishlist) MA.paintWishlist(grid);
            more.hidden = shown >= list.length;
            more.textContent = 'Show more (' + (list.length - shown) + ' left)';
          });
        };
        more.addEventListener('click', showNext);
        return showNext();
      }).catch(function () {
        status.textContent = 'We couldn\'t check fitment just now. Showing all results instead.';
        document.documentElement.classList.remove('ma-fitmode');
      });
    }
    function vehicleMatch(v) {
      var tag = ',' + MA.vTag(v) + ',';
      return function (i) { return i.k && i.k.indexOf(tag) > -1 ? 1 : (i.u ? 2 : 0); };
    }

    var isSearch = root.getAttribute('data-mode') === 'search';
    var v0 = MA.garage && MA.garage.load().vehicle;

    /* make page (custom.is_car_brand collection): model chips from the products' fitment keys, ?model=<slug> */
    var modelsBox = $('[data-ma-models]', root);
    var modelSel = new URLSearchParams(window.location.search).get('model');
    function slugify(t) { return String(t).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
    function initModels() {
      var make = modelsBox.getAttribute('data-make');
      var prefixes = [slugify(make) + '-'];
      var names = {};
      var p = MA.vehicleProvider;
      /* the make's name in the vehicle list (e.g. collection "Mercedes" = "Mercedes-Benz") and its model names */
      var named = !p ? Promise.resolve() : p.makes().then(function (makes) {
        var k = slugify(make);
        var hit = makes.filter(function (m) { return slugify(m.name) === k; })[0] || makes.filter(function (m) { return slugify(m.name).indexOf(k) === 0; })[0];
        if (!hit) return;
        if (prefixes.indexOf(slugify(hit.name) + '-') < 0) prefixes.push(slugify(hit.name) + '-');
        return p.models(hit).then(function (ms) { ms.forEach(function (m) { names[slugify(m.name)] = m.name; }); });
      }).catch(function () {});
      var modelOf = function (key) {
        for (var i = 0; i < prefixes.length; i++) {
          if (key.indexOf(prefixes[i]) === 0) { var m = key.slice(prefixes[i].length).match(/^(.*)-(\d{4})$/); if (m) return m[1]; }
        }
        return null;
      };
      /* models for one scanned product: from its fitment keys, or a model name in its handle (title) */
      var modelsOf = function (i) {
        var out = {};
        (i.k || '').split(',').forEach(function (key) { var m = key && modelOf(key); if (m) out[m] = 1; });
        var h = '-' + i.h + '-';
        Object.keys(names).forEach(function (m) { if (m.length > 2 && /[a-z]/.test(m) && h.indexOf('-' + m + '-') > -1) out[m] = 1; });
        return Object.keys(out);
      };
      var nameOf = function (s) { return names[s] || s.replace(/-/g, ' ').replace(/(^| )([a-z])/g, function (x, a, b) { return a + b.toUpperCase(); }); };
      named.then(function () { return scanAll('ma-model-scan'); }).then(function (items) {
        var counts = {};
        items.forEach(function (i) { modelsOf(i).forEach(function (m) { counts[m] = (counts[m] || 0) + 1; }); });
        Object.keys(counts).sort(function (a, b) { return nameOf(a).localeCompare(nameOf(b)); }).forEach(function (m) {
          var a = document.createElement('a');
          var q = new URLSearchParams(window.location.search); q.delete('page'); q.delete('fit'); q.set('model', m);
          a.className = 'ma-chip' + (m === modelSel ? ' is-on' : '');
          a.href = window.location.pathname + '?' + q.toString();
          a.textContent = nameOf(m);
          a.setAttribute('aria-label', nameOf(m) + ', ' + counts[m] + (counts[m] === 1 ? ' part' : ' parts'));
          if (m === modelSel) a.setAttribute('aria-current', 'page');
          modelsBox.appendChild(a);
        });
        var all = $('[data-ma-model-all]', modelsBox);
        if (modelSel && all) { all.classList.remove('is-on'); all.removeAttribute('aria-current'); }
        var tagged = items.filter(function (i) { return modelsOf(i).length > 0; }).length;
        var blurb = $('[data-ma-make-blurb]', root);
        if (blurb && !modelSel) blurb.textContent = tagged
          ? 'Parts for ' + make + ' models. Pick a model to narrow it down.'
          : 'Every part we carry for ' + make + ' vehicles. Add your model and year in My garage, or send us your rego and we\'ll find the part.';
        if (modelSel && !fitOn) {
          var label = make + ' ' + nameOf(modelSel);
          var who = $('[data-ma-fit-who]', root); if (who) who.textContent = '';
          runFit({
            match: function (i) { return modelsOf(i).indexOf(modelSel) > -1 ? 1 : 0; },
            label: label, scan: 'ma-model-scan',
            status: 'Finding parts listed for the ' + label + '…',
            done: function () { if (blurb) blurb.textContent = 'Parts for the ' + label + '. Add your year in My garage to check the exact fit.'; }
          });
        }
      }).catch(function () { document.documentElement.classList.remove('ma-fitmode'); });
      /* the note hides once a vehicle is saved (the fit switch takes over) */
      var note = $('[data-ma-makenote]', root);
      var paintNote = function () { if (note) note.hidden = !!(MA.garage && MA.garage.load().vehicle); };
      paintNote(); document.addEventListener('ma:garage', paintNote);
    }

    if (!isSearch && modelsBox) initModels();
    else if (modelSel && !fitOn) document.documentElement.classList.remove('ma-fitmode');

    if (!isSearch) {
      /* collection: the switch */
      paintFit();
      if (fitOn && v0) {
        runFit({
          match: vehicleMatch(v0), label: MA.vKey(v0),
          status: 'Checking every part in this category against your ' + MA.vKey(v0) + '…',
          done: function (n) { bar._count = n; paintFit(); }
        });
      } else if (fitOn) {
        document.documentElement.classList.remove('ma-fitmode');
      }
      document.addEventListener('ma:garage', function () {
        if (bar) bar._count = null;
        if (fitOn) setFitParam(true); else paintFit();
      });
    } else {
      initSearch();
      document.addEventListener('ma:garage', function () {
        if (fitOn) { var g = MA.garage.load().vehicle; if (g && MA.fitUrl) window.location.href = MA.fitUrl(g); else setFitParam(false); }
        else paintVehicleRow();
      });
    }

    /* ---------- search page modes ---------- */
    function initSearch() {
      var q = root.getAttribute('data-q') || '';
      var title = $('[data-ma-search-title]', root), sub = $('[data-ma-search-sub]', root);
      var change = $('[data-ma-search-change]', root), chip = $('[data-ma-mode-chip]', root);
      var plural = function (n, one, many) { return n + ' ' + (n === 1 ? one : many); };

      /* "Show all products" from a search with no results: ?was=<what they typed> */
      var was = new URLSearchParams(window.location.search).get('was');
      var wasBox = $('[data-ma-was]', root);
      if (was && wasBox) {
        $('[data-ma-was-q]', wasBox).textContent = was;
        wasBox.hidden = false;
        $$('[data-ma-tag-link], [data-ma-keep-was], .ma-pager a', root).forEach(function (a) {
          var u = new URL(a.href, window.location.origin); u.searchParams.set('was', was); a.href = u.pathname + u.search;
        });
        if (form && !$('input[name="was"]', form)) {
          var w = document.createElement('input'); w.type = 'hidden'; w.name = 'was'; w.value = was; form.appendChild(w);
        }
      }

      /* exact part match: load more parts of the same type */
      var more = $('[data-ma-more-type]', root);
      if (more) {
        var load = function () {
          var grid = $('[data-ma-more-grid]', more), skip = more.getAttribute('data-exclude');
          fetch(more.getAttribute('data-url')).then(function (r) { return r.text(); }).then(function (html) {
            var doc = new DOMParser().parseFromString(html, 'text/html');
            var cards = $$('[data-ma-card]', doc).filter(function (c) {
              var a = c.querySelector('a[href*="/products/"]');
              return !(a && skip && a.getAttribute('href').split('?')[0].split('/products/')[1] === skip);
            }).slice(0, 6);
            if (!cards.length) { more.hidden = true; return; }
            cards.forEach(function (c) { grid.appendChild(document.importNode(c, true)); });
            grid.removeAttribute('aria-busy');
            if (MA.updateFitBadges) MA.updateFitBadges(v0, grid);
            if (MA.paintWishlist) MA.paintWishlist(grid);
          }).catch(function () { more.hidden = true; });
        };
        if (MA.whenNear) MA.whenNear(more, load); else load();
      }

      /* keep vehicle mode when filters or sort change */
      if (fitOn && form && !$('input[name="fit"]', form)) {
        var hid = document.createElement('input'); hid.type = 'hidden'; hid.name = 'fit'; hid.value = '1'; form.appendChild(hid);
      }

      /* no query: with a garage vehicle, open vehicle mode */
      if (!q) {
        if (v0 && MA.fitUrl) { window.location.replace(MA.fitUrl(v0)); return; }
        paintVehicleRow();
        return;
      }

      if (fitOn && v0) {
        /* vehicle mode */
        title.textContent = 'Parts for your ' + MA.vKey(v0);
        sub.textContent = 'Finding parts listed for this vehicle…';
        if (change) change.hidden = false;
        if (chip) {
          chip.classList.add('ma-fchip--fit');
          chip.firstChild.nodeValue = 'Fits ' + MA.vKey(v0) + ' ';
          var p = new URLSearchParams(window.location.search); p.delete('fit'); p.delete('page');
          chip.href = window.location.pathname + '?' + p.toString();
          chip.setAttribute('aria-label', 'Show all search results instead');
        }
        runFit({
          match: vehicleMatch(v0), label: MA.vKey(v0),
          status: 'Checking parts against your ' + MA.vKey(v0) + '…',
          done: function (n) {
            sub.textContent = plural(n, 'part is', 'parts are') + ' listed for this vehicle.';
            paintVehicleRow(n);
          }
        });
        return;
      }
      if (fitOn) document.documentElement.classList.remove('ma-fitmode');

      /* text mode: mention fit badges */
      if (v0 && sub) sub.textContent += ' Parts that fit your ' + v0.model + ' are marked.';

      /* make mode: the query is a make from the vehicle list, e.g. "Toyota" */
      var provider = MA.vehicleProvider;
      if (!provider || q.split(/\s+/).length > 3) { paintVehicleRow(); return; }
      provider.makes().then(function (makes) {
        var make = makes.filter(function (m) { return String(m.name).toLowerCase() === q.toLowerCase(); })[0];
        if (!make) { paintVehicleRow(); return; }
        var prefix = ',' + String(make.name).toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-';
        title.textContent = 'Parts for ' + make.name + ' vehicles';
        sub.textContent = 'Finding parts listed for ' + make.name + ' models…';
        if (change) change.hidden = false;
        if (chip) chip.firstChild.nodeValue = 'Make: ' + make.name + ' ';
        runFit({
          match: function (i) { return i.k && i.k.indexOf(prefix) > -1 ? 1 : 0; },
          label: make.name,
          status: 'Checking parts listed for ' + make.name + ' models…',
          done: function (n) {
            sub.textContent = plural(n, 'part is', 'parts are') + ' listed for ' + make.name + ' models. Add your exact vehicle to narrow it down.';
            paintVehicleRow();
          }
        });
      }).catch(function () { paintVehicleRow(); });
    }

    /* phone: "Your vehicle" row */
    function paintVehicleRow(fitCount) {
      var row = $('[data-ma-vrow]', root);
      if (!row) return;
      var v = MA.garage && MA.garage.load().vehicle;
      row.classList.toggle('has-vehicle', !!v);
      $('[data-ma-vrow-label]', row).textContent = v ? MA.vKey(v) : 'No vehicle selected';
      $('[data-ma-vrow-btn]', row).textContent = v ? 'Change' : 'Add vehicle';
      var n = fitCount;
      if (n == null && v) n = $$('[data-ma-page-results] .ma-pc__fit.is-fit', root).length;
      $('[data-ma-vrow-kicker]', row).textContent = !v ? 'Add your car to see what fits'
        : (n ? n + (n === 1 ? ' part here fits' : ' parts here fit') + ' your car' : 'Shopping for');
    }
  }

  function boot() { $$('[data-ma-listing]').forEach(init); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  document.addEventListener('shopify:section:load', boot);
})();
