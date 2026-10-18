/* Metro Auto theme behaviour.
   Rebuilds the logic from the design's renderVals() blocks:
   My garage, fit badges, predictive search, AJAX add to cart, quantity steppers,
   wishlist hearts, copy-code buttons, first-order pop-up, home vehicle finder,
   "Parts for your vehicle" and the home sidebar filters. */
(function () {
  'use strict';

  var MA = (window.MA = window.MA || {});
  var routes = MA.routes || {};

  /* ---------- storage ---------- */
  var store = {
    get: function (k, d) {
      try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; }
    },
    set: function (k, v) {
      try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
    }
  };
  MA.store = store;

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function emit(name, detail) { document.dispatchEvent(new CustomEvent(name, { detail: detail })); }

  /* ---------- garage ---------- */
  function vKey(v) { return v ? v.year + ' ' + v.make + ' ' + v.model : ''; }
  function vTag(v) {
    return v ? (v.make + '-' + v.model + '-' + v.year).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : '';
  }
  var fitCfg = MA.fitment || {};

  /* Where "Show parts that fit" goes. Same modes as the original ma-fitment-core snippet. */
  function fitUrl(v) {
    var base = routes.allCollection || '/collections/all';
    if (!v) return base;
    if (fitCfg.linkMode === 'tag') return base + '/' + vTag(v);
    /* Search finds candidates (it reads descriptions); the search page's vehicle mode (fit=1) keeps only
       parts whose fitment keys list this vehicle. */
    var terms = [v.make, v.model, v.year].join(' ').replace(/\s+/g, ' ').trim();
    return (routes.search || '/search') + '?q=' + encodeURIComponent(terms) + '&type=product&options%5Bprefix%5D=last&fit=1';
  }

  function cleanVehicle(v) {
    return v && v.make && v.model && v.year
      ? { make: v.make, model: v.model, year: String(v.year), makeId: v.makeId, modelId: v.modelId }
      : null;
  }

  var garage = {
    load: function () {
      var g = store.get('ma-garage', null);
      if (!g) {
        /* Migrate vehicles saved by the old fitment bar (ma_garage_v1: {current, recent}). */
        var old = store.get('ma_garage_v1', null);
        if (old && (old.current || (old.recent && old.recent.length))) {
          g = { vehicle: cleanVehicle(old.current), garage: (old.recent || []).map(cleanVehicle).filter(Boolean) };
          store.set('ma-garage', g);
        }
      }
      if (!g || !Array.isArray(g.garage)) g = { vehicle: null, garage: [] };
      return g;
    },
    save: function (g) {
      store.set('ma-garage', g);
      document.documentElement.classList.toggle('ma-has-vehicle', !!g.vehicle);
      emit('ma:garage', g);
    },
    select: function (v) {
      v = cleanVehicle(v);
      var g = garage.load();
      if (v && !g.garage.some(function (x) { return vKey(x) === vKey(v); })) g.garage.unshift(v);
      g.vehicle = v || null;
      garage.save(g);
    },
    remove: function (v) {
      var g = garage.load();
      g.garage = g.garage.filter(function (x) { return vKey(x) !== vKey(v); });
      if (g.vehicle && vKey(g.vehicle) === vKey(v)) g.vehicle = null;
      garage.save(g);
    }
  };
  MA.garage = garage;
  MA.vKey = vKey;
  MA.vTag = vTag;
  MA.fitUrl = fitUrl;

  /* ---------- vehicle data providers: each level resolves to [{id, name}] ---------- */
  var cache = {};
  function cached(key, fn) { if (!cache[key]) cache[key] = fn().catch(function (e) { delete cache[key]; throw e; }); return cache[key]; }

  var supabaseProvider = {
    rpc: function (fn, body) {
      return fetch(fitCfg.sbUrl + '/rpc/' + fn, {
        method: 'POST',
        headers: { apikey: fitCfg.sbKey, Authorization: 'Bearer ' + fitCfg.sbKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {})
      }).then(function (r) { if (!r.ok) throw new Error('fitment ' + r.status); return r.json(); });
    },
    makes: function () { return cached('mk', function () { return supabaseProvider.rpc('fitment_makes'); }); },
    models: function (make) {
      return cached('md' + make.id, function () { return supabaseProvider.rpc('fitment_models', { p_make_id: Number(make.id) }); });
    },
    years: function (make, model) {
      return cached('yr' + model.id, function () {
        return supabaseProvider.rpc('fitment_years', { p_model_id: Number(model.id) })
          .then(function (rows) { return rows.map(function (r) { return { id: r.year, name: String(r.year) }; }); });
      });
    }
  };

  var jsonProvider = {
    data: function () {
      return cached('json', function () {
        return fetch(fitCfg.jsonUrl, { credentials: 'omit' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
      });
    },
    named: function (list) { return list.map(function (n) { return { id: n, name: n }; }); },
    makes: function () { return jsonProvider.data().then(function (d) { return jsonProvider.named(Object.keys(d)); }); },
    models: function (make) { return jsonProvider.data().then(function (d) { return jsonProvider.named(Object.keys(d[make.name] || {})); }); },
    years: function (make, model) {
      return jsonProvider.data().then(function (d) {
        var r = (d[make.name] || {})[model.name], out = [];
        if (r) for (var y = r[1]; y >= r[0]; y--) out.push(String(y));
        return jsonProvider.named(out);
      });
    }
  };

  var provider = fitCfg.source === 'json' || !fitCfg.sbUrl ? jsonProvider : supabaseProvider;
  MA.vehicleProvider = provider;

  function fillSelect(sel, items, placeholder) {
    sel.innerHTML = '';
    var o = document.createElement('option');
    o.value = ''; o.textContent = placeholder;
    sel.appendChild(o);
    items.forEach(function (it) {
      var opt = document.createElement('option');
      opt.value = it.id; opt.textContent = it.name;
      sel.appendChild(opt);
    });
  }

  /* A make/model/year trio. root contains selects [data-ma-v=make|model|year]. */
  function VehicleSelect(root, onChange) {
    var make = $('[data-ma-v="make"]', root);
    var model = $('[data-ma-v="model"]', root);
    var year = $('[data-ma-v="year"]', root);
    var ph = {
      make: make.options[0] ? make.options[0].textContent : 'Select',
      model: model.options[0] ? model.options[0].textContent : 'Select',
      year: year.options[0] ? year.options[0].textContent : 'Select'
    };

    function picked(sel) {
      var o = sel.options[sel.selectedIndex];
      return o && o.value ? { id: o.value, name: o.textContent } : null;
    }
    function selectByName(sel, name) {
      var want = String(name || '').toLowerCase();
      for (var i = 0; i < sel.options.length; i++) {
        if (sel.options[i].value && sel.options[i].textContent.toLowerCase() === want) { sel.selectedIndex = i; return true; }
      }
      return false;
    }
    function clear(sel, label) { fillSelect(sel, [], label); sel.disabled = true; }
    function load(sel, promise, label) {
      sel.disabled = true;
      return promise.then(function (list) {
        fillSelect(sel, list, label);
        sel.disabled = list.length === 0;
      }).catch(function () {
        fillSelect(sel, [], 'Unavailable');
      });
    }
    function changed() { if (onChange) onChange(api.value()); }

    function loadModels() {
      clear(model, ph.model); clear(year, ph.year);
      var mk = picked(make);
      return mk ? load(model, provider.models(mk), ph.model) : Promise.resolve();
    }
    function loadYears() {
      clear(year, ph.year);
      var mk = picked(make), md = picked(model);
      return mk && md ? load(year, provider.years(mk, md), ph.year) : Promise.resolve();
    }

    var api = {
      value: function () {
        var mk = picked(make), md = picked(model), yr = picked(year);
        return mk && md && yr ? { make: mk.name, model: md.name, year: yr.name, makeId: mk.id, modelId: md.id } : null;
      },
      set: function (v) {
        return api.ready.then(function () {
          if (!v || !selectByName(make, v.make)) { make.selectedIndex = 0; return loadModels().then(changed); }
          return loadModels()
            .then(function () { return selectByName(model, v.model) ? loadYears() : null; })
            .then(function () { selectByName(year, v.year); changed(); });
        });
      },
      reset: function () { make.selectedIndex = 0; clear(model, ph.model); clear(year, ph.year); changed(); }
    };

    make.addEventListener('change', function () { changed(); loadModels().then(changed); });
    model.addEventListener('change', function () { changed(); loadYears().then(changed); });
    year.addEventListener('change', changed);
    api.ready = load(make, provider.makes(), ph.make).then(function () { changed(); return api; });
    return api;
  }
  MA.VehicleSelect = VehicleSelect;

  /* ---------- modals ---------- */
  /* Garage pop-up, coupon pop-up and the mobile menu all use [data-ma-modal="name"]. */
  var OPEN = '[data-ma-modal]:not([hidden])';
  var lastFocus = null;
  function setExpanded(name, on) {
    $$('[data-ma-open="' + name + '"][aria-expanded]').forEach(function (b) { b.setAttribute('aria-expanded', on ? 'true' : 'false'); });
  }
  function openModal(name) {
    var m = $('[data-ma-modal="' + name + '"]');
    if (!m) return;
    $$(OPEN).forEach(function (o) { if (o !== m) { o.hidden = true; setExpanded(o.getAttribute('data-ma-modal'), false); } });
    lastFocus = document.activeElement;
    m.hidden = false;
    setExpanded(name, true);
    document.documentElement.style.overflow = 'hidden';
    var f = $('select:not([disabled]), button:not([tabindex="-1"]), a[href], input', $('[role="dialog"]', m));
    if (f) f.focus();
  }
  function closeModal(m) {
    if (!m || m.hidden) return;
    m.hidden = true;
    setExpanded(m.getAttribute('data-ma-modal'), false);
    if (!$(OPEN)) document.documentElement.style.overflow = '';
    if (lastFocus && lastFocus.focus && document.body.contains(lastFocus) && lastFocus.offsetParent !== null) lastFocus.focus();
  }
  MA.openModal = openModal;

  document.addEventListener('click', function (e) {
    var opener = e.target.closest('[data-ma-open]');
    if (opener) { e.preventDefault(); openModal(opener.getAttribute('data-ma-open')); return; }
    var closer = e.target.closest('[data-ma-close]');
    if (closer) { closeModal(closer.closest('[data-ma-modal]')); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') $$(OPEN).forEach(closeModal);
  });
  /* Menu only exists on phones; close it if the window grows past the header breakpoint. */
  if (window.matchMedia) {
    var wide = window.matchMedia('(min-width: 1024px)');
    var onWide = function () { if (wide.matches) closeModal($('[data-ma-modal="menu"]')); };
    if (wide.addEventListener) wide.addEventListener('change', onWide); else if (wide.addListener) wide.addListener(onWide);
  }

  /* ---------- header garage UI ---------- */
  function renderGarage() {
    var g = garage.load();
    var active = vKey(g.vehicle);

    $$('[data-ma-vehicle-label]').forEach(function (el) { el.textContent = active; });
    $$('[data-ma-garage-btn-value]').forEach(function (el) { el.textContent = active || 'Add your vehicle'; });
    $$('[data-ma-garage-btn]').forEach(function (el) { el.setAttribute('aria-label', 'My garage: ' + (active || 'Add your vehicle')); });
    $$('[data-ma-fits-link]').forEach(function (el) { el.href = fitUrl(g.vehicle); });

    var list = $('[data-ma-garage-list]');
    var empty = $('[data-ma-garage-empty]');
    if (list) {
      list.innerHTML = '';
      g.garage.forEach(function (v) {
        var on = vKey(v) === active;
        var li = document.createElement('li');
        li.className = 'ma-garage-item' + (on ? ' is-active' : '');
        li.innerHTML =
          '<a class="ma-garage-item__pick" href="' + fitUrl(v) + '">' +
            '<span class="ma-garage-item__ring"><span class="ma-garage-item__dot"></span></span>' +
            '<span class="ma-garage-item__label"></span>' +
            '<span class="ma-garage-item__note">' + (on ? 'Shopping for this' : 'Show parts') + '</span>' +
          '</a>' +
          '<button type="button" class="ma-garage-item__remove"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"></path></svg></button>';
        $('.ma-garage-item__label', li).textContent = vKey(v);
        var rm = $('.ma-garage-item__remove', li);
        rm.setAttribute('aria-label', 'Remove ' + vKey(v));
        $('.ma-garage-item__pick', li).addEventListener('click', function () { garage.select(v); });
        rm.addEventListener('click', function () { garage.remove(v); });
        list.appendChild(li);
      });
      list.hidden = g.garage.length === 0;
    }
    if (empty) empty.hidden = g.garage.length > 0;

    updateFitBadges(g.vehicle);
  }

  function initGarageModal() {
    var root = $('[data-ma-modal="garage"] [data-ma-vselect]');
    if (!root) return;
    var save = $('[data-ma-garage-save]', root);
    var vs = VehicleSelect(root, function (v) {
      save.disabled = !v;
      save.textContent = v ? save.getAttribute('data-label-ready') : save.getAttribute('data-label-wait');
    });
    save.addEventListener('click', function () {
      var v = vs.value();
      if (!v) return;
      garage.select(v);
      vs.reset();
      window.location.href = fitUrl(v);
    });
    $$('[data-ma-clear-vehicle]').forEach(function (b) {
      b.addEventListener('click', function () { garage.select(null); });
    });
  }

  /* ---------- fit badges on product cards ---------- */
  function updateFitBadges(v, scope) {
    var tag = vTag(v);
    $$('[data-ma-card]', scope).forEach(function (card) {
      var badge = $('[data-ma-fit-badge]', card);
      if (!badge) return;
      var tags = (card.getAttribute('data-ma-fit') || '').split(',');
      var fits = !!(v && tags.indexOf(tag) > -1);
      var text = fits ? 'Fits your ' + v.model : (card.hasAttribute('data-ma-universal') ? 'Suits any vehicle' : '');
      badge.hidden = !text;
      badge.classList.toggle('is-fit', fits);
      $('[data-ma-fit-text]', badge).textContent = text;
    });
  }
  MA.updateFitBadges = updateFitBadges;

  /* ---------- predictive search ---------- */
  function initSearch() {
    $$('[data-ma-search]').forEach(function (wrap) {
      var input = $('[data-ma-search-input]', wrap);
      var panel = $('[data-ma-search-panel]', wrap);
      var timer = null, ctrl = null;

      function hide() { panel.hidden = true; input.setAttribute('aria-expanded', 'false'); }
      function run() {
        var q = input.value.trim();
        if (q.length < 2) { hide(); return; }
        if (ctrl) ctrl.abort();
        ctrl = 'AbortController' in window ? new AbortController() : null;
        var url = (routes.predictive || '/search/suggest') +
          '?q=' + encodeURIComponent(q) +
          '&resources[type]=product&resources[limit]=4&resources[options][unavailable_products]=last&resources[options][fields]=title,product_type,variants.sku,vendor,tag' +
          '&section_id=ma-predictive-search';
        fetch(url, ctrl ? { signal: ctrl.signal } : {})
          .then(function (r) { return r.text(); })
          .then(function (html) {
            var doc = new DOMParser().parseFromString(html, 'text/html');
            var sec = doc.querySelector('.shopify-section') || doc.body;
            panel.innerHTML = sec.innerHTML;
            panel.hidden = false;
            input.setAttribute('aria-expanded', 'true');
          })
          .catch(function () {});
      }
      input.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(run, 200); });
      input.addEventListener('focus', function () { if (panel.innerHTML.trim() && input.value.trim().length >= 2) { panel.hidden = false; } });
      input.addEventListener('keydown', function (e) {
        var items = $$('a', panel);
        if (panel.hidden || !items.length) return;
        var i = items.indexOf(document.activeElement);
        if (e.key === 'ArrowDown') { e.preventDefault(); items[Math.min(items.length - 1, i + 1)].focus(); }
      });
      panel.addEventListener('keydown', function (e) {
        var items = $$('a', panel);
        var i = items.indexOf(document.activeElement);
        if (e.key === 'ArrowDown') { e.preventDefault(); if (items[i + 1]) items[i + 1].focus(); }
        if (e.key === 'ArrowUp') { e.preventDefault(); (i <= 0 ? input : items[i - 1]).focus(); }
        if (e.key === 'Escape') { hide(); input.focus(); }
      });
      document.addEventListener('click', function (e) { if (!wrap.contains(e.target)) hide(); });
    });
  }

  /* ---------- cart ---------- */
  function setCartCount(n) {
    $$('[data-ma-cart-count]').forEach(function (el) { el.textContent = n; });
    $$('[data-ma-cart-link]').forEach(function (el) { el.setAttribute('aria-label', 'Cart, ' + n + ' items'); });
  }
  function refreshCart() {
    return fetch(routes.cart || '/cart.js', { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (c) { setCartCount(c.item_count); emit('ma:cart', c); return c; });
  }
  MA.addToCart = function (variantId, qty) {
    return fetch(routes.cartAdd || '/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ items: [{ id: Number(variantId), quantity: qty }] })
    }).then(function (r) {
      return r.json().then(function (body) {
        if (!r.ok) throw body;
        return refreshCart().then(function () { return body; });
      });
    });
  };
  MA.refreshCart = refreshCart;

  /* ---------- product cards: qty stepper, add to cart, wishlist ---------- */
  function cardMax(card) { return parseInt(card.getAttribute('data-max'), 10) || 99; }
  function setQty(card, n) {
    var input = $('[data-ma-qty-input]', card);
    var q = Math.max(1, Math.min(cardMax(card), isNaN(n) ? 1 : n));
    input.value = q;
    resetAtc(card);
    return q;
  }
  function resetAtc(card) {
    var btn = $('[data-ma-atc]', card);
    if (!btn || card.classList.contains('ma-pc--out')) return;
    btn.disabled = false;
    $('[data-ma-atc-label]', btn).textContent = 'Add to cart';
  }

  document.addEventListener('click', function (e) {
    var step = e.target.closest('[data-ma-qty]');
    if (step) {
      var card = step.closest('[data-ma-card], [data-ma-qty-scope]');
      var input = $('[data-ma-qty-input]', card);
      setQty(card, parseInt(input.value, 10) + parseInt(step.getAttribute('data-ma-qty'), 10));
      return;
    }

    var atc = e.target.closest('[data-ma-atc]');
    if (atc) {
      var c = atc.closest('[data-ma-card]');
      if (!c || atc.disabled) return;
      var qty = setQty(c, parseInt($('[data-ma-qty-input]', c).value, 10));
      var label = $('[data-ma-atc-label]', atc);
      atc.disabled = true;
      label.textContent = 'Adding…';
      MA.addToCart(c.getAttribute('data-variant-id'), qty)
        .then(function () { label.textContent = 'Added ' + qty; })
        .catch(function (err) {
          label.textContent = (err && err.description) ? 'Not enough stock' : "Couldn't add";
          setTimeout(function () { resetAtc(c); }, 2500);
        });
      return;
    }

    var wish = e.target.closest('[data-ma-wish]');
    if (wish) {
      e.preventDefault();
      /* On old-layout pages assets/wishlist.js also handles [button-wishlist] (and removes cards on the
         wishlist page), so only repaint there; elsewhere toggle the same storage it uses. */
      if (!hasWishlistJs()) {
        var handle = wish.getAttribute('data-ma-wish');
        var list = readWishlist();
        var i = list.indexOf(handle);
        if (i > -1) list.splice(i, 1); else list.push(handle);
        writeWishlist(list);
      }
      setTimeout(function () { paintWishlist(); emit('ma:wishlist', { handle: wish.getAttribute('data-ma-wish'), list: readWishlist() }); }, 0);
    }
  });
  document.addEventListener('change', function (e) {
    if (e.target.matches('[data-ma-qty-input]')) {
      var card = e.target.closest('[data-ma-card], [data-ma-qty-scope]');
      setQty(card, parseInt(String(e.target.value).replace(/\D/g, ''), 10));
    }
  });

  /* Wishlist: same storage as assets/wishlist.js and the wishlist page ("shopify-wishlist", comma-separated handles). */
  var WISH_KEY = 'shopify-wishlist';
  var HANDLE_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i;
  function readWishlist() {
    var raw = '';
    try { raw = localStorage.getItem(WISH_KEY) || ''; } catch (e) {}
    return raw.split(',').map(function (h) { return h.trim(); }).filter(function (h, i, a) { return HANDLE_RE.test(h) && a.indexOf(h) === i; });
  }
  function writeWishlist(list) {
    try {
      if (list.length) localStorage.setItem(WISH_KEY, list.slice(0, 100).join(','));
      else localStorage.removeItem(WISH_KEY);
    } catch (e) {}
  }
  function hasWishlistJs() { return !!document.querySelector('script[src*="/wishlist.js"]'); }
  /* Earlier builds of this theme saved hearts under "ma-wishlist"; fold them in once. */
  (function migrateWishlist() {
    var old = store.get('ma-wishlist', null);
    if (!Array.isArray(old)) return;
    var list = readWishlist();
    old.forEach(function (h) { if (HANDLE_RE.test(h) && list.indexOf(h) < 0) list.push(h); });
    writeWishlist(list);
    try { localStorage.removeItem('ma-wishlist'); } catch (e) {}
  })();

  function paintWishlist(scope) {
    var list = readWishlist();
    $$('[data-ma-wish]', scope).forEach(function (b) {
      var on = list.indexOf(b.getAttribute('data-ma-wish')) > -1;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.setAttribute('aria-label', on ? 'Remove from wishlist' : 'Save to wishlist');
    });
  }
  MA.paintWishlist = paintWishlist;
  MA.readWishlist = readWishlist;
  MA.writeWishlist = writeWishlist;

  /* ---------- copy-code buttons ---------- */
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-ma-copy]');
    if (!b) return;
    var code = b.getAttribute('data-ma-copy');
    var label = b.getAttribute('data-label') || b.textContent;
    b.setAttribute('data-label', label);
    try { navigator.clipboard.writeText(code); } catch (err) {}
    b.textContent = b.getAttribute('data-copied-label') || 'Copied';
    clearTimeout(b._t);
    b._t = setTimeout(function () { b.textContent = label; }, 2500);
  });

  /* ---------- first-order pop-up: once per visitor ---------- */
  function initCoupon() {
    var m = $('[data-ma-modal="coupon"]');
    if (!m) return;
    var preview = m.hasAttribute('data-ma-coupon-preview');
    if (!preview && store.get('ma-welcome-seen', false)) return;
    var delay = parseInt(m.getAttribute('data-ma-coupon-auto'), 10) || 0;
    setTimeout(function () {
      if ($(OPEN)) return;
      if (!preview) store.set('ma-welcome-seen', true);
      openModal('coupon');
    }, delay);
  }

  /* ---------- home: vehicle finder band ---------- */
  function initFinders() {
    $$('[data-ma-finder]').forEach(function (root) {
      if (root._maInit) return; root._maInit = true;
      var vehicleMode = $('[data-ma-finder-mode="vehicle"]', root);
      var partMode = $('[data-ma-finder-mode="part"]', root);
      var toggle = $('[data-ma-finder-toggle]', root);
      var go = $('[data-ma-finder-go]', root);
      var vs = VehicleSelect(vehicleMode, function (v) { go.setAttribute('aria-disabled', v ? 'false' : 'true'); });
      vs.ready.then(function () { var g = garage.load(); if (g.vehicle) vs.set(g.vehicle); });

      go.addEventListener('click', function (e) {
        e.preventDefault();
        var v = vs.value();
        if (!v) { var first = $('select:not([disabled])', vehicleMode); var empty = $$('select', vehicleMode).filter(function (s) { return !s.value && !s.disabled; })[0]; (empty || first).focus(); return; }
        garage.select(v);
        window.location.href = fitUrl(v);
      });

      toggle.addEventListener('click', function () {
        var toPart = !vehicleMode.hidden;
        vehicleMode.hidden = toPart;
        partMode.hidden = !toPart;
        toggle.textContent = toPart ? toggle.getAttribute('data-label-vehicle') : toggle.getAttribute('data-label-part');
        var f = $(toPart ? 'input' : 'select', toPart ? partMode : vehicleMode);
        if (f) f.focus();
      });

      var links = $('[data-ma-finder-garage]', root);
      function paint() {
        var g = garage.load();
        links.innerHTML = '';
        g.garage.forEach(function (v) {
          var a = document.createElement('a');
          a.className = 'ma-finder__garage-link';
          a.href = fitUrl(v);
          a.textContent = vKey(v);
          a.addEventListener('click', function () { garage.select(v); });
          links.appendChild(a);
        });
        $('[data-ma-finder-garage-wrap]', root).hidden = g.garage.length === 0;
      }
      paint();
      document.addEventListener('ma:garage', paint);
    });
  }

  /* ---------- lazy start: run fn once el is within ~600px of the screen ----------
     (zero-height or empty wrappers still report when they come near, so hidden sections can be watched
     through their parent) */
  function whenNear(el, fn) {
    if (!el || !('IntersectionObserver' in window)) { fn(); return; }
    var io = new IntersectionObserver(function (entries) {
      if (entries.some(function (e) { return e.isIntersecting; })) { io.disconnect(); fn(); }
    }, { rootMargin: '600px 0px' });
    io.observe(el);
  }
  MA.whenNear = whenNear;

  /* ---------- home: parts for your vehicle ---------- */
  function fetchCards(url, sectionId) {
    var sep = url.indexOf('?') > -1 ? '&' : '?';
    return fetch(url + sep + 'section_id=' + sectionId)
      .then(function (r) { return r.ok ? r.text() : ''; })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        return $$('[data-ma-card]', doc);
      })
      .catch(function () { return []; });
  }
  function initFitSections() {
    $$('[data-ma-fit-section]').forEach(function (sec) {
      if (sec._maInit) return; sec._maInit = true;
      var grid = $('[data-ma-fit-grid]', sec);
      var limit = parseInt(sec.getAttribute('data-limit'), 10) || 4;
      var uniTag = sec.getAttribute('data-universal-tag') || 'universal';
      var base = routes.allCollection || '/collections/all';
      var seq = 0;
      function load() {
        var v = garage.load().vehicle;
        $$('[data-ma-fit-vehicle]', sec).forEach(function (el) { el.textContent = vKey(v); });
        $$('[data-ma-fit-all]', sec).forEach(function (el) { el.href = fitUrl(v); });
        if (!v) return;
        var mine = ++seq;
        /* Same strict check as the search page's vehicle mode: search finds candidates, then only
           products whose fitment keys list this vehicle are kept (sections/ma-fit-scan). */
        var tag = ',' + vTag(v) + ',';
        var scan = fetch(fitUrl(v).replace('&fit=1', '') + '&section_id=ma-fit-scan')
          .then(function (r) { return r.ok ? r.text() : ''; })
          .then(function (html) {
            var el = new DOMParser().parseFromString(html, 'text/html').querySelector('[data-ma-fit-scan]');
            var items = el ? JSON.parse(el.textContent).items : [];
            var handles = items.filter(function (i) { return i.k && i.k.indexOf(tag) > -1; }).slice(0, limit).map(function (i) { return i.h; });
            return Promise.all(handles.map(function (h) {
              return fetchCards('/products/' + encodeURIComponent(h), 'ma-card-results').then(function (c) { return c[0]; });
            }));
          })
          .then(function (cards) { return cards.filter(Boolean); })
          .catch(function () { return []; });
        Promise.all([scan, fetchCards(base + '/' + uniTag, 'ma-card-results')])
          .then(function (res) {
            if (mine !== seq) return;
            var seen = {}, cards = [];
            res[0].concat(res[1]).forEach(function (c) {
              var id = c.getAttribute('data-product-id');
              if (!seen[id] && cards.length < limit) { seen[id] = 1; cards.push(c); }
            });
            grid.innerHTML = '';
            cards.forEach(function (c) { grid.appendChild(document.importNode(c, true)); });
            if (cards.length) sec.removeAttribute('data-empty'); else sec.setAttribute('data-empty', '');
            updateFitBadges(v, grid);
            paintWishlist(grid);
          });
      }
      /* Only fetch once the shopper scrolls near it (the section itself is hidden until filled, so watch its wrapper). */
      var started = false;
      whenNear(sec.parentNode, function () { started = true; load(); });
      document.addEventListener('ma:garage', function () { if (started) load(); });
    });
  }

  /* ---------- home sidebar: price slider + brands ---------- */
  function initSidebars() {
    $$('[data-ma-sidebar]').forEach(function (side) {
      if (side._maInit) return; side._maInit = true;
      var range = $('[data-ma-price]', side);
      var out = $('[data-ma-price-label]', side);
      var max = range ? parseInt(range.max, 10) : 0;
      function label() { var v = parseInt(range.value, 10); out.textContent = v >= max ? 'Any price' : 'Up to $' + v; }
      if (range) { range.addEventListener('input', label); label(); }

      var checks = $$('[data-ma-brand]', side);
      var clear = $('[data-ma-brand-clear]', side);
      function paintClear() { if (clear) clear.hidden = !checks.some(function (c) { return c.checked; }); }
      checks.forEach(function (c) { c.addEventListener('change', paintClear); });
      if (clear) clear.addEventListener('click', function () { checks.forEach(function (c) { c.checked = false; }); paintClear(); });
      paintClear();

      var apply = $('[data-ma-apply]', side);
      if (apply) apply.addEventListener('click', function (e) {
        e.preventDefault();
        /* Shopify Search & Discovery filter params */
        var params = new URLSearchParams();
        if (range && parseInt(range.value, 10) < max) {
          params.set('filter.v.price.gte', '0');
          params.set('filter.v.price.lte', range.value);
        }
        checks.filter(function (c) { return c.checked; }).forEach(function (c) { params.append('filter.p.vendor', c.value); });
        var qs = params.toString();
        window.location.href = apply.getAttribute('href') + (qs ? '?' + qs : '');
      });
    });
  }

  /* ---------- stand-in for the old fitment engine ----------
     snippets/ma-fitment-bar (still on the old collection and search pages) calls window.MAFit,
     which came from snippets/ma-fitment-core. Route those calls to the new garage until
     those pages are rebuilt. */
  if (!window.MAFit) {
    var legacy = function (v) {
      return v ? { make: v.make, model: v.model, year: v.year, makeId: v.makeId, modelId: v.modelId, key: vTag(v), label: vKey(v).toUpperCase() } : null;
    };
    window.MAFit = {
      current: function () { return legacy(garage.load().vehicle); },
      options: function (level, p) {
        p = p || {};
        if (level === 'make') return provider.makes();
        if (level === 'model') return provider.models({ id: p.makeId, name: p.makeId });
        return provider.years(null, { id: p.modelId, name: p.modelId });
      },
      set: function (v) { garage.select(v); window.location.href = fitUrl(cleanVehicle(v)); },
      clear: function () { garage.select(null); window.location.reload(); },
      remove: function (key) { garage.load().garage.forEach(function (v) { if (vTag(v) === key) garage.remove(v); }); },
      open: function () { openModal('garage'); },
      close: function () { closeModal($('[data-ma-modal="garage"]')); }
    };
    document.addEventListener('click', function (e) {
      if (e.target.closest('[data-ma-fit-open]')) { e.preventDefault(); openModal('garage'); }
      else if (e.target.closest('[data-ma-fit-clear]')) { e.preventDefault(); window.MAFit.clear(); }
    });
  }

  /* ---------- boot ---------- */
  function init() {
    initGarageModal();
    renderGarage();
    initSearch();
    paintWishlist();
    initCoupon();
    initFinders();
    initFitSections();
    initSidebars();
  }
  document.addEventListener('ma:garage', renderGarage);
  window.addEventListener('storage', function (e) { if (e.key === 'ma-garage') { var g = garage.load(); document.documentElement.classList.toggle('ma-has-vehicle', !!g.vehicle); renderGarage(); } });
  window.addEventListener('pageshow', function (e) { if (e.persisted) refreshCart(); });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  /* Theme editor: re-run when a section is re-rendered */
  document.addEventListener('shopify:section:load', function () {
    initFinders(); initFitSections(); initSidebars(); initCoupon();
    renderGarage(); paintWishlist();
  });
})();

