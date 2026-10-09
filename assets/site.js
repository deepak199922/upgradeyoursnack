/* behtr site script: bag, checkout, nav and motion. Plain JS, no build step. */
(() => {
  'use strict';

  /* ================= settings: edit these ================= */
  const CONFIG = {
    whatsapp: '917696458640',            // country code + number, no +
    whatsappLabel: '+91 76964 58640',
    email: 'makco2201@gmail.com',
    instagram: '',                        // e.g. 'https://instagram.com/makco' (empty = "coming soon")
    facebook: '',                         // e.g. 'https://facebook.com/makco'
    sizes: { 10: { label: '10 g', price: 30 }, 25: { label: '25 g', price: 60 } },
    // Google Apps Script web app (the "Makco Orders" sheet). Orders placed here land in the
    // Orders sheet and trigger the Telegram + email alerts. Empty = WhatsApp checkout only.
    orderApi: 'https://script.google.com/macros/s/AKfycbyA8hbaWMb7qlF0aovpRoJSSTWficCCFvP5oIFJr3Y_2ELtepFfOK0nmz6lxrakrYbw/exec',
    // Used until the order system answers (it sends the live values)
    upiId: 'deepakgupta221999-1@okhdfcbank',
    payee: 'Deepak Gupta',
    allowCod: true,
    paymentNotice: 'Our business registration is in progress, so for now please pay by UPI to the ID below, or choose to pay on delivery (cash or UPI).',
    // Menu-sheet IDs for each flavour and pack size
    sku: {
      'pani-puri':    { 25: 'PANI',    10: 'PANI10' },
      'lemon-chilli': { 25: 'LEMCHI',  10: 'LEMCHI10' },
      'salt-pepper':  { 25: 'SALTPEP', 10: 'SALTPEP10' },
      'peri-peri':    { 25: 'PERI',    10: 'PERI10' }
    }
  };
  const FLAVOURS = [
    { id: 'pani-puri',    name: 'Pani Puri',     color: '#6E9A3A' },
    { id: 'lemon-chilli', name: 'Lemon Chilli',  color: '#C2312A' },
    { id: 'salt-pepper',  name: 'Salt & Pepper', color: '#2A2724' },
    { id: 'peri-peri',    name: 'Peri Peri',     color: '#D4561E' }
  ];
  /* ======================================================== */

  const byId = Object.fromEntries(FLAVOURS.map(f => [f.id, f]));
  let server = null; // menu, slots and payment details from the order system
  const priceOf = (id, size) => { const m = server && server.menuById[CONFIG.sku[id][size]]; return m ? m.price : CONFIG.sizes[size].price; };
  const soldOut = (id, size) => { const m = server && server.menuById[CONFIG.sku[id][size]]; return !!(m && !m.available); };
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const rupees = n => '₹' + n.toLocaleString('en-IN');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const waLink = text => 'https://wa.me/' + CONFIG.whatsapp + '?text=' + encodeURIComponent(text);
  const pouchSrc = (id, size) => 'assets/img/pouch-' + id + '-' + size + '.webp';

  /* ---------------- toast ---------------- */
  const toastEl = document.createElement('div');
  toastEl.className = 'toast'; toastEl.setAttribute('role', 'status'); toastEl.setAttribute('aria-live', 'polite');
  document.body.appendChild(toastEl);
  let tt;
  function toast(msg) { toastEl.textContent = msg; toastEl.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => toastEl.classList.remove('show'), 2400); }

  /* ---------------- bag store ---------------- */
  let bag = {};
  try { bag = JSON.parse(localStorage.getItem('makco-bag') || '{}') || {}; } catch (e) { bag = {}; }
  for (const k of Object.keys(bag)) { const [id, s] = k.split(':'); if (!byId[id] || !CONFIG.sizes[s] || !(bag[k] > 0)) delete bag[k]; }
  const saveBag = () => { try { localStorage.setItem('makco-bag', JSON.stringify(bag)); } catch (e) {} };
  const lines = () => Object.keys(bag).map(k => { const [id, size] = k.split(':'); return { key: k, id, size, qty: bag[k], f: byId[id], price: priceOf(id, size) }; })
    .sort((a, b) => FLAVOURS.indexOf(a.f) - FLAVOURS.indexOf(b.f) || a.size - b.size);
  const count = () => Object.values(bag).reduce((a, b) => a + b, 0);
  const total = () => lines().reduce((a, l) => a + l.qty * l.price, 0);
  const listeners = [];
  function setQty(key, q) {
    q = Math.max(0, Math.min(99, q));
    if (q) bag[key] = q; else delete bag[key];
    saveBag(); listeners.forEach(fn => fn());
  }
  const addToBag = (id, size, n = 1) => setQty(id + ':' + size, (bag[id + ':' + size] || 0) + n);

  /* ---------------- nav ---------------- */
  const nav = $('.gnav');
  if (nav) {
    const onS = () => nav.classList.toggle('scrolled', scrollY > 4);
    addEventListener('scroll', onS, { passive: true }); onS();
    const mb = $('.menu-btn');
    if (mb) {
      const setMenu = open => { document.documentElement.classList.toggle('menu-open', open); mb.setAttribute('aria-expanded', open); document.body.style.overflow = open ? 'hidden' : ''; };
      mb.addEventListener('click', () => setMenu(!document.documentElement.classList.contains('menu-open')));
      $$('.mmenu a').forEach(a => a.addEventListener('click', () => setMenu(false)));
      addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });
    }
  }
  const countEls = $$('.bag-count');
  function renderCount(bump) {
    const n = count();
    countEls.forEach(el => {
      el.textContent = n; el.classList.toggle('has', n > 0);
      if (bump && n) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
    });
    $$('.bag-btn').forEach(b => b.setAttribute('aria-label', n ? 'Bag, ' + n + (n === 1 ? ' item' : ' items') : 'Bag, empty'));
  }

  /* ---------------- drawer + bag bar markup ---------------- */
  const icoClose = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const onShop = !!document.body.dataset.page && document.body.dataset.page === 'shop';
  document.body.insertAdjacentHTML('beforeend', `
  <div class="bagbar" id="bagbar" aria-hidden="true">
    <span class="sum" id="bbSum"></span>
    <button class="btn btn-gold btn-sm" type="button" id="bbOpen" tabindex="-1">Review bag</button>
  </div>
  <div class="drawer" id="drawer" hidden>
    <div class="scrim" data-close></div>
    <div class="panel" role="dialog" aria-modal="true" aria-labelledby="dTitle">
      <div class="p-head">
        <button class="back" type="button" id="dBack" hidden>‹ Bag</button>
        <h2 id="dTitle">Your bag</h2>
        <button class="x" type="button" data-close aria-label="Close">${icoClose}</button>
      </div>
      <div class="p-body" id="pBody">
        <section id="vBag">
          <div class="empty" id="dEmpty" hidden>
            <img src="assets/img/prop-pearls.webp" alt="" width="120" height="97">
            <p>Your bag is empty.</p>
            <a class="btn btn-dark" href="shop.html" ${onShop ? 'data-close' : ''}>Shop the flavours</a>
          </div>
          <div id="dFilled">
            <ul class="lines" id="dLines"></ul>
            <div class="totals" style="margin-top:18px">
              <div><span>Subtotal</span><span id="dSub"></span></div>
              <div><span>Delivery</span><span class="free">Free</span></div>
              <div class="grand"><span>Total</span><span id="dTotal"></span></div>
            </div>
            <button class="btn btn-gold btn-block" type="button" id="dCheckout" style="margin-top:18px">Check out</button>
            <p class="help-note" style="margin-top:12px">We deliver on Saturday and Sunday. Pay by UPI or on delivery.</p>
          </div>
        </section>
        <section id="vCheckout" hidden>
          <form class="form" id="cForm" novalidate>
            <h3>Your details</h3>
            <div class="field" id="f-name"><label for="cName">Name</label><input id="cName" autocomplete="name" placeholder="Your name"><span class="err">Please add your name.</span></div>
            <div class="field" id="f-phone"><label for="cPhone">WhatsApp number</label><input id="cPhone" type="tel" inputmode="tel" autocomplete="tel" placeholder="10-digit mobile number"><span class="err">Please enter a 10-digit mobile number.</span></div>
            <div class="field" id="f-email"><label for="cEmail">Email (optional)</label><input id="cEmail" type="email" inputmode="email" autocomplete="email" placeholder="For order updates by email"><span class="err">That email address doesn't look right.</span></div>
            <h3>Delivery address</h3>
            <div class="field" id="f-flat"><label for="cFlat">Flat or house number</label><input id="cFlat" autocomplete="address-line1" placeholder="e.g. 1203"><span class="err">Please add your flat or house number.</span></div>
            <div class="field" id="f-area"><label for="cArea">Building, street and area</label><input id="cArea" autocomplete="address-line2" placeholder="e.g. Tower B, Green Meadows, Gachibowli"><span class="err">Please add your building or area.</span></div>
            <h3>Delivery day</h3>
            <div class="opts" id="cDays" role="radiogroup" aria-label="Delivery day"></div>
            <div class="field"><label for="cNotes">Notes (optional)</label><textarea id="cNotes" placeholder="A custom pack size, a preferred time, anything else"></textarea></div>
            <input type="text" id="cWebsite" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px">
            <p class="form-err" id="cErr" role="alert" hidden></p>
            <button class="btn btn-gold btn-block" type="submit" id="cNext">Continue to payment</button>
            <p class="help-note" id="cFallback" hidden>Our order system isn't reachable right now. <a id="cWa" href="#" target="_blank" rel="noopener">Send this order on WhatsApp instead</a>.</p>
          </form>
        </section>
        <section id="vPay" hidden>
          <div class="form">
            <h3>Order summary</h3>
            <ul class="sumlist" id="pItems"></ul>
            <div class="totals"><div><span>Delivery</span><span id="pSlot"></span></div><div><span>Delivery fee</span><span class="free">Free</span></div><div class="grand"><span>Total</span><span id="pTotal"></span></div></div>
            <h3>How would you like to pay?</h3>
            <div class="opts" role="radiogroup" aria-label="Payment">
              <label class="opt"><input type="radio" name="pmode" value="upi" id="pmUpi" checked><span><b>UPI now</b><small>GPay, PhonePe, Paytm or any UPI app</small></span></label>
              <label class="opt" id="pmCodWrap"><input type="radio" name="pmode" value="cod" id="pmCod"><span><b>Pay on delivery</b><small>Cash or UPI at your door</small></span></label>
            </div>
            <div class="paybox" id="pUpi">
              <p class="pay-note" id="pNotice"></p>
              <ol class="paysteps">
                <li>Open any UPI app and pay <b id="pAmt"></b> to:
                  <div class="upi-row"><code id="pUpiId"></code><button class="btn btn-ghost btn-sm" type="button" id="pCopy">Copy</button></div>
                  <small id="pPayee"></small></li>
                <li>Add <b id="pNote"></b> in the payment note, if your app allows it.</li>
                <li>Come back here and tap <b>I've paid</b>.</li>
              </ol>
              <div class="field"><label for="pRef">UPI reference number (optional)</label><input id="pRef" inputmode="numeric" autocomplete="off" placeholder="12-digit UTR, if handy"></div>
            </div>
            <p class="form-err" id="pErr" role="alert" hidden></p>
            <button class="btn btn-gold btn-block" type="button" id="pPlace">I've paid, place my order</button>
            <p class="help-note" id="pWaWrap" hidden>Our order system isn't reachable right now. <a id="pWa" href="#" target="_blank" rel="noopener">Send this order on WhatsApp instead</a>.</p>
            <p class="help-note">We check every payment and confirm on WhatsApp or email.</p>
          </div>
        </section>
        <section id="vDone" hidden>
          <div class="done">
            <span class="tick"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>
            <h3 id="dHead">Order placed<span class="stop">.</span></h3>
            <p class="order-id" id="dId"></p>
            <p id="dMsg"></p>
            <a class="btn btn-gold" id="dTrack" href="#" target="_blank" rel="noopener">Track your order</a>
            <a class="btn btn-ghost" id="dWa" href="#" target="_blank" rel="noopener">Message us on WhatsApp</a>
            <button class="more" type="button" id="cNew" style="margin-top:6px">Continue shopping</button>
          </div>
        </section>
      </div>
    </div>
  </div>`);

  const drawer = $('#drawer'), bagbar = $('#bagbar');
  let view = 'bag', lastFocus = null;
  function setView(v) {
    view = v;
    $('#vBag').hidden = v !== 'bag'; $('#vCheckout').hidden = v !== 'checkout'; $('#vPay').hidden = v !== 'pay'; $('#vDone').hidden = v !== 'done';
    $('#dBack').hidden = !(v === 'checkout' || v === 'pay');
    $('#dBack').textContent = v === 'pay' ? '‹ Details' : '‹ Bag';
    $('#dTitle').textContent = v === 'checkout' ? 'Check out' : v === 'pay' ? 'Payment' : v === 'done' ? 'Thank you' : 'Your bag';
    $('#pBody').scrollTop = 0;
  }
  function openDrawer(v = 'bag') {
    lastFocus = document.activeElement;
    setView(v); renderDrawer();
    drawer.hidden = false; document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => requestAnimationFrame(() => drawer.classList.add('open')));
    renderBar();
    setTimeout(() => $('.x', drawer).focus({ preventScroll: true }), 80);
  }
  function closeDrawer() {
    if (drawer.hidden) return;
    drawer.classList.remove('open'); document.body.style.overflow = '';
    setTimeout(() => { drawer.hidden = true; renderBar(); if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true }); }, reduce ? 0 : 450);
  }
  $$('.bag-btn').forEach(b => b.addEventListener('click', () => { openDrawer('bag'); loadServer(); }));
  $('#bbOpen').addEventListener('click', () => openDrawer('bag'));
  drawer.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeDrawer(); });
  $('#dBack').addEventListener('click', () => setView(view === 'pay' ? 'checkout' : 'bag'));
  $('#dCheckout').addEventListener('click', () => { setView('checkout'); loadServer(); updateSend(); setTimeout(() => $('#cName').focus({ preventScroll: true }), 50); });
  addEventListener('keydown', e => {
    if (drawer.hidden) return;
    if (e.key === 'Escape') closeDrawer();
    if (e.key === 'Tab') {
      const f = $$('a[href],button,input,textarea,select', drawer).filter(x => x.offsetParent !== null);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });

  function renderBar() {
    const n = count();
    const show = n > 0 && drawer.hidden;
    bagbar.classList.toggle('show', show);
    bagbar.setAttribute('aria-hidden', show ? 'false' : 'true');
    $('#bbOpen').tabIndex = show ? 0 : -1;
    $('#bbSum').innerHTML = n + (n === 1 ? ' pack' : ' packs') + ' <span>·</span> ' + rupees(total());
  }
  function renderDrawer() {
    const ls = lines(), n = count();
    $('#dEmpty').hidden = n > 0; $('#dFilled').hidden = n === 0;
    const ul = $('#dLines');
    const focused = ul.contains(document.activeElement) ? document.activeElement.dataset : null;
    ul.innerHTML = ls.map(l => `<li class="line">
        <img src="${pouchSrc(l.id, l.size)}" alt="" width="52" height="64">
        <div class="nm">${esc(l.f.name)}<small>${CONFIG.sizes[l.size].label} · ${rupees(l.price)} each${soldOut(l.id, l.size) ? ' · <b style="color:var(--err)">sold out</b>' : ''}</small></div>
        <div class="rt"><span class="lp">${rupees(l.qty * l.price)}</span>
          <span class="qty" role="group" aria-label="${esc(l.f.name)} ${CONFIG.sizes[l.size].label} quantity">
            <button type="button" data-dq="${l.key}" data-d="-1" aria-label="Remove one">−</button><output>${l.qty}</output><button type="button" data-dq="${l.key}" data-d="1" aria-label="Add one">+</button>
          </span></div></li>`).join('');
    if (focused && focused.dq) { const b = ul.querySelector(`[data-dq="${focused.dq}"][data-d="${focused.d}"]`); if (b) b.focus({ preventScroll: true }); }
    $('#dSub').textContent = rupees(total()); $('#dTotal').textContent = rupees(total());
    if (view === 'checkout' && n === 0) setView('bag');
    updateSend();
  }
  $('#dLines').addEventListener('click', e => { const b = e.target.closest('[data-dq]'); if (b) setQty(b.dataset.dq, (bag[b.dataset.dq] || 0) + (+b.dataset.d)); });

  /* ---------------- checkout ---------------- */
  const LONG_DAYS = { Sun: 'Sunday', Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday' };
  function localSlots() {
    // Same labels the order system uses, e.g. "Sat, 10 Oct" (India time)
    const out = [], now = Date.now();
    for (let i = 1; out.length < 4 && i < 21; i++) {
      const d = new Date(now + i * 864e5);
      const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short' }).formatToParts(d).map(x => [x.type, x.value]));
      if (p.weekday === 'Sat' || p.weekday === 'Sun') out.push(p.weekday + ', ' + p.day + ' ' + p.month);
    }
    return out;
  }
  function renderSlots(slots) {
    const cur = ($('input[name="day"]:checked') || {}).value;
    $('#cDays').innerHTML = slots.map((sl, i) => {
      const [wd, rest] = sl.split(', ');
      return `<label class="opt"><input type="radio" name="day" id="day${i}" value="${esc(sl)}"${(cur ? cur === sl : !i) ? ' checked' : ''}><span><b>${LONG_DAYS[wd] || esc(wd)}</b><small>${esc(rest || '')}</small></span></label>`;
    }).join('');
    if (!$('input[name="day"]:checked') && $('#day0')) $('#day0').checked = true;
  }
  renderSlots(localSlots());

  async function api(action, body = {}) {
    if (!CONFIG.orderApi) throw Object.assign(new Error('offline'), { offline: true });
    let res;
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 30000);
      res = await fetch(CONFIG.orderApi, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ action }, body)), signal: ctl.signal, redirect: 'follow' });
      clearTimeout(t);
    } catch (e) { throw Object.assign(new Error('offline'), { offline: true }); }
    let data; try { data = await res.json(); } catch (e) { throw Object.assign(new Error('offline'), { offline: true }); }
    if (!data || !data.ok) throw new Error((data && data.error) || 'Something went wrong. Please try again.');
    return data;
  }
  let serverLoading = null;
  function applyServer(d) {
    server = d; server.menuById = Object.fromEntries((d.menu || []).map(m => [m.id, m]));
    if (d.slots && d.slots.length) renderSlots(d.slots);
    listeners.forEach(fn => fn());
  }
  try { // reuse a recent answer so pages open with live prices straight away
    const c = JSON.parse(sessionStorage.getItem('behtr-config') || 'null');
    if (c && Date.now() - c.at < 10 * 60 * 1000) applyServer(c.d);
  } catch (e) {}
  function loadServer(force) {
    if ((server && !force) || serverLoading || !CONFIG.orderApi) return serverLoading;
    serverLoading = api('config').then(d => {
      applyServer(d);
      try { sessionStorage.setItem('behtr-config', JSON.stringify({ at: Date.now(), d })); } catch (e) {}
      return d;
    }).catch(() => null).finally(() => { serverLoading = null; });
    return serverLoading;
  }
  // Warm up the order system in the background, so it is awake by the time someone checks out
  const idle = window.requestIdleCallback || (fn => setTimeout(fn, 1200));
  idle(() => loadServer(!!server));

  const val = id => $('#' + id).value.trim();
  const cleanPhone = v => v.replace(/[\s\-()]/g, '').replace(/^(\+?91)(?=\d{10}$)/, '').replace(/^0(?=\d{10}$)/, '');
  function validate(show) {
    const ok = {
      name: val('cName').length > 1,
      phone: /^[6-9]\d{9}$/.test(cleanPhone(val('cPhone'))),
      email: !val('cEmail') || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val('cEmail')),
      flat: val('cFlat').length > 0,
      area: val('cArea').length > 2
    };
    if (show) Object.keys(ok).forEach(k => $('#f-' + k).classList.toggle('bad', !ok[k]));
    return Object.values(ok).every(Boolean);
  }
  const slotVal = () => ($('input[name="day"]:checked') || {}).value || '';
  function orderPayload(mode) {
    const items = {};
    lines().forEach(l => { const sku = CONFIG.sku[l.id][l.size]; items[sku] = (items[sku] || 0) + l.qty; });
    return {
      items, name: val('cName'), phone: cleanPhone(val('cPhone')), email: val('cEmail'),
      flat: val('cFlat'), tower: val('cArea'), slot: slotVal(), notes: val('cNotes'),
      website: $('#cWebsite').value, token: checkoutToken,
      payment: mode ? { mode, ref: val('pRef') } : undefined
    };
  }
  function orderText() {
    const n = count();
    return ["Hi behtr! I'd like to order:",
      ...lines().map(l => '• ' + l.f.name + ', ' + CONFIG.sizes[l.size].label + ' × ' + l.qty + ' = ' + rupees(l.qty * l.price)),
      'Total: ' + rupees(total()) + ' (' + n + (n === 1 ? ' pack)' : ' packs)'), '',
      'Name: ' + val('cName'), 'Phone: ' + cleanPhone(val('cPhone')),
      'Address: ' + [val('cFlat'), val('cArea')].filter(Boolean).join(', '),
      'Delivery: ' + (slotVal() || 'This weekend')]
      .concat(val('cNotes') ? ['Notes: ' + val('cNotes')] : []).join('\n');
  }
  function updateSend() { $('#cWa').href = count() ? waLink(orderText()) : '#'; }
  const newToken = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  let checkoutToken = newToken();
  function busy(btn, on, label) { btn.disabled = on; btn.setAttribute('aria-busy', on ? 'true' : 'false'); if (label) btn.textContent = label; }
  function showErr(el, msg) { el.textContent = msg || ''; el.hidden = !msg; }

  $('#cForm').addEventListener('input', e => { updateSend(); const f = e.target.closest('.field'); if (f && f.classList.contains('bad')) validate(true); });
  $('#cForm').addEventListener('change', updateSend);
  $('#cForm').addEventListener('submit', e => {
    e.preventDefault();
    showErr($('#cErr'), ''); $('#cFallback').hidden = true;
    if (!count()) return;
    if (!validate(true)) { const b = $('.field.bad input, .field.bad textarea', drawer); if (b) b.focus(); return; }
    renderPay();
    setView('pay');
    loadServer(); // make sure the order system is awake for "Place order"
  });

  function renderPay() {
    const pay = server || {};
    const upiId = pay.upiId || CONFIG.upiId, payee = pay.payee || CONFIG.payee;
    const allowCod = pay.allowCod !== undefined ? pay.allowCod : CONFIG.allowCod;
    const notice = pay.paymentNotice || CONFIG.paymentNotice;
    $('#pItems').innerHTML = lines().map(l => `<li><span>${l.qty} × ${esc(l.f.name)} <small>${CONFIG.sizes[l.size].label}</small></span><span>${rupees(l.qty * l.price)}</span></li>`).join('');
    $('#pSlot').textContent = slotVal();
    $('#pTotal').textContent = rupees(total());
    $('#pAmt').textContent = rupees(total());
    $('#pUpiId').textContent = upiId;
    $('#pPayee').textContent = payee ? 'Name shown in your app: ' + payee : '';
    $('#pNote').textContent = ('BEHTR ' + val('cFlat') + ' ' + val('cArea')).replace(/\s+/g, ' ').trim().slice(0, 40);
    $('#pNotice').textContent = notice || '';
    $('#pNotice').hidden = !notice;
    $('#pmCodWrap').hidden = allowCod === false;
    if (allowCod === false) $('#pmUpi').checked = true;
    syncPayMode();
    showErr($('#pErr'), ''); $('#pWaWrap').hidden = true;
  }
  function syncPayMode() {
    const cod = $('#pmCod').checked;
    $('#pUpi').hidden = cod;
    $('#pPlace').textContent = cod ? 'Place order, pay on delivery' : "I've paid, place my order";
  }
  $$('input[name="pmode"]').forEach(r => r.addEventListener('change', syncPayMode));
  $('#pCopy').addEventListener('click', () => {
    const v = $('#pUpiId').textContent;
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(v).then(() => toast('UPI ID copied'), () => toast(v)); else toast(v);
  });
  $('#pPlace').addEventListener('click', async () => {
    const mode = $('#pmCod').checked ? 'cod' : 'upi';
    const btn = $('#pPlace');
    showErr($('#pErr'), '');
    busy(btn, true, 'Placing your order…');
    const slow = setTimeout(() => { if (btn.disabled) btn.textContent = 'Almost done, saving your order…'; }, 3500);
    try {
      const r = await api('place', { order: orderPayload(mode) });
      const phone = cleanPhone(val('cPhone'));
      try { localStorage.setItem('makco-last-order', JSON.stringify({ id: r.orderId, phone: phone.slice(-4), url: r.trackUrl })); } catch (e) {}
      $('#dId').textContent = 'Order number ' + r.orderId;
      $('#dMsg').textContent = mode === 'cod'
        ? `Please keep ${rupees(r.total)} ready on ${r.slot}. We'll confirm on WhatsApp${val('cEmail') ? ' and email' : ''}.`
        : `We'll check your ${rupees(r.total)} payment and confirm your delivery on ${r.slot}.`;
      $('#dTrack').href = r.trackUrl;
      $('#dWa').href = waLink('Hi behtr! About my order ' + r.orderId + ': ');
      bag = {}; saveBag(); listeners.forEach(fn => fn());
      checkoutToken = newToken();
      setView('done');
    } catch (err) {
      showErr($('#pErr'), err.offline ? "We couldn't reach our order system. Check your connection and try again." : err.message);
      if (err.offline) { updateSend(); $('#pWa').href = $('#cWa').href; $('#pWaWrap').hidden = false; }
    } finally { clearTimeout(slow); busy(btn, false); syncPayMode(); }
  });
  $('#cNew').addEventListener('click', () => { setView('bag'); closeDrawer(); if (!onShop) location.href = 'shop.html'; });

  /* ---------------- fly to bag ---------------- */
  function fly(fromEl, src) {
    if (reduce || !fromEl) return;
    const target = $$('.bag-btn').find(b => b.offsetParent !== null);
    if (!target) return;
    const a = fromEl.getBoundingClientRect(), b = target.getBoundingClientRect();
    const img = document.createElement('img'); img.src = src; img.className = 'flyer'; img.alt = '';
    document.body.appendChild(img);
    const sx = a.left + a.width / 2 - 22, sy = a.top + a.height / 2 - 30, ex = b.left + b.width / 2 - 22, ey = b.top + b.height / 2 - 30;
    const mx = (sx + ex) / 2, my = Math.min(sy, ey) - 160;
    img.animate([
      { transform: `translate(${sx}px,${sy}px) scale(1.3) rotate(0deg)`, opacity: 1 },
      { transform: `translate(${mx}px,${my}px) scale(1) rotate(-12deg)`, opacity: 1, offset: .5 },
      { transform: `translate(${ex}px,${ey}px) scale(.3) rotate(-20deg)`, opacity: .4 }
    ], { duration: 820, easing: 'cubic-bezier(.3,.6,.35,1)' }).onfinish = () => { img.remove(); renderCount(true); };
  }

  /* ---------------- WhatsApp + social + copy ---------------- */
  const WA_TEXT = {
    hello: 'Hi Deepak and Samiksha! ',
    bulk: "Hi behtr! I'd like to plan a bulk order.\nOccasion:\nDate:\nHow many people or packs:\nFlavours:\nPack size:",
    custom: "Hi behtr! I'd like a custom pack size.\nFlavour:\nSize:\nHow many:",
    question: 'Hi behtr! I have a question: '
  };
  $$('[data-wa]').forEach(a => { a.href = waLink(WA_TEXT[a.dataset.wa] || WA_TEXT.hello); a.target = '_blank'; a.rel = 'noopener'; });
  $$('[data-social]').forEach(a => {
    const url = CONFIG[a.dataset.social];
    if (url) { a.href = url; a.target = '_blank'; a.rel = 'noopener'; }
    else a.addEventListener('click', e => { e.preventDefault(); toast('Our ' + (a.dataset.social === 'instagram' ? 'Instagram' : 'Facebook') + ' page is coming soon'); });
  });
  $$('[data-copy]').forEach(b => b.addEventListener('click', () => {
    const v = b.dataset.copy;
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(v).then(() => toast('Copied ' + v), () => toast(v));
    else toast(v);
  }));
  $$('[data-year]').forEach(el => el.textContent = new Date().getFullYear());

  /* ---------------- reveal on scroll ---------------- */
  if (!reduce && 'IntersectionObserver' in window) {
    const below = el => el.getBoundingClientRect().top > innerHeight * .94;
    const els = $$('.rv, .swap, .sign').filter(below);
    els.forEach(el => el.classList.add('pending'));
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.remove('pending'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -10% 0px' });
    els.forEach(el => io.observe(el));
  }

  /* ---------------- statement word reveal ---------------- */
  $$('.statement').forEach(st => {
    if (reduce) return;
    const walk = node => {
      for (const n of Array.from(node.childNodes)) {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) frag.appendChild(document.createTextNode(part));
            else { const s = document.createElement('span'); s.className = 'w'; s.textContent = part; frag.appendChild(s); }
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) walk(n);
      }
    };
    walk(st);
    const words = $$('.w', st);
    const upd = () => {
      const r = st.getBoundingClientRect();
      const p = Math.max(0, Math.min(1, (innerHeight * .85 - r.top) / (r.height + innerHeight * .35)));
      const lit = p * words.length * 1.15;
      words.forEach((w, i) => w.style.setProperty('--o', Math.max(.2, Math.min(1, lit - i + 1)).toFixed(2)));
    };
    let tk = false; addEventListener('scroll', () => { if (!tk) { tk = true; requestAnimationFrame(() => { tk = false; upd(); }); } }, { passive: true });
    upd();
  });

  /* ---------------- flavour showcase ---------------- */
  // fetch every showcase image up front, so a flavour never appears half-loaded
  if ($('.showcase')) idle(() => $$('.showcase img').forEach(im => { if (!im.complete) { const x = new Image(); x.decoding = 'async'; x.src = im.currentSrc || im.src; } }));
  const sc = $('.showcase');
  if (sc) {
    const chaps = $$('.chap', sc), n = chaps.length;
    const dots = $('.sc-dots', sc);
    const setTint = i => sc.style.setProperty('--tint', chaps[i].dataset.tint);
    setTint(0); chaps[0].classList.add('on');
    if (!reduce) {
      sc.classList.add('pinned'); sc.style.setProperty('--n', n);
      dots.innerHTML = chaps.map((c, i) => `<button type="button" aria-label="${esc(c.dataset.name)}"></button>`).join('');
      const dbs = $$('button', dots);
      const box = $('.sc-chaps', sc);
      let cur = -1;
      const upd = () => {
        const r = box.getBoundingClientRect(), span = r.height - innerHeight;
        const p = Math.max(0, Math.min(.9999, -r.top / span));
        const i = Math.floor(p * n), lp = p * n - i;
        if (i !== cur) {
          cur = i; chaps.forEach((c, k) => { c.classList.toggle('on', k === i); c.classList.toggle('before', k < i); }); setTint(i);
          dbs.forEach((b, k) => b.setAttribute('aria-current', k === i ? 'true' : 'false'));
        }
        $$('.prop', chaps[i]).forEach(pr => {
          const d = +pr.dataset.depth || 1;
          pr.style.setProperty('--px', ((lp - .5) * 24 * d * (pr.dataset.dir === 'l' ? -1 : 1)).toFixed(1));
          pr.style.setProperty('--py', ((.5 - lp) * 70 * d).toFixed(1));
        });
      };
      dbs.forEach((b, k) => b.addEventListener('click', () => {
        const r = box.getBoundingClientRect(), top = scrollY + r.top, span = r.height - innerHeight;
        scrollTo({ top: top + span * (k + .5) / n, behavior: 'smooth' });
      }));
      let tk = false; addEventListener('scroll', () => { if (!tk) { tk = true; requestAnimationFrame(() => { tk = false; upd(); }); } }, { passive: true });
      addEventListener('resize', upd); upd();
    } else chaps.forEach(c => c.classList.add('on'));
  }

  /* ---------------- hero makhana physics ---------------- */
  function rng(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
  const spriteCache = new Map();
  function pearlSprite(r, seed) {
    const key = r.toFixed(1) + '|' + seed;
    if (spriteCache.has(key)) return spriteCache.get(key);
    const R = rng(seed * 7919 + 13), half = r * 1.45, size = Math.ceil(half * 2);
    const c = document.createElement('canvas'); c.width = c.height = Math.ceil(size * DPR);
    const x = c.getContext('2d'); x.scale(DPR, DPR); x.translate(size / 2, size / 2);
    const g = x.createRadialGradient(-r * .35, -r * .42, r * .05, 0, 0, r * 1.05);
    g.addColorStop(0, '#fffbf3'); g.addColorStop(.5, '#f1e3c7'); g.addColorStop(1, '#c4a473');
    x.fillStyle = g; x.beginPath(); x.arc(0, 0, r * .8, 0, Math.PI * 2);
    const k = 6 + Math.floor(R() * 3);
    for (let i = 0; i < k; i++) { const a = i / k * Math.PI * 2 + R() * .5, d = r * (.27 + R() * .08), lr = r * (.5 + R() * .12); x.moveTo(Math.cos(a) * d + lr, Math.sin(a) * d); x.arc(Math.cos(a) * d, Math.sin(a) * d, lr, 0, Math.PI * 2); }
    x.fill();
    x.globalCompositeOperation = 'source-atop';
    x.fillStyle = '#4b2a12';
    for (let i = 0, n = 5 + Math.floor(R() * 6); i < n; i++) { const a = R() * Math.PI * 2, d = Math.sqrt(R()) * r * .85; x.beginPath(); x.ellipse(Math.cos(a) * d, Math.sin(a) * d, r * (.035 + R() * .05), r * (.025 + R() * .035), R() * 3, 0, Math.PI * 2); x.fill(); }
    const sh = x.createRadialGradient(-r * .3, -r * .35, r * .25, 0, 0, r * 1.1); sh.addColorStop(.55, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(70,35,10,.42)');
    x.fillStyle = sh; x.fillRect(-size, -size, size * 2, size * 2);
    x.fillStyle = 'rgba(255,255,255,.4)'; x.beginPath(); x.ellipse(-r * .32, -r * .4, r * .26, r * .14, -.6, 0, Math.PI * 2); x.fill();
    const out = { c, size }; spriteCache.set(key, out); return out;
  }
  function heroPile() {
    const hero = $('.hero'), line = hero && $('.lineup', hero), cv = hero && $('canvas.pile', hero);
    if (!cv || !line) return;
    const ctx = cv.getContext('2d');
    let W = 0, H = 0, floor = 0, items = [], boxes = [], raf = 0, calm = 0, visible = true, last = 0;
    const BITS = ['#c8641e', '#8A4A1F', '#E39A2B', '#a5501c'];
    function measure() {
      const hr = hero.getBoundingClientRect(), lr = line.getBoundingClientRect();
      W = hr.width; H = hr.height;
      cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      floor = lr.bottom - hr.top - lr.height * .02;
      // the makhana stay in two lanes either side of the pouches, never on them
      const packs = $$('.lu', line).map(a => a.getBoundingClientRect());
      const left = Math.min(...packs.map(b => b.left)) - hr.left + 6, right = Math.max(...packs.map(b => b.right)) - hr.left - 6;
      const minLane = Math.min(110, W * .2);
      boxes = [[0, Math.max(left, minLane)], [Math.min(right, W - minLane), W]];
    }
    function spawn() {
      items = [];
      const R = rng(42), small = W < 560, per = small ? 6 : 11;
      [0, 1].forEach(side => {
        const [lo, hi] = boxes[side];
        for (let i = 0; i < per; i++) {
          const r = small ? 11 + R() * 6 : 14 + R() * 9;
          const x = lo + r + R() * Math.max(1, hi - lo - 2 * r);
          items.push({ side, x, y: -r - i * 60 - R() * 50 - side * 30, vx: 0, vy: 0, r, a: R() * 6.28, va: (R() - .5) * 1.5, m: r * r, s: pearlSprite(r, i * 17 + side * 101 + 3) });
        }
        for (let i = 0; i < per * 1.4; i++) {
          const r = 2.6 + R() * 2.6;
          const x = lo + r + R() * Math.max(1, hi - lo - 2 * r);
          items.push({ side, x, y: -r - i * 40 - R() * 80, vx: 0, vy: 0, r, a: R() * 6.28, va: (R() - .5) * 2, m: r * r, bit: true, col: BITS[i % 4] });
        }
      });
    }
    function step(dt) {
      for (const p of items) {
        p.vy += 1900 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        let ground = false;
        if (p.y > floor - p.r) { p.y = floor - p.r; if (p.vy > 0) p.vy *= -.16; p.vx *= .82; ground = true; }
        if (p.y < p.r && p.vy < 0) { p.y = p.r; p.vy *= -.3; }
        const [lo, hi] = boxes[p.side];
        if (p.x < lo + p.r) { p.x = lo + p.r; p.vx = Math.abs(p.vx) * .2; }
        if (p.x > hi - p.r) { p.x = hi - p.r; p.vx = -Math.abs(p.vx) * .2; }
        p.vx *= ground ? .6 : .9;  // keep the motion vertical
        const target = p.bit ? p.va : p.vx / p.r;
        p.va += (target - p.va) * (ground ? .5 : .08);
        p.va *= ground ? .9 : .985;
        p.va = Math.max(-4, Math.min(4, p.va));
        p.a += p.va * dt;
      }
      for (let it = 0; it < 3; it++) for (let i = 0; i < items.length; i++) {
        const A = items[i];
        for (let j = i + 1; j < items.length; j++) {
          const B = items[j], dx = B.x - A.x, dy = B.y - A.y, min = A.r + B.r;
          if (Math.abs(dx) > min || Math.abs(dy) > min) continue;
          const d2 = dx * dx + dy * dy; if (d2 >= min * min || !d2) continue;
          const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, ov = min - d, tm = A.m + B.m;
          A.x -= nx * ov * B.m / tm; A.y -= ny * ov * B.m / tm; B.x += nx * ov * A.m / tm; B.y += ny * ov * A.m / tm;
          const rv = (B.vx - A.vx) * nx + (B.vy - A.vy) * ny;
          if (rv < 0) { const imp = -1.2 * rv / (1 / A.m + 1 / B.m); A.vx -= imp / A.m * nx; A.vy -= imp / A.m * ny; B.vx += imp / B.m * nx; B.vy += imp / B.m * ny; A.vx *= .5; B.vx *= .5; A.va *= .9; B.va *= .9; }
        }
      }
    }
    function draw() {
      ctx.clearRect(0, 0, W, H);
      for (const p of items) if (!p.bit && p.y > floor - p.r * 1.6) {
        const g = ctx.createRadialGradient(p.x, floor + 2, 0, p.x, floor + 2, p.r * 1.1); g.addColorStop(0, 'rgba(0,0,0,.3)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(p.x, floor + 2, p.r * 1.1, p.r * .4, 0, 0, Math.PI * 2); ctx.fill();
      }
      for (const p of items) if (p.bit) {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.col; const s = p.r * 1.7;
        ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(-s / 2, -s / 2, s, s * .8, s * .3); else ctx.rect(-s / 2, -s / 2, s, s * .8); ctx.fill(); ctx.restore();
      }
      for (const p of items) if (!p.bit) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.drawImage(p.s.c, -p.s.size / 2, -p.s.size / 2, p.s.size, p.s.size); ctx.restore(); }
    }
    function loop(t) {
      raf = 0;
      const dt = Math.min(.033, last ? (t - last) / 1000 : 1 / 60); last = t;
      step(dt / 2); step(dt / 2); draw();
      let mx = 0; for (const p of items) mx = Math.max(mx, Math.abs(p.vx) + Math.abs(p.vy) + Math.abs(p.va) * p.r);
      calm = mx < 10 ? calm + 1 : 0;
      if (calm < 40 && visible) raf = requestAnimationFrame(loop); else last = 0;
    }
    function wake() { calm = 0; if (!raf && visible && !reduce) raf = requestAnimationFrame(loop); }
    function nudge(px, py, s) {
      const top = Math.sqrt(2 * 1900 * Math.max(200, floor - 40)); // speed that just reaches the top of the hero
      for (const p of items) { const dx = p.x - px, dy = p.y - py, d = Math.hypot(dx, dy) || 1, R = s > 1 ? 140 : 100; if (d < R) { const f = Math.min(1, (1 - d / R) * s); p.vy = -Math.max(-p.vy, top * (.45 + .55 * f) * (.85 + Math.random() * .15)); p.va += (Math.random() - .5) * 3; } }
      wake();
    }
    hero.addEventListener('pointermove', e => { if (reduce || e.pointerType === 'touch') return; const r = hero.getBoundingClientRect(); nudge(e.clientX - r.left, e.clientY - r.top, .75); });
    hero.addEventListener('pointerdown', e => { if (reduce) return; const r = hero.getBoundingClientRect(); nudge(e.clientX - r.left, e.clientY - r.top, 1.6); });
    new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) wake(); }).observe(hero);
    let started = false, rt;
    function start() {
      measure(); spawn();
      if (reduce) { for (let i = 0; i < 1200; i++) step(1 / 120); draw(); } else wake();
      started = true;
    }
    new ResizeObserver(() => { if (!started) return; clearTimeout(rt); rt = setTimeout(() => { measure(); for (const p of items) { const [lo, hi] = boxes[p.side]; p.x = Math.max(lo + p.r, Math.min(p.x, hi - p.r)); } wake(); }, 150); }).observe(hero);
    const hint = $('.stage-hint'); if (hint) { hint.textContent = matchMedia('(hover: hover)').matches ? 'give the makhana a nudge' : 'tap the makhana'; hint.hidden = reduce; }
    // wait for the pouch images (and their pop-up animation) so the pouches are in place
    Promise.all($$('img', line).map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; }))).then(() => setTimeout(start, reduce ? 0 : 900));
  }
  heroPile();

  /* ---------------- shop cards ---------------- */
  $$('.pcard').forEach(card => {
    const id = card.dataset.id, f = byId[id];
    const tile = $('.ptile', card), img = $('.ptile .pouch', card), qtyOut = $('.qty output', card), addBtn = $('[data-add]', card), note = $('.inbag', card);
    let q = 1;
    const size = () => ($('input[type="radio"]:checked', card) || {}).value || '25';
    const sync = () => {
      $$('input[type="radio"]', card).forEach(r => {
        const out = soldOut(id, r.value), sm = r.parentElement.querySelector('small');
        r.disabled = out; sm.textContent = out ? 'Sold out' : rupees(priceOf(id, r.value));
        if (out && r.checked) { const other = $$('input[type="radio"]', card).find(x => !soldOut(id, x.value)); if (other) { other.checked = true; img.src = pouchSrc(id, other.value); } }
      });
      const s = size(), p = priceOf(id, s);
      const hint = $('.seg-note', card); if (hint) hint.textContent = s === '10' ? 'A snack for one: lunch boxes, play breaks, chai time.' : 'To share or gift: return favours, puja favours, family snacking.';
      addBtn.disabled = soldOut(id, s);
      tile.dataset.size = s;
      addBtn.textContent = 'Add to bag · ' + rupees(p * q);
      const inb = (bag[id + ':10'] || 0) + (bag[id + ':25'] || 0);
      note.textContent = inb ? inb + (inb === 1 ? ' pack' : ' packs') + ' in your bag' : '';
      qtyOut.textContent = q;
    };
    $$('input[type="radio"]', card).forEach(r => r.addEventListener('change', () => {
      const s = size();
      if (reduce) { img.src = pouchSrc(id, s); sync(); return; }
      img.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(10px) scale(.96)' }], { duration: 160, easing: 'ease-in' }).onfinish = () => {
        img.src = pouchSrc(id, s); sync();
        img.animate([{ opacity: 0, transform: 'translateY(10px) scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.22,.9,.24,1)' });
      };
    }));
    $('[data-q="-1"]', card).addEventListener('click', () => { q = Math.max(1, q - 1); sync(); });
    $('[data-q="1"]', card).addEventListener('click', () => { q = Math.min(50, q + 1); sync(); });
    addBtn.addEventListener('click', () => {
      const s = size();
      addToBag(id, s, q);
      fly(img, pouchSrc(id, s));
      toast(q + ' × ' + f.name + ' (' + CONFIG.sizes[s].label + ') added to your bag');
      q = 1; sync();
    });
    listeners.push(sync); sync();
  });
  $$('[data-add-set]').forEach(b => b.addEventListener('click', () => {
    FLAVOURS.forEach(f => addToBag(f.id, '10', 1));
    fly(b, pouchSrc('pani-puri', '10'));
    toast('All four flavours (10 g each) added to your bag');
  }));

  /* ---------------- boot ---------------- */
  listeners.push(() => { renderCount(false); renderBar(); if (!drawer.hidden) renderDrawer(); });
  renderCount(false); renderBar();
  if (location.hash === '#bag') openDrawer('bag');
})();
