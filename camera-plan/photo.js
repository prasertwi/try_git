// Overlay the proposed VAS117 cabinets, LPR / vehicle-check cameras and the VAS sign on the real
// Street View captures (Jan 2025). Coordinates are image pixels (1559×784), placed on the existing equipment.
// Photos are loaded from field/ which is published only with the private page (not in the public repo).
(function(){
  // Base images: VAS-117 mockups made on Street View by the field session (G1 Sep 2018, G2/G3 Nov 2020).
  const SITES = {
    G1: { img:'field/G1_vas117.png', w:1234, h:784, title:'G1 ประตูหน้า ถนนคู่ขนานทางหลวง 304', items:[
      { t:'lpr', x:352, y:470, h:55, s:1.3, face:-1, label:'LPR ขาเข้า (ข้างซุ้มป้อม)', lx:120, ly:640 },
      { t:'chk', x:300, y:330, h:0, s:1.1, face:-1, label:'กล้องเช็ครถ (เสาซุ้ม)', lx:80, ly:300 },
      { t:'sign', x:1120, y:640, w:150, h:72, label:'' } ] },
    G2: { img:'field/G2_vas117.png', w:1559, h:784, title:'G2 สี่แยกกลาง ฝั่งใต้ซอย 4 (มีป้อมยาม)', items:[
      { t:'lpr', x:378, y:600, h:70, s:1.3, face:-1, label:'LPR ขาเข้า', lx:380, ly:690 },
      { t:'lpr', x:1030, y:560, h:60, s:1.1, face:1, label:'LPR ขาออก', lx:1050, ly:650 },
      { t:'chk', x:1150, y:400, h:0, s:1.1, face:-1, label:'กล้องเช็ครถ (ผนังป้อม)', lx:1060, ly:300 },
      { t:'sign', x:1480, y:690, w:150, h:72, label:'' } ] },
    G3: { img:'field/G3_vas117.png', w:1559, h:784, title:'G3 สี่แยกกลาง ฝั่งเหนือซอย 4 (ไม่มีป้อม)', items:[
      { t:'lpr', x:305, y:590, h:65, s:1.2, face:-1, label:'LPR ขาเข้า', lx:300, ly:680 },
      { t:'lpr', x:1250, y:690, h:75, s:1.3, face:1, label:'LPR ขาออก', lx:1240, ly:540 },
      { t:'chk', x:518, y:300, h:0, s:1.1, face:-1, label:'กล้องเช็ครถ (เสาไฟเดิม)', lx:560, ly:270 },
      { t:'sign', x:1420, y:600, w:150, h:72, label:'' } ] }
  };
  const cab = it => {
    const x0 = it.x - it.w/2, top = it.y - it.h;
    return `<rect x="${x0}" y="${top}" width="${it.w}" height="${it.h}" rx="${it.w*.08}" fill="#eef1f2" stroke="#2b3337" stroke-width="2"/>
      <rect x="${x0}" y="${top}" width="${it.w}" height="${it.h*.16}" rx="${it.w*.08}" fill="#cd0a0e"/>
      <text x="${it.x}" y="${top+it.h*.12}" font-size="${Math.max(8,it.w*.2)}" font-weight="700" fill="#fff" text-anchor="middle" font-family="IBM Plex Mono,monospace">VAS117</text>
      <circle cx="${it.x}" cy="${top+it.h*.3}" r="${it.w*.09}" fill="#2b3337"/>
      ${[...Array(7)].map((_,i)=>`<rect x="${it.x-it.w*.06}" y="${top+it.h*.3-it.arm*(i+1)/7}" width="${it.w*.12}" height="${it.arm/7}" fill="${i%2?'#fff':'#c8322b'}" stroke="#2b3337" stroke-width=".5"/>`).join('')}`;
  };
  const lpr = it => {
    const s = it.s, f = it.face;
    return `<rect x="${it.x-2.5*s}" y="${it.y-it.h}" width="${5*s}" height="${it.h}" fill="#7d878b"/>
      <g transform="translate(${it.x} ${it.y-it.h}) scale(${f*s} ${s})"><rect x="-10" y="-14" width="28" height="12" rx="3" fill="#f4f6f7" stroke="#2b3337" stroke-width="1.4"/>
      <rect x="-12" y="-17" width="32" height="3.5" rx="1.5" fill="#f4f6f7" stroke="#2b3337" stroke-width="1"/>
      <circle cx="18" cy="-8" r="4.5" fill="#111"/><circle cx="18" cy="-8" r="2" fill="#ff4b3a"/></g>`;
  };
  const chk = it => `<g transform="translate(${it.x} ${it.y}) scale(${it.face*it.s} ${it.s})"><rect x="-6" y="-2" width="10" height="6" fill="#7d878b"/>
      <rect x="0" y="-8" width="30" height="13" rx="3" fill="#f4f6f7" stroke="#2b3337" stroke-width="1.4"/><circle cx="30" cy="-1.5" r="5" fill="#111"/></g>`;
  const sign = it => `<rect x="${it.x-it.w/2+8}" y="${it.y-it.h-40}" width="5" height="${it.h+40}" fill="#7d878b"/><rect x="${it.x+it.w/2-13}" y="${it.y-it.h-40}" width="5" height="${it.h+40}" fill="#7d878b"/>
      <rect x="${it.x-it.w/2}" y="${it.y-it.h*2-40}" width="${it.w}" height="${it.h}" rx="4" fill="#09104a" stroke="#fff" stroke-width="2"/>
      <rect x="${it.x-it.w/2}" y="${it.y-it.h-52}" width="${it.w}" height="12" fill="#cd0a0e"/>
      <text x="${it.x}" y="${it.y-it.h*2-8}" font-size="30" font-weight="700" fill="#fff" text-anchor="middle" font-family="Bai Jamjuree,sans-serif">VAS</text>
      <text x="${it.x}" y="${it.y-it.h-60}" font-size="11" fill="#fff" text-anchor="middle" font-family="IBM Plex Sans Thai,sans-serif">ไม้กั้นอัจฉริยะ + LPR</text>`;
  const label = it => it.label ? `<g font-family="IBM Plex Sans Thai,sans-serif" font-size="20" font-weight="600"><line x1="${it.x}" y1="${it.t==='cab'?it.y-it.h*.5:it.y-(it.h||0)}" x2="${it.lx}" y2="${it.ly-6}" stroke="#ffd400" stroke-width="2"/>
      <text x="${it.lx}" y="${it.ly}" fill="#fff" paint-order="stroke" stroke="#000" stroke-width="4">${it.label}</text></g>` : '';
  function draw(id, key){
    const S = SITES[key], el = document.getElementById(id); if (!el) return;
    const show = document.getElementById(id+'-ov') ? document.getElementById(id+'-ov').checked : true;
    el.setAttribute('viewBox','0 0 '+S.w+' '+S.h);
    el.innerHTML = `<image href="${S.img}" x="0" y="0" width="${S.w}" height="${S.h}"/>` + (show ? S.items.map(it => ({cab,lpr,chk,sign})[it.t](it)).join('') + S.items.map(label).join('') : '');
  }
  window.PhotoOverlay = { draw, SITES };
  ['G1','G2','G3'].forEach(k => { const id='photo'+k; draw(id,k); const cb=document.getElementById(id+'-ov'); if (cb) cb.addEventListener('change',()=>draw(id,k)); });
})();