/* ---------- open / close animation for accordions (FAQs, filter groups) ----------
   MA.slide(el, open): animates el's height between 0 and its content height.
   <details data-ma-accordion> elements get the same animation automatically. */
(function () {
  window.MA = window.MA || {};
  var still = function () { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; };
  function slide(el, open, done) {
    if (!el) return;
    if (el._maAnim) { el._maAnim.cancel(); el._maAnim = null; }
    if (still() || !el.animate) { if (done) done(); return; }
    var h = el.scrollHeight;
    el.style.overflow = 'hidden';
    var a = el.animate(
      open ? [{ height: '0px', opacity: 0 }, { height: h + 'px', opacity: 1 }] : [{ height: h + 'px', opacity: 1 }, { height: '0px', opacity: 0 }],
      { duration: Math.min(380, 180 + h / 4), easing: 'cubic-bezier(.2,.7,.2,1)' }
    );
    el._maAnim = a;
    a.onfinish = function () { el._maAnim = null; el.style.overflow = ''; if (done) done(); };
  }
  window.MA.slide = slide;

  document.addEventListener('click', function (e) {
    var sum = e.target.closest && e.target.closest('details[data-ma-accordion] > summary');
    if (!sum) return;
    var d = sum.parentNode, body = d.querySelector('[data-ma-accordion-body]');
    if (!body || still() || !body.animate) return;
    e.preventDefault();
    if (d.open) {
      d.classList.add('is-closing');
      slide(body, false, function () { d.open = false; d.classList.remove('is-closing'); });
    } else {
      d.open = true;
      slide(body, true);
    }
  });
})();

