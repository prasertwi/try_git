// Photo montage: draw barrier cabinet (VAS117), LPR camera on pole, and company sign over a Street View capture.
// Items are draggable (pointer) and resizable (wheel / +/- buttons); positions persist per gate in this browser.
(function (root) {
  const SYM = {
    cab: s => `<g transform="scale(${s})">
      <rect x="-14" y="-62" width="28" height="62" rx="3" fill="#e9eef0" stroke="#3a4448" stroke-width="1.5"/>
      <rect x="-10" y="-56" width="20" height="10" rx="1.5" fill="#c8322b"/>
      <text x="0" y="-48.5" font-size="6" font-weight="700" text-anchor="middle" fill="#fff" font-family="IBM Plex Mono,monospace">VAS117</text>
      <circle cx="0" cy="-36" r="4" fill="#3a4448"/>
      <g transform="translate(0 -36)"><rect x="0" y="-2.5" width="150" height="5" rx="2.5" fill="#fff" stroke="#c8322b" stroke-width="1"/>
        ${[20,50,80,110,140].map(x=>`<rect x="${x}" y="-2.5" width="12" height="5" fill="#c8322b"/>`).join('')}</g>
      <rect x="-16" y="-2" width="32" height="4" fill="#8a9396"/></g>`,
    lpr: s => `<g transform="scale(${s})">
      <rect x="-2.5" y="-48" width="5" height="48" fill="#6b7477"/><rect x="-8" y="-2" width="16" height="3" fill="#6b7477"/>
      <g transform="translate(0 -50) rotate(-8)"><rect x="-6" y="-5" width="24" height="11" rx="3" fill="#f4f6f7" stroke="#3a4448" stroke-width="1.2"/>
        <rect x="-8" y="-7" width="28" height="3" rx="1.5" fill="#3a4448"/><circle cx="-6" cy="0.5" r="4" fill="#1d2426"/><circle cx="-6" cy="0.5" r="1.8" fill="#4a90c2"/></g>
      <text x="0" y="-62" font-size="7" font-weight="700" text-anchor="middle" fill="#c8322b" paint-order="stroke" stroke="#fff" stroke-width="2.5" font-family="IBM Plex Sans Thai,sans-serif">LPR</text></g>`,
    chk: s => `<g transform="scale(${s})">
      <rect x="-2" y="-70" width="4" height="70" fill="#6b7477"/>
      <g transform="translate(0 -72) rotate(10)"><rect x="-4" y="-5" width="22" height="10" rx="3" fill="#f4f6f7" stroke="#3a4448" stroke-width="1.2"/><circle cx="-4" cy="0" r="3.5" fill="#1d2426"/></g>
      <text x="0" y="-84" font-size="7" font-weight="700" text-anchor="middle" fill="#1f63c4" paint-order="stroke" stroke="#fff" stroke-width="2.5" font-family="IBM Plex Sans Thai,sans-serif">เช็ครถ</text></g>`,
    sign: (s, t) => `<g transform="scale(${s})">
      <rect x="-2" y="-40" width="4" height="40" fill="#6b7477"/><rect x="28" y="-40" width="4" height="40" fill="#6b7477"/>
      <rect x="-10" y="-70" width="52" height="32" rx="3" fill="#283891" stroke="#fff" stroke-width="1.5"/><rect x="-10" y="-44" width="52" height="6" fill="#ED1C24"/>
      ${t.logo ? `<image href="${t.logo}" x="-7" y="-67" width="46" height="26" preserveAspectRatio="xMidYMid meet"/>` :
      `<text x="16" y="-57" font-size="7" font-weight="700" text-anchor="middle" fill="#fff" font-family="Bai Jamjuree,sans-serif">${t.l1||'VAS'}</text>
       <text x="16" y="-46" font-size="5.5" text-anchor="middle" fill="#fff" font-family="IBM Plex Sans Thai,sans-serif">${t.l2||'ไม้กั้น + กล้องอ่านทะเบียน'}</text>`}</g>`
  };
  function mount(el, opt) {
    // opt: { key, img, w, h, items:[{t:'cab'|'lpr'|'chk'|'sign', x, y, s}], sign:{l1,l2,logo} }
    let items = opt.items.map(i => Object.assign({}, i));
    try { const v = JSON.parse(localStorage.getItem('mont_'+opt.key)||'null'); if (v && v.length===items.length) items = v; } catch(e) {}
    let selI = -1;
    function draw() {
      el.innerHTML = `<image href="${opt.img}" x="0" y="0" width="${opt.w}" height="${opt.h}" preserveAspectRatio="xMidYMid slice"/>` +
        items.map((it,i) => `<g class="mt" data-i="${i}" transform="translate(${it.x} ${it.y})" style="cursor:grab">${SYM[it.t](it.s, opt.sign||{})}
          ${selI===i ? `<rect x="-20" y="${-95*it.s}" width="40" height="${97*it.s}" fill="none" stroke="#ffd400" stroke-dasharray="4 3" stroke-width="2"/>` : ''}</g>`).join('');
    }
    function save(){ try { localStorage.setItem('mont_'+opt.key, JSON.stringify(items)); } catch(e) {} }
    const pt = e => { const r = el.getBoundingClientRect(); return [ (e.clientX-r.left)*opt.w/r.width, (e.clientY-r.top)*opt.h/r.height ]; };
    let drag = null;
    el.addEventListener('pointerdown', e => { const g = e.target.closest('.mt'); if (!g) { selI=-1; draw(); return; } selI = +g.dataset.i; const p = pt(e);
      drag = { i: selI, dx: p[0]-items[selI].x, dy: p[1]-items[selI].y }; el.setPointerCapture(e.pointerId); draw(); });
    el.addEventListener('pointermove', e => { if (!drag) return; const p = pt(e); items[drag.i].x = p[0]-drag.dx; items[drag.i].y = p[1]-drag.dy; draw(); });
    el.addEventListener('pointerup', () => { if (drag) { drag = null; save(); } });
    el.addEventListener('wheel', e => { if (selI<0) return; e.preventDefault(); items[selI].s = Math.max(.3, Math.min(6, items[selI].s*(e.deltaY<0?1.08:1/1.08))); draw(); save(); }, { passive:false });
    draw();
    return {
      grow(f){ if (selI<0) return; items[selI].s = Math.max(.3, Math.min(6, items[selI].s*f)); draw(); save(); },
      reset(){ items = opt.items.map(i => Object.assign({}, i)); try{ localStorage.removeItem('mont_'+opt.key); }catch(e){} selI=-1; draw(); }
    };
  }
  root.Montage = { mount, SYM };
})(typeof window !== 'undefined' ? window : globalThis);
