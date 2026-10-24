// Camera plan data + cable routing for หมู่บ้านแลนด์แอนด์เฮ้าส์พาร์ค (โคราช).
// Coordinates are pixels on plan.jpg (1264x757). Scale is set by two measured distances.
(function (root) {
  const NVR = { x: 1027, y: 385 };
  // Public road (green line from the owner) running north-south through the east part
  const PUBLIC_ROAD = [[1100,108],[1115,150],[1110,190],[1080,240],[1062,300],[1056,345],[1048,420],[1043,500],[1038,575]];
  function roadX(y){ const R=PUBLIC_ROAD; if (y<=R[0][1]) return R[0][0]; for (let i=1;i<R.length;i++) if (y<=R[i][1]) { const t=(y-R[i-1][1])/(R[i][1]-R[i-1][1]); return R[i-1][0]+t*(R[i][0]-R[i-1][0]); } return R[R.length-1][0]; }
  // 'W' = NVR side, 'E' = across the public road, 'R' = on the public road itself
  const side = (x,y) => { const dx = x-roadX(y); return Math.abs(dx)<=9 ? 'R' : dx>0 ? 'E' : 'W'; };
  // Road nodes (centre line of roads as read from the plan)
  const N = {
    W0:[78,368], W1:[210,368], P1:[305,367], W2:[415,366], W3:[540,361], W4:[652,358], W5:[800,356], W6:[885,358],
    C0:[930,358], J2:[1027,358], G:[1058,357], E1:[1145,357],
    L1:[115,345], L2:[115,268], L3:[195,268], L4:[200,345],
    P2:[305,320], P3:[360,300], P4:[385,262],
    M7:[415,300], M8:[450,240], M5:[540,228], M4:[540,300], M1:[652,300], M2:[652,228], M6:[800,300], NC:[812,228], ND:[812,198], NE:[1040,198], NA:[910,262], NB:[910,228],
    N0:[1058,300], N1:[1080,240], N2:[1110,200], N3:[1110,115], Q0:[1110,160], Q1:[1205,152], Q2:[1218,207], Q3:[1200,247],
    S1:[1048,372], S2:[1045,430], S3:[1045,500], S4:[1045,585], T1:[1120,430], T2:[1110,465], S5:[1045,465],
    V0:[795,362], V1:[795,397], V2:[795,430], V3:[795,465], V4:[795,500],
    X1:[885,397], X2:[885,430], X3:[885,465], X4:[885,500], Y3:[960,465], Y4:[960,500], C1:[960,395], C2:[1010,410]
  };
  const E = [
    'W0-W1','W1-P1','P1-W2','W2-W3','W3-W4','W4-W5','W5-W6','W6-C0','C0-J2','J2-G','G-E1',
    'W0-L1','L1-L2','L2-L3','L3-L4','L4-W1','L1-L4',
    'P1-P2','P2-P3','P3-P4','W2-M7','M7-M8','M8-M5','M7-M4','W3-M4','M4-M5','M4-M1','W4-M1','M1-M2','M5-M2','M1-M6','W5-M6','M6-NC','M2-NC','NC-ND','ND-NE','NC-NB','NB-NA','NB-NE','NA-N0','NE-N1',
    'G-N0','N0-N1','N1-N2','N2-Q0','Q0-N3','Q0-Q1','N2-Q2','N1-Q3',
    'G-S1','S1-S2','S2-S5','S5-S3','S3-S4','S2-T1','S5-T2',
    'V0-W5','V0-V1','V1-V2','V2-V3','V3-V4','W6-X1','X1-X2','X2-X3','X3-X4','V1-X1','V2-X2','V3-X3','V4-X4','X4-Y4','Y4-S3','X3-Y3','Y3-S5',
    'C0-C1','C1-C2','C2-S2'
  ];
  // Fixed hubs: NVR room and the guardhouse (both have power). Extra PoE cabinets are placed automatically.
  const FIXED_HUBS = [ { node:'J2', name:'ห้องนิติ (NVR + PoE switch หลัก)' }, { node:'W0', name:'ป้อมประตูหลัก' } ];
  const T = { LPR:'กล้องอ่านป้ายทะเบียน (LPR)', WALL:'Bullet IR 4MP (กำแพง)', ROAD:'Bullet 4MP (ถนน/แยก)', DOME:'Turret/Dome 4MP ColorVu' };
  const CAMS = [
    [1,'ประตูหลัก – LPR ขาเข้า','LPR',84,352],
    [2,'ประตูหลัก – LPR ขาออก','LPR',84,382],
    [3,'ประตูหลัก – ถนนหน้าประตู (มุมกว้าง)','ROAD',100,366],
    [4,'ถนนเมน หน้าแปลง 15–19','ROAD',190,374],
    [5,'บึง/สวน แปลง 1–15 (ริมถนนวงรอบ)','DOME',117,305],
    [6,'กำแพงเหนือ แปลง 9–27 (มุมถนน)','WALL',195,264],
    [7,'ถนนเมน แยกแปลง 43/57','ROAD',415,373],
    [8,'กำแพงเหนือ แปลง 29–33 (ปลายถนน)','WALL',385,262],
    [9,'กำแพงเหนือ แปลง 79–91 (ริมถนน)','WALL',470,236],
    [10,'ถนนเมน แยกแปลง 47/99','ROAD',540,367],
    [11,'กำแพงเหนือ ปลายถนน แปลง 119/175','WALL',652,200],
    [12,'คลอง/สวนกลาง ฝั่งตะวันตก','DOME',590,300],
    [13,'ถนนเมน แยกแปลง 93/143','ROAD',652,364],
    [14,'กำแพงเหนือ มุมคลอง แปลง 181/203','WALL',812,202],
    [15,'คลอง/สวนกลาง ฝั่งตะวันออก','DOME',730,300],
    [16,'สโมสร/ลานกลาง (ริมถนน)','DOME',800,322],
    [17,'แยกถนนเมน–โซนใต้','ROAD',885,364],
    [18,'กำแพงเหนือ แปลง 203–209 (ริมถนน)','WALL',900,198],
    [19,'กำแพงเหนือ แปลง 271–279 (ริมถนน)','WALL',1030,198],
    [20,'บึงเหนือ (ริมถนน แปลง 239–259)','DOME',975,279],
    [21,'ประตูตะวันออก – LPR','LPR',1063,348],
    [22,'ประตูตะวันออก – ถนนหน้าประตู (มุมกว้าง)','ROAD',1072,360],
    [23,'หน้าสำนักงานนิติ','DOME',1032,375],
    [24,'กำแพงเหนือ โซน NE (ปลายถนน 301–311)','WALL',1110,120],
    [25,'กำแพงตะวันออก โซน NE (ปลายถนน 337–351)','WALL',1215,207],
    [26,'กำแพงตะวันออก โซนใต้ (ปลายถนน 411–421)','WALL',1112,465],
    [27,'บึงใต้ (ริมถนน แปลง 491–497)','DOME',960,466],
    [28,'กำแพงตะวันตก โซนใต้ (ถนนริมกำแพง)','WALL',795,450],
    [29,'กำแพงใต้ โซนใต้ (ถนนแปลง 527–535)','WALL',920,500],
    [30,'มุมกำแพงใต้ (ปลายถนน 443–451)','WALL',1045,580]
  ].map(([id,name,type,x,y]) => ({id,name,type,x,y}));

  function compute(sx, sy, opt) {
    opt = Object.assign({ slack:0.10, drop:8, utpMax:90 }, opt || {});
    const d = (a,b) => Math.hypot((a[0]-b[0])*sx, (a[1]-b[1])*sy);
    // 1) project every camera onto its nearest road and split that road there (node A<id>)
    const nodes = Object.assign({}, N); const split = {}; const att = {};
    CAMS.forEach(c => { let best=null;
      E.forEach(e => { const [a,b]=e.split('-'); const A=N[a],B=N[b]; const vx=B[0]-A[0], vy=B[1]-A[1];
        let t=((c.x-A[0])*vx+(c.y-A[1])*vy)/(vx*vx+vy*vy); t=Math.max(0.001,Math.min(0.999,t));
        const P=[A[0]+t*vx, A[1]+t*vy]; const off=d(P,[c.x,c.y]); if (!best || off<best.off) best={e,t,P,off}; });
      const k='A'+c.id; nodes[k]=best.P; att[c.id]={node:k, off:best.off}; (split[best.e]=split[best.e]||[]).push({t:best.t,k}); });
    const edges=[]; E.forEach(e => { const [a,b]=e.split('-'); const pts=(split[e]||[]).sort((p,q)=>p.t-q.t).map(p=>p.k);
      const chain=[a,...pts,b]; for (let i=1;i<chain.length;i++) edges.push([chain[i-1],chain[i]]); });
    const adj={}; Object.keys(nodes).forEach(k=>adj[k]=[]);
    edges.forEach(([a,b]) => { const w=d(nodes[a],nodes[b]); adj[a].push([b,w]); adj[b].push([a,w]); });
    const cache={};
    function sp(src) { if (cache[src]) return cache[src];
      const dist={}, prev={}, done={}; Object.keys(nodes).forEach(k=>dist[k]=Infinity); dist[src]=0;
      for (;;) { let u=null; for (const k in dist) if (!done[k] && (u===null || dist[k]<dist[u])) u=k;
        if (u===null || dist[u]===Infinity) break; done[u]=1;
        adj[u].forEach(([v,w]) => { if (dist[u]+w<dist[v]) { dist[v]=dist[u]+w; prev[v]=u; } }); }
      return cache[src]={dist,prev}; }
    const pathTo=(src,dst)=>{ const p=[dst]; let c=dst; while(c!==src){ c=sp(src).prev[c]; p.unshift(c);} return p; };
    const cable = r => Math.ceil(r*(1+opt.slack)+opt.drop);
    const route = (hubNode, c) => sp(hubNode).dist[att[c.id].node] + att[c.id].off;
    // 2) cabinets: NVR room + guardhouse fixed, then greedy cover so every camera gets <= utpMax of UTP
    const chosen = FIXED_HUBS.map(h=>h.node); const covered=new Set();
    const cover = n => CAMS.filter(c => cable(route(n,c)) <= opt.utpMax).map(c=>c.id);
    chosen.forEach(n => cover(n).forEach(i=>covered.add(i)));
    const cand = Object.keys(nodes);
    while (covered.size < CAMS.length) { let best=null;
      cand.forEach(n => { if (chosen.includes(n)) return; const g=cover(n).filter(i=>!covered.has(i)).length;
        if (g && (!best || g>best.g || (g===best.g && sp('J2').dist[n]<sp('J2').dist[best.n]))) best={n,g}; });
      if (!best) break; chosen.push(best.n); cover(best.n).forEach(i=>covered.add(i)); }
    const HUBS = chosen.map((n,i) => ({ id:'H'+i, node:n, name: i<FIXED_HUBS.length ? FIXED_HUBS[i].name : '' }));
    const cams = CAMS.map(c => { let bh=null;
      HUBS.forEach(h => { const r=route(h.node,c); if (!bh || r<bh.r) bh={h,r}; });
      const path=pathTo(bh.h.node, att[c.id].node).map(k=>nodes[k]); path.push([c.x,c.y]); const cb=cable(bh.r);
      return Object.assign({}, c, { side: side(c.x,c.y), nvrDist: route('J2',c), hub:bh.h.id, route:bh.r, cable:cb, ok:cb<=opt.utpMax, path }); });
    HUBS.forEach(h => { if (!h.name) h.name='กล่อง Fiber+PoE ที่เสากล้อง #'+cams.filter(c=>c.hub===h.id).map(c=>c.id).join(', #'); });
    // 3) fibre backbone: union of roads on shortest paths NVR -> each cabinet
    const used={}; let fibreRoute=0; const fibrePaths=[];
    HUBS.slice(1).forEach(h => { const p=pathTo('J2',h.node); fibrePaths.push(p.map(k=>nodes[k]));
      for (let i=1;i<p.length;i++){ const k=[p[i-1],p[i]].sort().join('|'); if(!used[k]){used[k]=1; fibreRoute+=d(nodes[p[i-1]],nodes[p[i]]);} } });
    const hubs = HUBS.map(h => ({ id:h.id, name:h.name, node:h.node, xy:nodes[h.node], dist:sp('J2').dist[h.node],
      side: side(nodes[h.node][0],nodes[h.node][1]), fibre: h.node==='J2' ? 0 : Math.ceil(sp('J2').dist[h.node]*(1+opt.slack)+20), cams:cams.filter(c=>c.hub===h.id).length }));
    return { cams, hubs, fibrePaths, fibreRoute, fibreCable: Math.ceil(fibreRoute*(1+opt.slack)+20*(HUBS.length-1)) };
  }
  // default scale: plot ~16 m frontage (~22 px) x ~20 m depth (~15 px); calibrate with Google Earth
  const REF = { ew:{a:N.W0,b:N.G,label:'ถนนเมน: ประตูหลัก → ประตูตะวันออก'}, ns:{a:[1045,357],b:[1045,585],label:'ถนนเมนหน้านิติ → กำแพงใต้สุด (โซนใต้)'} };
  const DEFAULT = { sx:0.73, sy:1.33 };
  root.CamPlan = { PUBLIC_ROAD, side, N, E, FIXED_HUBS, CAMS, T, NVR, REF, DEFAULT, compute };
  if (typeof module !== 'undefined') module.exports = root.CamPlan;
})(typeof window !== 'undefined' ? window : globalThis);
