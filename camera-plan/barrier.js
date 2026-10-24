(function(){
  const P = window.CamPlan, $ = id => document.getElementById(id);
  const f0 = n => Math.round(n).toLocaleString('th-TH');
  const sx = P.DEFAULT.sx, sy = P.DEFAULT.sy;
  const d = (a,b) => Math.hypot((a[0]-b[0])*sx, (a[1]-b[1])*sy);
  const route = pts => pts.slice(1).reduce((s,p,i)=>s+d(pts[i],p),0);
  const OFF = [P.NVR.x, P.NVR.y];
  // G1 path: office -> main road -> west gate (same road nodes as the 30-camera plan)
  const pathG1 = [OFF, P.N.J2, P.N.C0, P.N.W6, P.N.W5, P.N.W4, P.N.W3, P.N.W2, P.N.P1, P.N.W1, P.N.W0];
  const GATES = [
    { id:'G1', name:'ประตูหน้า (ต้นซอย 4 ฝั่งตะวันตก)', x:72, y:352, path:pathG1, media:'fibre' },
    { id:'G2', name:'ไม้กั้นหลัง ฝั่งเหนือของซอย 4', x:1060, y:340, path:[OFF, P.N.J2, P.N.G, [1060,340]], media:'utp' },
    { id:'G3', name:'ไม้กั้นหลัง ฝั่งใต้ของซอย 4 (เข้าโซนนิติ)', x:1046, y:376, path:[OFF, [1040,384], [1046,376]], media:'utp' }
  ];
  const ROLE = {
    LPRI:{ t:'LPR ขาเข้า', m:'เสาเตี้ยเกาะกลาง สูง 1.2–1.5 ม. จับป้ายที่ 4–6 ม.', len:10, lpr:1 },
    LPRO:{ t:'LPR ขาออก', m:'เสาเตี้ยเกาะกลาง สูง 1.2–1.5 ม. จับป้ายที่ 4–6 ม.', len:10, lpr:1 },
    CHKI:{ t:'เช็ครถขาเข้า (หน้ารถ+คนขับ)', m:'ป้อม/เสา ฝั่งคนขับ สูง 2.5–3 ม. ระยะ 5–8 ม.', len:12 },
    CHKO:{ t:'เช็ครถขาออก (หน้ารถ+คนขับ)', m:'เสาฝั่งคนขับ สูง 2.5–3 ม. ระยะ 5–8 ม.', len:14 }
  };
  const CAMS = []; GATES.forEach((g,i) => ['LPRI','LPRO','CHKI','CHKO'].forEach((r,j) => CAMS.push({ id:'B'+(i*4+j+1), g, r, cable: Math.ceil(ROLE[r].len*1.1+8) })));
  const MODELS = {
    dahua:{ LPR:'Dahua ITC413-PW4D-IZ1 (ANPR 4MP, relay เปิดไม้กั้น)', CHK:'Dahua IPC-HFW2441T-ZS (4MP ซูม 2.7–13.5 มม.)', NVR:'Dahua NVR5416-EI (16CH, 4 SATA, AI/ANPR)', SW:'Dahua PoE switch 8 พอร์ต + 1 SFP (Hi-PoE)', SOFT:'Dahua DSS Express (จัดการ whitelist/ประวัติรถ)', codec:'Smart H.265+' },
    unv:{ LPR:'Uniview LPR 4MP (ซีรีส์ LPR/ANPR, relay เปิดไม้กั้น)', CHK:'Uniview 4MP Varifocal Bullet (2.8–12 มม.)', NVR:'Uniview NVR304-16X (16CH, 4 SATA)', SW:'Uniview PoE switch 8 พอร์ต + 1 SFP', SOFT:'Uniview LPR/Parking management software', codec:'Ultra 265' }
  };
  const PRICE0 = { LPR:12000, CHK:3900, NVR:16000, HDD:0, SW:5500, CAB:3500, LPOLE:2500, CPOLE:1800, UTP:3800, FIB:9, SFP:1200, INT:3500, SOFT:15000, MON:4500, LAB:1500, COM:12000 };
  let PRICE = Object.assign({}, PRICE0);
  try { Object.assign(PRICE, JSON.parse(localStorage.getItem('bprice')||'{}')); } catch(e) {}
  const up0 = GATES.map(g => Math.round(route(g.path)));
  try { const u = JSON.parse(localStorage.getItem('bup')||'null'); if (u) u.forEach((v,i)=>{ if (v) up0[i]=v; }); } catch(e) {}
  [$('up1'),$('up2'),$('up3')].forEach((el,i) => el.value = up0[i]);

  function run(){
    const M = MODELS[$('brand').value], ups = [+$('up1').value||0, +$('up2').value||0, +$('up3').value||0], share = $('share').checked;
    try { localStorage.setItem('bup', JSON.stringify(ups)); } catch(e) {}
    // uplinks: fibre for G1; UTP if <= 90 m after slack, else fibre
    const link = GATES.map((g,i) => { const cab = Math.ceil(ups[i]*1.1+8); const fibre = g.media==='fibre' || cab>90;
      return { g, fibre, len: fibre ? Math.ceil(ups[i]*1.1+20) : cab }; });
    const fibM = link.filter(l=>l.fibre && !(l.g.id==='G1' && share)).reduce((s,l)=>s+l.len,0);
    const sfp = link.filter(l=>l.fibre).length;
    const utpM = CAMS.reduce((s,c)=>s+c.cable,0) + link.filter(l=>!l.fibre).reduce((s,l)=>s+l.len,0);
    $('links').innerHTML = link.map(l => `<div class="tile"><b>${l.fibre ? (l.g.id==='G1'&&share ? 'Fiber (core สำรอง)' : 'Fiber '+f0(l.len)+' ม.') : 'UTP '+l.len+' ม.'}</b><span>${l.g.id} → นิติ</span></div>`).join('');
    // storage
    const days = +$('days').value, br = +$('codec').value;
    const mbps = 6*4 + 6*br, tb = mbps*86400/8/1e6*days*1.1;
    let best=null; [2,4].forEach(n => [4,6,8,10,12,16].forEach(sz => { if (n*sz>=tb && (!best || n*sz<best.t || (n*sz===best.t && n<best.n))) best={n,sz,t:n*sz}; }));
    $('stor').innerHTML = [[mbps.toFixed(0)+' Mbps','บิตเรตรวม 12 กล้อง'],[tb.toFixed(1)+' TB','ต้องการ '+days+' วัน (+10%)'],[best.n+' × '+best.sz+' TB','HDD (NVR 4 ช่อง)']]
      .map(([b,t])=>`<div class="tile"><b>${b}</b><span>${t}</span></div>`).join('');
    $('opt-smart').textContent = M.codec+' – ~1.5 Mbps';
    $('tiles').innerHTML = [['3 จุด','ไม้กั้น G1–G3'],['6','กล้อง LPR'],['6','กล้องเช็ครถ'],[f0(utpM)+' ม.','สาย UTP รวม'],[fibM?f0(fibM)+' ม.':'ใช้ core สำรอง','Fiber ใหม่']]
      .map(([b,t])=>`<div class="tile"><b>${b}</b><span>${t}</span></div>`).join('');
    $('rows').innerHTML = CAMS.map(c => `<tr><td class="n">${c.id}</td><td>${c.g.id} · ${c.g.name}</td><td><span class="pill" style="background:${ROLE[c.r].lpr?'var(--lpr)':'var(--road)'}">${ROLE[c.r].t}</span></td><td>${ROLE[c.r].m}</td><td class="n">${c.cable}</td></tr>`).join('');
    // quote
    const hddP = { 4:4200, 6:5600, 8:7200, 10:9200, 12:10500, 16:14500 }[best.sz];
    if (!PRICE.HDD_user) PRICE.HDD = hddP;
    const rows = [
      ['LPR','กล้องอ่านป้ายทะเบียน', M.LPR, 6], ['CHK','กล้องเช็ครถเข้า–ออก', M.CHK, 6],
      ['NVR','เครื่องบันทึก NVR งานไม้กั้น', M.NVR+' · '+M.codec, 1], ['HDD','HDD Surveillance '+best.sz+' TB', 'เก็บ '+days+' วัน', best.n],
      ['SW','PoE switch ประจำจุด', M.SW, 3], ['CAB','ตู้กันน้ำ IP65 + กันฟ้าผ่า + ปลั๊กไฟ', 'ประจำจุด', 3],
      ['LPOLE','เสาเตี้ยกล้อง LPR 1.2–1.5 ม.', 'รวมฐาน', 6], ['CPOLE','เสา/ขาจับกล้องเช็ครถ', 'สูง 2.5–3 ม.', 6],
      ['UTP','สาย UTP Cat6 Outdoor (กล่อง 305 ม.)', f0(utpM)+' ม. + เผื่อ 10%', Math.ceil(utpM*1.1/305)],
      ['FIB','สาย Fiber Single-mode มีสลิง (ม.)', share ? 'G1 ใช้ core สำรองของงาน 30 จุด' : 'G1 → นิติ', fibM],
      ['SFP','โมดูล SFP Single-mode (คู่)', 'ต่อ 1 ลิงก์ Fiber', sfp],
      ['INT','เชื่อมสั่งเปิดไม้กั้น (relay/Wiegand + เดินสายสัญญาณ)', 'ต่อจุด', 3],
      ['SOFT','โปรแกรมจัดการ LPR / whitelist ลูกบ้าน', M.SOFT, 1], ['MON','จอดูภาพที่ป้อม 22–24 นิ้ว', 'ต่อจุด', 3],
      ['LAB','ค่าติดตั้งกล้อง', 'ต่อจุด', 12], ['COM','ตั้งค่า LPR จูนมุมป้าย ทดสอบ อบรม รปภ.', 'เหมา', 1]
    ];
    let sub=0;
    $('bom').innerHTML = rows.map(([k,a,m,q]) => { const t=q*PRICE[k]; sub+=t;
      return `<tr><td>${a}</td><td class="m">${m}</td><td class="n">${f0(q)}</td><td class="n"><input id="p_${k}" data-k="${k}" type="number" min="0" step="1" value="${PRICE[k]}" aria-label="ราคา ${a}"></td><td class="n">${f0(t)}</td></tr>`; }).join('');
    $('qfoot').innerHTML = `<tr><td colspan="4">รวมก่อน VAT</td><td class="n">${f0(sub)}</td></tr><tr><td colspan="4">VAT 7%</td><td class="n">${f0(sub*.07)}</td></tr><tr><td colspan="4"><b>รวมทั้งสิ้น</b></td><td class="n"><b>${f0(sub*1.07)}</b></td></tr>`;
    drawLoc(link);
  }
  const pp = p => p.map(q=>q[0].toFixed(1)+','+q[1].toFixed(1)).join(' ');
  function drawLoc(link){
    let s = window.SiteMap.base(P);
    link.forEach(l => s += `<polyline points="${pp(l.g.path)}" fill="none" stroke="${l.fibre?'var(--fibre)':'var(--road)'}" stroke-width="3" stroke-dasharray="${l.fibre?'7 4':'0'}"/>`);
    s += `<rect x="${P.NVR.x-14}" y="${P.NVR.y-6}" width="28" height="22" rx="3" fill="var(--accent)" stroke="var(--panel)" stroke-width="2"/><text class="m-gate" x="${P.NVR.x+20}" y="${P.NVR.y+30}" style="fill:var(--accent)">นิติ / NVR</text>`;
    GATES.forEach((g,i) => { const lx = g.id==='G1' ? g.x+18 : g.x+20, ly = g.id==='G1' ? g.y-16 : g.id==='G2' ? g.y-12 : g.y+24;
      s += `<g transform="translate(${g.x} ${g.y})"><circle r="13" fill="var(--lpr)" stroke="var(--panel)" stroke-width="2"/><text y="4" text-anchor="middle" class="m-num" style="font-size:10px">${g.id}</text></g>
        <text class="m-gate" x="${lx}" y="${ly}">${g.id==='G1' ? g.id+' '+g.name.split(' (')[0]+' · ' : g.id+' · '}B${i*4+1}–B${i*4+4}</text>`; });
    $('locmap').innerHTML = s;
  }
  // standard lane diagram, 1 m = 16 px
  (function drawLane(){
    const U = 16; let s = '';
    s += `<rect x="0" y="0" width="660" height="300" fill="var(--panel)"/>`;
    s += `<rect x="20" y="60" width="620" height="56" fill="var(--m-road)" stroke="var(--line)"/><rect x="20" y="150" width="620" height="56" fill="var(--m-road)" stroke="var(--line)"/>`;
    s += `<rect x="20" y="116" width="620" height="34" fill="var(--m-green)"/>`;
    s += `<text class="l-dim" x="30" y="92">← ขาออก</text><text class="l-dim" x="580" y="182">ขาเข้า →</text>`;
    s += `<text class="l-dim" x="30" y="182">มาจากถนนนอก</text><text class="l-dim" x="545" y="92">มาจากในหมู่บ้าน</text>`;
    // barriers
    s += `<rect x="356" y="148" width="8" height="60" fill="var(--lpr)"/><rect x="296" y="58" width="8" height="60" fill="var(--lpr)"/>`;
    s += `<text class="l-lbl" x="368" y="226">ไม้กั้นขาเข้า</text><text class="l-lbl" x="312" y="50">ไม้กั้นขาออก</text>`;
    // guardhouse below IN lane (driver side)
    s += `<rect x="372" y="214" width="80" height="50" rx="4" fill="var(--m-block)" stroke="var(--m-wall)"/><text class="l-lbl" x="412" y="244" text-anchor="middle">ป้อม รปภ.</text>`;
    s += `<rect x="460" y="226" width="34" height="26" rx="3" fill="var(--accent)"/><text class="m-node" x="477" y="242" text-anchor="middle" style="font-size:8px">ตู้ PoE</text>`;
    // cars
    s += `<rect x="${360-5.5*U-70}" y="160" width="70" height="36" rx="9" fill="var(--muted)" opacity=".5"/><rect x="${300+5.5*U}" y="70" width="70" height="36" rx="9" fill="var(--muted)" opacity=".5"/>`;
    const cam = (x,y,deg,len,fov,col,lbl,tx,ty) => { const h=deg*Math.PI/180, a=fov*Math.PI/360, L=len*U;
      s += `<path d="M${x} ${y} L${x+Math.cos(h-a)*L} ${y+Math.sin(h-a)*L} L${x+Math.cos(h+a)*L} ${y+Math.sin(h+a)*L}Z" fill="${col}" fill-opacity=".18"/>`;
      s += `<circle cx="${x}" cy="${y}" r="11" fill="${col}" stroke="var(--panel)" stroke-width="2"/><text class="l-cam" x="${x}" y="${y+4}" text-anchor="middle">${lbl}</text>`;
      s += `<text class="l-lbl" x="${tx}" y="${ty}">${lbl==='L1'?'LPR ขาเข้า':lbl==='L2'?'LPR ขาออก':lbl==='C1'?'เช็ครถขาเข้า':'เช็ครถขาออก'}</text>`; };
    cam(330,140,165,5.5,24,'var(--lpr)','L1',200,141);
    cam(330,124,-15,5.5,24,'var(--lpr)','L2',430,133);
    cam(372,218,195,7,36,'var(--road)','C1',260,232);
    cam(240,52,15,7,36,'var(--road)','C2',120,40);
    // dims
    s += `<path d="M${360-6*U} 214 V222 M${360-6*U} 218 H${360-4*U} M${360-4*U} 214 V222" stroke="var(--lpr)" stroke-width="1.5"/><text class="l-dim" x="${360-6*U}" y="292">LPR จับป้ายที่ 4–6 ม. ก่อนไม้กั้น</text>`;
    s += `<text class="l-dim" x="470" y="292">เลน 3.5 ม. · เกาะกลาง 2 ม.</text>`;
    $('lane').innerHTML = s;
  })();
  ['brand','days','codec','share','up1','up2','up3'].forEach(id => $(id).addEventListener('change', run));
  $('bom').addEventListener('change', e => { const k=e.target.dataset.k; if(!k) return; PRICE[k]=Math.max(0,+e.target.value||0); if(k==='HDD') PRICE.HDD_user=1;
    try{ localStorage.setItem('bprice', JSON.stringify(PRICE)); }catch(err){} run(); });
  $('preset').addEventListener('click', () => { PRICE=Object.assign({},PRICE0); try{localStorage.removeItem('bprice');}catch(e){} run(); });
  run();
})();
