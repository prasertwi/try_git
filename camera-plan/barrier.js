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
    { id:'G1', name:'ประตูหน้า (ป้อมกลางถนน)', x:72, y:352, path:pathG1, media:'fibre' },
    { id:'G2', name:'ไม้กั้นหลัง สี่แยกกลาง ฝั่งใต้ของซอย 4', x:1060, y:340, path:[OFF, P.N.J2, P.N.G, [1060,340]], media:'utp' },
    { id:'G3', name:'ไม้กั้นหลัง สี่แยกกลาง ฝั่งเหนือของซอย 4 (เข้าโซนนิติ)', x:1046, y:376, path:[OFF, [1040,384], [1046,376]], media:'utp' }
  ];
  const ROLE = {
    LPRI:{ t:'LPR ขาเข้า', m:'เสาเตี้ย สูง 1.2–1.5 ม. (G1 ข้างป้อมกลางถนน / G2–G3 ริมถนนข้างตู้เดิม) จับป้ายที่ 4–6 ม.', len:10, lpr:1 },
    LPRO:{ t:'LPR ขาออก', m:'เสาเตี้ย สูง 1.2–1.5 ม. (G1 ข้างป้อมกลางถนน / G2–G3 ริมถนนข้างตู้เดิม) จับป้ายที่ 4–6 ม.', len:10, lpr:1 },
    CHKI:{ t:'เช็ครถขาเข้า (หน้ารถ+คนขับ)', m:'G1 มุมป้อม / G2–G3 ป้อมหรือเสาข้างเลน สูง 2.5–3 ม. ระยะ 5–8 ม.', len:12 },
    CHKO:{ t:'เช็ครถขาออก (หน้ารถ+คนขับ)', m:'เสาข้างเลน สูง 2.5–3 ม. ระยะ 5–8 ม.', len:14 }
  };
  const CAMS = []; GATES.forEach((g,i) => ['LPRI','LPRO','CHKI','CHKO'].forEach((r,j) => CAMS.push({ id:'B'+(i*4+j+1), g, r, cable: Math.ceil(ROLE[r].len*1.1+8) })));
  const MODELS = {
    dahua:{ LPR:'Dahua ITC413-PW4D-IZ1 (ANPR 4MP, 3–8 ม., PoE+, relay เปิดไม้กั้น)', CHK:'Dahua IPC-HFW2441T-ZS (4MP ซูม 2.7–13.5 มม.)', NVR:'Dahua NVR5416-EI (16CH, 4 SATA, AI/ANPR)', SW:'Dahua PoE switch 8 พอร์ต + 1 SFP (Hi-PoE)', SOFT:'Dahua DSS Express (จัดการ whitelist/ประวัติรถ)', codec:'Smart H.265+' },
    unv:{ LPR:'Uniview LPR 4MP (ซีรีส์ LPR/ANPR, relay เปิดไม้กั้น)', CHK:'Uniview 4MP Varifocal Bullet (2.8–12 มม.)', NVR:'Uniview NVR304-16X (16CH, 4 SATA)', SW:'Uniview PoE switch 8 พอร์ต + 1 SFP', SOFT:'Uniview LPR/Parking management software', codec:'Ultra 265' }
  };
  const PRICE0 = { NET:3500, LPR:12000, CHK:3900, NVR:16000, HDD4:4200, HDD6:5600, HDD8:7200, HDD10:9200, HDD12:10500, HDD16:14500, SW:5500, CAB:3500, LPOLE:2500, CPOLE:1800, UTP:3800, FIB:9, SFP:1200, INT:3500, SOFT:15000, MON:4500, LAB:1500, COM:12000 };
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
    $('netnote').textContent = share ? 'ใช้ network ร่วมกับงาน CCTV: G1 ใช้ core สำรองในสาย Fiber ของงาน CCTV, G2/G3 ต่อ UTP เข้า Core switch ที่นิติ (VLAN 20) งานนี้ไม่คิดค่าสาย Fiber และ core switch'
      : 'ไม่ใช้ network ร่วม: งานนี้ต้องลากสาย Fiber ของตัวเองไป G1 และต้องมี switch ที่นิติเอง';
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
    const rows = [
      ['LPR','กล้องอ่านป้ายทะเบียน', M.LPR, 6], ['CHK','กล้องเช็ครถเข้า–ออก', M.CHK, 6],
      ['NVR','เครื่องบันทึก NVR งานไม้กั้น', M.NVR+' · '+M.codec, 1], ['HDD'+best.sz,'HDD Surveillance '+best.sz+' TB', 'เก็บ '+days+' วัน', best.n],
      ['SW','PoE+ switch ประจำจุด (802.3at)', M.SW, 3], ['CAB','ตู้กันน้ำ IP65 + กันฟ้าผ่า + ปลั๊กไฟ', 'ประจำจุด', 3],
      ['LPOLE','เสาเตี้ยกล้อง LPR 1.2–1.5 ม.', 'รวมฐาน', 6], ['CPOLE','เสา/ขาจับกล้องเช็ครถ', 'สูง 2.5–3 ม.', 6],
      ['UTP','สาย UTP Cat6 Outdoor (กล่อง 305 ม.)', f0(utpM)+' ม. + เผื่อ 10%', Math.ceil(utpM*1.1/305)],
      ['FIB','สาย Fiber Single-mode มีสลิง (ม.)', share ? 'G1 ใช้ core สำรองของงาน 30 จุด' : 'G1 → นิติ', fibM],
      ['SFP','โมดูล SFP BiDi Single-mode (คู่)', share ? 'G1 ใช้ core สำรองในสายงาน CCTV' : 'ต่อ 1 ลิงก์ Fiber', sfp],
      ['NET','เชื่อมเข้า Core switch ร่วม + ตั้ง VLAN LPR', 'patch cord, ป้ายสาย, ตั้งค่า', share ? 1 : 0],
      ['INT','เชื่อมสั่งเปิดไม้กั้น (relay/Wiegand + เดินสายสัญญาณ)', 'ต่อจุด', 3],
      ['SOFT','โปรแกรมจัดการ LPR / whitelist ลูกบ้าน', M.SOFT, 1], ['MON','จอดูภาพที่ป้อม 22–24 นิ้ว', 'ต่อจุด', 3],
      ['LAB','ค่าติดตั้งกล้อง', 'ต่อจุด', 12], ['COM','ตั้งค่า LPR จูนมุมป้าย ทดสอบ อบรม รปภ.', 'เหมา', 1]
    ];
    let sub=0;
    $('bom').innerHTML = rows.filter(r=>r[3]>0).map(([k,a,m,q]) => { const t=q*PRICE[k]; sub+=t;
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
  // lane diagrams, 1 m = 16 px. Thai left-hand traffic: IN lane on top (→), OUT lane below (←).
  //  kerb   = existing back gates G2/G3: no island, VAS117 cabinets at each roadside, arms reach the centre line
  //  island = standard design for G1 until the front gate is confirmed
  function drawLane(id, mode){
    const U = 16; let s = '', t = '';
    const T = (x,y,txt,cls,anchor) => t += `<text class="${cls}" x="${x}" y="${y}"${anchor?` text-anchor="${anchor}"`:''}>${txt}</text>`;
    const cam = (x,y,deg,len,fov,col,lbl,tx,ty,anc) => { const h=deg*Math.PI/180, a=fov*Math.PI/360, L=len*U;
      s += `<path d="M${x} ${y} L${x+Math.cos(h-a)*L} ${y+Math.sin(h-a)*L} L${x+Math.cos(h+a)*L} ${y+Math.sin(h+a)*L}Z" fill="${col}" fill-opacity=".18"/>`;
      s += `<circle cx="${x}" cy="${y}" r="10" fill="${col}" stroke="var(--panel)" stroke-width="2"/>`; T(x,y+4,lbl,'l-cam','middle');
      T(tx,ty,{L1:'LPR ขาเข้า',L2:'LPR ขาออก',C1:'เช็ครถขาเข้า',C2:'เช็ครถขาออก'}[lbl],'l-lbl',anc); };
    s += `<rect x="0" y="0" width="660" height="300" fill="var(--panel)"/>`;
    if (mode==='island') {
      // G1 front gate: guardhouse in the middle of the road, barriers fixed to the booth, cameras beside the booth
      const top=40, i1=96, i2=144, bot=200;
      s += `<rect x="20" y="${top}" width="620" height="${bot-top}" fill="var(--m-road)" stroke="var(--line)"/><rect x="20" y="${i1}" width="620" height="${i2-i1}" fill="var(--m-green)"/>`;
      s += `<rect x="296" y="${i1+4}" width="38" height="${i2-i1-8}" rx="4" fill="var(--m-block)" stroke="var(--m-wall)"/>`; T(315,124,'ป้อม','l-lbl','middle');
      s += `<rect x="284" y="${top}" width="7" height="${i1-top}" fill="var(--lpr)"/><rect x="339" y="${i2}" width="7" height="${bot-i2}" fill="var(--lpr)"/>`;
      s += `<rect x="281" y="${i1-2}" width="13" height="10" rx="2" fill="var(--ink)"/><rect x="336" y="${i2-8}" width="13" height="10" rx="2" fill="var(--ink)"/>`;
      T(30,top+30,'มาจากถนนนอก','l-dim'); T(585,top+30,'ขาเข้า →','l-dim'); T(30,bot-20,'← ขาออก','l-dim'); T(530,bot-20,'มาจากในหมู่บ้าน','l-dim');
      s += `<rect x="${288-5.5*U-70}" y="${top+10}" width="70" height="36" rx="9" fill="var(--muted)" opacity=".5"/><rect x="${342+5.5*U}" y="${i2+10}" width="70" height="36" rx="9" fill="var(--muted)" opacity=".5"/>`;
      cam(272,112,208,5.5,24,'var(--lpr)','L1',150,124); cam(296,100,200,7,36,'var(--road)','C1',150,30);
      cam(358,128,16,5.5,24,'var(--lpr)','L2',380,124); cam(334,140,12,7,36,'var(--road)','C2',420,228);
      T(298,24,'ตู้ VAS117 ติดป้อม · ไม้กั้นขาเข้า','l-lbl'); T(352,228,'ตู้ VAS117 ติดป้อม · ไม้กั้นขาออก','l-lbl','end');
      T(20,292,'ของเดิม: ป้อมกลางถนน · ไม้กั้นติดป้อม · กล้องข้างป้อม · รถวิ่งชิดซ้าย · เลน 3.5 ม.','l-dim');
    } else {
      // G2/G3 back gates: no island, VAS117 cabinets at each roadside, arms reach the centre line
      const top=100, mid=156, bot=212;
      s += `<rect x="20" y="${top}" width="620" height="${bot-top}" fill="var(--m-road)" stroke="var(--line)"/><path d="M20 ${mid} H640" stroke="#e0b400" stroke-width="2" stroke-dasharray="14 10"/>`;
      T(30,top+32,'มาจากถนนนอก (ซอย 4)','l-dim'); T(580,top+32,'ขาเข้า →','l-dim'); T(30,bot-22,'← ขาออก','l-dim'); T(530,bot-22,'มาจากในหมู่บ้าน','l-dim');
      s += `<rect x="356" y="${top}" width="8" height="56" fill="var(--lpr)"/><rect x="296" y="${mid}" width="8" height="56" fill="var(--lpr)"/>`;
      s += `<rect x="353" y="${top-12}" width="14" height="10" rx="2" fill="var(--ink)"/><rect x="293" y="${bot+2}" width="14" height="10" rx="2" fill="var(--ink)"/>`;
      T(372,top+18,'ตู้ VAS117 ริมถนน (ตำแหน่งเดิม)','l-lbl'); T(288,bot-8,'ตู้ VAS117 ริมถนน (ตำแหน่งเดิม)','l-lbl','end');
      s += `<rect x="440" y="4" width="80" height="40" rx="4" fill="var(--m-block)" stroke="var(--m-wall)"/>`; T(480,30,'ป้อม รปภ.','l-lbl','middle');
      s += `<rect x="528" y="12" width="34" height="26" rx="3" fill="var(--accent)"/><text class="m-node" x="545" y="28" text-anchor="middle" style="font-size:8px">ตู้ PoE</text>`;
      s += `<rect x="${360-5.5*U-70}" y="${top+10}" width="70" height="36" rx="9" fill="var(--muted)" opacity=".5"/><rect x="${300+5.5*U}" y="${mid+10}" width="70" height="36" rx="9" fill="var(--muted)" opacity=".5"/>`;
      cam(338,top-14,170,5.5,24,'var(--lpr)','L1',220,top-30); cam(318,bot+16,-10,5.5,24,'var(--lpr)','L2',340,bot+42);
      cam(430,top-14,168,7,36,'var(--road)','C1',446,top-10); cam(240,bot+16,-15,7,36,'var(--road)','C2',120,bot+42);
      T(20,292,'ของเดิม: ไม้กั้นติดข้างถนน · ไม่มีเกาะกลาง · รถวิ่งชิดซ้าย · เลน 3.5 ม.','l-dim');
    }
    $(id).innerHTML = s + t;
  }
  drawLane('lane','kerb'); drawLane('lane1','island');
  ['brand','days','codec','share','up1','up2','up3'].forEach(id => $(id).addEventListener('change', run));
  $('bom').addEventListener('change', e => { const k=e.target.dataset.k; if(!k) return; PRICE[k]=Math.max(0,+e.target.value||0);
    try{ localStorage.setItem('bprice', JSON.stringify(PRICE)); }catch(err){} run(); });
  $('preset').addEventListener('click', () => { PRICE=Object.assign({},PRICE0); try{localStorage.removeItem('bprice');}catch(e){} run(); });
  run();
})();
