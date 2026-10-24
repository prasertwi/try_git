// Clean vector redraw of the village plan (same pixel space as plan.jpg) + camera/node icons.
(function (root) {
  const OUTLINE = [[52,262],[108,258],[405,244],[405,214],[575,182],[795,190],[1020,192],[1020,128],[1225,96],[1238,190],[1180,300],[1150,352],[1145,378],[1140,410],[1085,582],[1040,590],[1038,520],[788,520],[797,365],[420,372],[75,388],[52,388]];
  const BLOCKS = [
    [108,262,100,100,'1–15'],[225,256,85,104,'16–27'],[318,252,85,108,'29–45'],[412,208,122,128,'47–91'],
    [534,186,116,36,'119–133'],[534,234,116,34,'105–117'],[545,306,100,36,'93–103'],
    [656,192,136,30,'167–181'],[656,234,136,34,'151–165'],[656,306,134,34,'135–149'],
    [814,206,92,20,'197–209'],[814,236,92,26,'183–195'],[914,206,126,20,'261–279'],[914,236,106,26,'243–259'],
    [902,306,148,44,'211–241'],[1022,132,76,82,'281–303'],[1120,104,102,88,'305–339'],[1102,214,112,30,'341–357'],
    [1086,254,96,40,'359–379'],[1068,304,80,44,'381–395'],
    [799,370,82,143,'531–583'],[890,368,150,32,'453–479'],[890,470,146,44,'481–529'],
    [1060,372,82,52,'397–415'],[1056,432,70,146,'417–451']
  ];
  const WATER = [
    'M135 293 q0 -6 6 -6 h35 q6 0 6 6 v36 q0 6 -6 6 h-35 q-6 0 -6 -6z',
    'M540 274 h255 v20 h-255z', 'M797 196 h10 v88 h-10z',
    'M912 274 L1000 270 L1058 236 L1080 226 L1074 252 L1040 286 L912 298z',
    'M893 406 L930 406 L990 440 L1037 440 L1037 462 L985 462 L925 428 L893 428z'
  ];
  const GREEN = [[810,286,88,60,'สโมสร / สวน'],[54,266,50,118,'']];
  const GATES = [{x:72,y:352,label:'ประตูหลัก',ang:90},{x:1060,y:352,label:'ประตูสี่แยกกลาง',ang:0}];
  // camera heading in degrees (0 = right/east on plan, 90 = down/south)
  const HEAD = {1:180,2:180,3:200,4:0,5:0,6:0,7:180,8:180,9:330,10:180,11:180,12:270,13:0,14:0,15:270,16:0,17:90,
    18:0,19:180,20:270,21:300,22:90,23:330,24:90,25:270,26:270,27:270,28:270,29:180,30:270};
  const FOV = { LPR:[30,22], WALL:[36,50], ROAD:[90,28], DOME:[100,18] }; // [deg, metres]

  function base(P) {
    let s = '';
    const pp = p => p.map(q=>q[0].toFixed(1)+','+q[1].toFixed(1)).join(' ');
    s += `<defs>
      <pattern id="plots" width="11" height="8" patternUnits="userSpaceOnUse"><rect width="11" height="8" fill="var(--m-block)"/><path d="M11 0V8M0 8H11" stroke="var(--m-plotline)" stroke-width=".6"/></pattern>
      <symbol id="ic-cam" viewBox="-12 -8 24 16"><rect x="-10" y="-6" width="15" height="12" rx="2.5"/><path d="M5 -3 L11 -6 V6 L5 3z"/></symbol>
    </defs>`;
    s += `<polygon points="${pp(OUTLINE)}" fill="var(--m-site)" stroke="var(--m-wall)" stroke-width="3" stroke-linejoin="round"/>`;
    GREEN.forEach(g => s += `<rect x="${g[0]}" y="${g[1]}" width="${g[2]}" height="${g[3]}" rx="6" fill="var(--m-green)"/>` + (g[4]?`<text x="${g[0]+g[2]/2}" y="${g[1]+g[3]/2+3}" class="m-lbl" text-anchor="middle">${g[4]}</text>`:''));
    // roads
    P.E.forEach(e => { const [a,b]=e.split('-'); s += `<line x1="${P.N[a][0]}" y1="${P.N[a][1]}" x2="${P.N[b][0]}" y2="${P.N[b][1]}" stroke="var(--m-road)" stroke-width="9" stroke-linecap="round"/>`; });
    s += `<polyline points="${pp(P.PUBLIC_ROAD)}" fill="none" stroke="var(--pub)" stroke-width="13" stroke-opacity=".55" stroke-linecap="round" stroke-linejoin="round"/>`;
    s += `<text class="m-lbl m-pub" x="560" y="384" text-anchor="middle">ถนนหัก ซอย 4 (ถนนสาธารณะ)</text><text class="m-lbl m-pub" x="34" y="362">← ทางหลวง 304</text><text class="m-lbl m-pub" x="1252" y="348" text-anchor="end">ชุมชนถนนหัก →</text>`;
    s += `<g transform="translate(1200 560) rotate(177)"><path d="M0 -22 L7 4 L0 -2 L-7 4Z" fill="var(--ink)"/><text y="-8" text-anchor="middle" class="m-gate" style="fill:var(--ink)" transform="rotate(-177) translate(0 -14)">N</text></g>`;
    s += ``;
    WATER.forEach(d => s += `<path d="${d}" fill="var(--m-water)"/>`);
    BLOCKS.forEach(b => s += `<rect x="${b[0]}" y="${b[1]}" width="${b[2]}" height="${b[3]}" rx="4" fill="url(#plots)" stroke="var(--m-plotline)" stroke-width=".8"/><text x="${b[0]+b[2]/2}" y="${b[1]+b[3]/2+3}" class="m-blk" text-anchor="middle">${b[4]}</text>`);
    return s;
  }
  function render(R, P, opt) {
    const sx = opt.sx, sy = opt.sy, sel = opt.sel; let s = base(P);
    const pp = p => p.map(q=>q[0].toFixed(1)+','+q[1].toFixed(1)).join(' ');
    // fibre backbone + selected UTP
    R.fibrePaths.forEach(p => s += `<polyline points="${pp(p)}" fill="none" stroke="var(--fibre)" stroke-width="2.6" stroke-dasharray="7 4" stroke-linejoin="round"/>`);
    if (sel) { const x = R.cams.find(c=>c.id===sel); s += `<polyline points="${pp(x.path)}" fill="none" stroke="var(--ink)" stroke-width="3"/>`; }
    if (opt.poles) opt.poles.forEach(p => s += p.kind==='PEA'
      ? `<g><circle cx="${p.x}" cy="${p.y}" r="3.2" fill="var(--panel)" stroke="var(--ink)" stroke-width="1.6"/><title>${p.id} เสา กฟภ. (Street View: ~40 ม.)</title></g>`
      : `<g><circle cx="${p.x}" cy="${p.y}" r="2.6" fill="var(--wall)" stroke="var(--panel)" stroke-width=".8"/><title>${p.id} เสาไฟถนนหมู่บ้าน (ประมาณ ทุก ~35 ม. รอยืนยัน)</title></g>`);
    // FOV cones
    R.cams.forEach(c => { const [deg,len]=FOV[c.type]; const h=HEAD[c.id]*Math.PI/180, a=deg*Math.PI/360;
      const pt = t => [c.x+Math.cos(t)*len/sx, c.y+Math.sin(t)*len/sy]; const p1=pt(h-a), p2=pt(h+a), pm=pt(h);
      s += `<path d="M${c.x} ${c.y} L${p1[0].toFixed(1)} ${p1[1].toFixed(1)} Q${(2*pm[0]-(p1[0]+p2[0])/2).toFixed(1)} ${(2*pm[1]-(p1[1]+p2[1])/2).toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}Z" fill="${opt.colors[c.type]}" fill-opacity="${sel===c.id?.35:.16}"/>`; });
    // gates
    GATES.forEach(g => s += `<g transform="translate(${g.x} ${g.y})"><rect x="-4" y="-14" width="8" height="28" rx="2" fill="var(--lpr)"/><rect x="-2" y="-12" width="4" height="24" fill="var(--panel)" opacity=".6"/></g><text class="m-gate" x="${g.x+(g.ang?-4:14)}" y="${g.y+(g.ang?36:-14)}" text-anchor="${g.ang?'start':'start'}">${g.label}</text>`);
    // nodes
    R.hubs.forEach(h => { if (h.node==='J2') return;
      s += `<g class="node"><rect x="${h.xy[0]-9}" y="${h.xy[1]-7}" width="18" height="14" rx="3" fill="var(--accent)" stroke="var(--panel)" stroke-width="1.5"/><text x="${h.xy[0]}" y="${h.xy[1]+3}" text-anchor="middle" class="m-node">${h.id}</text><title>${h.id} ${h.name}</title></g>`; });
    // NVR / juristic office
    s += `<g><rect x="${P.NVR.x-14}" y="${P.NVR.y-6}" width="28" height="22" rx="3" fill="var(--accent)" stroke="var(--panel)" stroke-width="2"/>
      <path d="M${P.NVR.x-9} ${P.NVR.y} h18 M${P.NVR.x-9} ${P.NVR.y+5} h18 M${P.NVR.x-9} ${P.NVR.y+10} h18" stroke="var(--panel)" stroke-width="2"/>
      <text class="m-gate" x="${P.NVR.x}" y="${P.NVR.y+30}" text-anchor="middle" style="fill:var(--accent)">นิติ / NVR</text></g>`;
    // cameras
    R.cams.forEach(c => { const big = sel===c.id;
      s += `<g class="cam" data-id="${c.id}" transform="translate(${c.x} ${c.y})">
        <circle r="${big?13:11}" fill="var(--panel)" stroke="${opt.colors[c.type]}" stroke-width="2.5"/>
        <use href="#ic-cam" x="-8" y="-5.5" width="16" height="11" fill="${opt.colors[c.type]}" transform="rotate(${HEAD[c.id]})"/>
        <g transform="translate(9 -10)"><circle r="7" fill="${opt.colors[c.type]}"/><text y="3" text-anchor="middle" class="m-num">${c.id}</text></g>
        <title>#${c.id} ${c.name} · UTP ${c.cable} ม.</title></g>`; });
    return s;
  }
  root.SiteMap = { base, render, HEAD, FOV, GATES };
})(typeof window !== 'undefined' ? window : globalThis);