/* ---------- recently viewed products and product-card lists ----------
   MA.recent.add(handle) runs on product pages; MA.recent.list() returns handles, newest first.
   MA.loadCards(handles, grid) fetches each card (sections/ma-card-results) into grid, in order.
   [data-ma-recent] boxes (sections/ma-recent) fill themselves; with nothing viewed they show their fallback cards. */
(function () {
  window.MA = window.MA || {};
  var KEY = 'ma_recent', MAX = 16, HANDLE_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i;
  var recent = {
    list: function () {
      try { return (JSON.parse(localStorage.getItem(KEY) || '[]') || []).filter(function (h) { return HANDLE_RE.test(h); }); } catch (e) { return []; }
    },
    add: function (handle) {
      if (!HANDLE_RE.test(handle || '')) return;
      var l = recent.list().filter(function (h) { return h !== handle; });
      l.unshift(handle);
      try { localStorage.setItem(KEY, JSON.stringify(l.slice(0, MAX))); } catch (e) {}
    }
  };
  window.MA.recent = recent;

  function cardFor(handle) {
    return fetch('/products/' + encodeURIComponent(handle) + '?section_id=ma-card-results')
      .then(function (r) { return r.ok ? r.text() : ''; })
      .then(function (html) { return html ? new DOMParser().parseFromString(html, 'text/html').querySelector('[data-ma-card]') : null; })
      .catch(function () { return null; });
  }
  function loadCards(handles, grid) {
    return Promise.all(handles.map(cardFor)).then(function (cards) {
      var n = 0;
      cards.forEach(function (c) { if (c) { grid.appendChild(document.importNode(c, true)); n++; } });
      var v = window.MA.garage && window.MA.garage.load().vehicle;
      if (window.MA.updateFitBadges) window.MA.updateFitBadges(v, grid);
      if (window.MA.paintWishlist) window.MA.paintWishlist(grid);
      return n;
    });
  }
  window.MA.loadCards = loadCards;

  function initRecent(box) {
    if (box._ma) return;
    box._ma = true;
    var grid = box.querySelector('[data-ma-recent-grid]');
    var limit = parseInt(box.getAttribute('data-limit'), 10) || 4;
    var skip = (box.getAttribute('data-exclude') || '').split(',');
    var here = box.getAttribute('data-current');
    var list = recent.list().filter(function (h) { return h !== here && skip.indexOf(h) < 0; }).slice(0, limit);
    var useFallback = function () {
      var fb = box.querySelector('template[data-ma-recent-fallback]');
      if (!fb || !fb.content.querySelector('[data-ma-card]')) { box.hidden = true; return; }
      var t = box.querySelector('[data-ma-recent-title]');
      if (t && box.getAttribute('data-fallback-title')) t.textContent = box.getAttribute('data-fallback-title');
      grid.appendChild(document.importNode(fb.content, true));
      if (window.MA.paintWishlist) window.MA.paintWishlist(grid);
      box.hidden = false;
    };
    if (!list.length) { useFallback(); return; }
    box.hidden = false;
    loadCards(list, grid).then(function (n) { if (!n) useFallback(); });
  }
  function boot() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-ma-recent]'), function (box) {
      if (window.MA.whenNear) window.MA.whenNear(box, function () { initRecent(box); }); else initRecent(box);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  document.addEventListener('shopify:section:load', boot);
})();
