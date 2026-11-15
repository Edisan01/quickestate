import * as THREE from './lib/three.module.min.js';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const testGL = () => { try { const c = document.createElement('canvas'); return !!c.getContext('webgl'); } catch (e) { return false; } };
const LAGUNE = [0xA9 / 255, 0xC3 / 255, 0xDD / 255];
const SKY_TOP = [0x20 / 255, 0x3E / 255, 0x78 / 255];   // Himmel tief
const BLUE = 0x03203D;

if (!reduce && testGL() && window.gsap && window.ScrollTrigger && window.Lenis) start();

function start() {
  document.body.classList.remove('no-motion'); document.body.classList.add('on-sky');
  const mobile = innerWidth < 900;
  const S = { ter: 0, pan: 0, dolly: 0, lt: 0, water: 0, plan: 0, dusk: 0 };
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };

  /* ---------- Szene Dachterrasse: Rendering mit Tiefe ---------- */
  const dc = document.getElementById('depth');
  const gl = dc.getContext('webgl', { antialias: false, alpha: true });
  const VS = 'attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;v.y=1.-v.y;gl_Position=vec4(p,0.,1.);}';
  // Himmel: satter Verlauf (tief oben, hell am Horizont) im Bildschirmraum; im Rendering ersetzt die Tiefenkarte den Himmel, Wolken bleiben
  // Himmel: Original-Himmel des Renderings bleibt (Wolken!), nach oben stufenlos ins tiefe Blau abgedunkelt.
  // Über dem Bildrand läuft derselbe Himmel weiter (oberste Bildzeile, weich gemittelt) – keine Kante.
  // Wolken ziehen: sauberer Himmel (ohne Gebäude, nahtlos kachelbar) wandert langsam nach rechts, Stadt bleibt fest davor (Himmelsmaske).
  // Über dem Bildrand läuft derselbe Wolkenhimmel weiter (kein Spiegeln), nach oben stufenlos ins tiefe Blau. Vogel: selten, klein, hinter den Türmen.
  const FS = `precision highp float;varying vec2 v;uniform sampler2D im,dp,sk,cl,li;uniform vec2 cov,mouse;uniform vec4 cam;uniform vec3 skyTop,avgTop;uniform float imgTop,time,dusk;
    float bird(vec2 p,float fl){float ax=abs(p.x);if(ax>1.)return 0.;
      float wy=-fl*.55*ax+.32*ax*ax;float th=.11*(1.-ax)+.025;
      float a=1.-smoothstep(0.,.07,abs(p.y-wy)-th);float b=1.-smoothstep(0.,.07,length(p*vec2(1.,1.5))-.13);return max(a,b);}
    void main(){float iv=v.y-imgTop;vec2 c=vec2(.5);
      vec2 uv=c+(vec2(v.x,iv)-c)*cov/cam.w;vec2 off=cam.xy+mouse;vec2 q=uv;float f=.35;
      for(int k=0;k<4;k++){float d=min(texture2D(dp,clamp(q,.001,.999)).r-f,.3);q=c+(uv-c)*(1.-cam.z*d)-off*d;}
      vec2 qi=clamp(q,.001,.999);
      vec3 base=texture2D(im,qi).rgb;float skyM=q.y<0.?1.:texture2D(sk,qi).r;
      vec2 ps=vec2(q.x/.85-time*.0045,clamp(q.y/.46,.001,.999));
      ps+=.0035*vec2(sin(ps.y*7.+time*.05),sin(ps.x*6.-time*.04));
      vec3 plate=texture2D(cl,ps).rgb;
      float dw=1.;                                                       // ganzer Himmel zieht, bis zur Dachkante
      float cw=smoothstep(.06,.30,q.y);vec3 sky=mix(avgTop,plate,cw);                 // oben clean, Wolken nur tiefer unten
      vec3 col=mix(base,mix(base,sky,dw),skyM);
      float t=mod(time+20.,37.);vec2 bq=vec2(mix(-.08,1.08,t/15.),.27-.03*t/15.+.004*sin(t*.6));
      float fl=sin(time*8.5)*smoothstep(-.3,.3,sin(time*.8))+.12;float s=.008;
      float bA=bird(vec2(q.x-bq.x,(q.y-bq.y)*1.416)/s,fl);
      bA=max(bA,bird(vec2(q.x-bq.x+.022,(q.y-bq.y-.009)*1.416)/(s*.85),sin(time*8.5+1.7)*smoothstep(-.3,.3,sin(time*.8+.5))+.12));
      col=mix(col,vec3(.16,.2,.27),bA*.7*skyM*step(t,15.));
      float hv=imgTop+.5+(.40-.5)*cam.w/cov.y;                         // Horizont in Bildschirmhöhe
      float k=pow(smoothstep(-.03,.6,hv-v.y),.7)*skyM;                   // Verlauf: am Horizont Original, nach oben satt
      vec3 graded=skyTop+(col-avgTop)*.8;
      col=mix(col,graded,k);
      if(dusk>0.){                                                       // Sonnenuntergang beim Scrollen: Abendrot → blaue Stunde (zurückscrollen = Sonnenaufgang)
        float hh=clamp((hv-v.y)/.9,0.,1.);float lum=dot(col,vec3(.299,.587,.114));
        vec3 sunset=mix(vec3(.99,.60,.33),mix(vec3(.82,.43,.47),vec3(.13,.13,.31),smoothstep(.25,.9,hh)),smoothstep(0.,.35,hh));
        vec3 blueH=mix(vec3(.30,.32,.54),vec3(.05,.08,.20),smoothstep(0.,.8,hh));
        float bh=smoothstep(.55,1.,dusk);
        vec3 skyD=mix(sunset*(.72+.55*lum),blueH*(.8+.35*lum),bh);
        float cld=smoothstep(.78,.94,dot(sky,vec3(.299,.587,.114)))*dw;              // Wolken bleiben: im Abendrot golden-rosa angeleuchtet, zur blauen Stunde schiefergrau
        vec3 cloudD=mix(mix(vec3(1.,.78,.55),vec3(.98,.58,.62),smoothstep(.15,.8,hh)),vec3(.36,.34,.50),bh);
        skyD=mix(skyD,cloudD*(.85+.3*lum),cld*.9);
        vec3 cg=mix(col,vec3(lum),.6*smoothstep(.45,1.,dusk));             // nachts weniger Farbe (Patina-Grün leuchtet nicht mehr)
        vec3 cityD=mix(col*vec3(1.06,.80,.60),cg*vec3(.40,.45,.62),smoothstep(.45,1.,dusk));
        col=mix(col,mix(cityD,skyD,skyM),smoothstep(0.,.3,dusk));
        float nt=smoothstep(.55,1.,dusk);
        if(nt>0.&&q.y>0.){vec3 L=texture2D(li,qi).rgb;                  // Lichtkarte: R Fenster, G Einschaltzeitpunkt, B Wahrzeichen
          float on=smoothstep(L.g,L.g+.07,nt*1.05);                        // Fenster gehen nacheinander an
          col+=vec3(1.,.70,.36)*L.r*on*1.25;
          float lb=L.b*smoothstep(.1,.6,nt);col=mix(col,vec3(dot(col,vec3(.299,.587,.114)))*vec3(1.,.9,.75),min(1.,lb*1.6));   // Patina-Grün im Flutlicht entsättigen
          col*=mix(vec3(1.),vec3(4.2,3.1,1.7),lb);}}   // Stephansdom und Peterskirche: von unten rechts angestrahlt, Steinstruktur bleibt sichtbar
      col+=(fract(sin(dot(gl_FragCoord.xy+fract(time*7.)*91.,vec2(12.9898,78.233)))*43758.5453)-.5)*.016;   // feines Filmkorn gegen CG-Look
      gl_FragColor=vec4(col,1.);}`;
  const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog); gl.useProgram(prog);
  const U = {}; ['im', 'dp', 'sk', 'cl', 'li', 'cov', 'mouse', 'cam', 'skyTop', 'avgTop', 'imgTop', 'time', 'dusk'].forEach(n => U[n] = gl.getUniformLocation(prog, n));
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const glTex = (img, unit, rep) => { const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER].forEach(p => gl.texParameteri(gl.TEXTURE_2D, p, gl.LINEAR));
    [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach(p => gl.texParameteri(gl.TEXTURE_2D, p, rep ? gl.REPEAT : gl.CLAMP_TO_EDGE)); };
  const load = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  let depthReady = false, heroLive = true, cloudBoost = 0;
  let duskV = 0;   // angezeigter Sonnenstand: folgt dem Scrollziel S.dusk gedrosselt (voller Untergang ≥ ~4 s), damit schnelles Scrollen kein Aufblitzen erzeugt
  const t0 = performance.now(), CLOCK = () => (window.__heroT ?? (performance.now() - t0) / 1000);
  Promise.all([load('img/skyview-penthouse-dachterrasse-stephansdom' + (mobile ? '-m' : '') + '.webp'), load('img/skyview-penthouse-dachterrasse-stephansdom-tiefe.webp'), load('img/skyview-penthouse-dachterrasse-stephansdom-himmel.webp'), load('img/skyview-himmel-wolken.webp'), load('img/skyview-lichter.webp')])
    .then(([a, b, c, d, e]) => { glTex(a, 0); glTex(b, 1); glTex(c, 2); glTex(d, 3, true); glTex(e, 4); gl.uniform1i(U.li, 4); gl.uniform1i(U.im, 0); gl.uniform1i(U.dp, 1); gl.uniform1i(U.sk, 2); gl.uniform1i(U.cl, 3); depthReady = true; kick();
      // Große/Retina-Bildschirme: danach still die scharfe 3600-px-Version nachladen und austauschen
      if (!mobile && innerWidth * (devicePixelRatio || 1) > 2400) load('img/skyview-penthouse-dachterrasse-stephansdom-xl.webp').then(x => { glTex(x, 0); kick(); }).catch(() => {}); });

  function drawDepth() {
    if (!depthReady) return;
    const dpr = Math.min(devicePixelRatio || 1, 2), w = Math.round(innerWidth * dpr), h = Math.round(innerHeight * dpr);
    if (dc.width !== w || dc.height !== h) { dc.width = w; dc.height = h; gl.viewport(0, 0, w, h); }
    const ia = 2400 / 1695, va = w / h, cov = va > ia ? [1, ia / va] : [va / ia, 1];
    gl.uniform2f(U.cov, cov[0], cov[1]);
    gl.uniform4f(U.cam, 0.012 - S.pan * 0.024, 0.0, S.dolly * 0.03, 1.12 + S.dolly * 0.05);
    gl.uniform2f(U.mouse, mouse.x * 0.012, mouse.y * 0.008);
    gl.uniform3f(U.skyTop, SKY_TOP[0], SKY_TOP[1], SKY_TOP[2]); gl.uniform3f(U.avgTop, 0.618, 0.757, 0.883);
    // Start: nur Turmspitzen/Dachkante (Bild-y 0,405) am unteren Rand – Terrasse erst beim Scrollen
    const camW = 1.12 + S.dolly * 0.05, top0 = (va < 0.8 ? 0.90 : 1.0) - (0.5 + (0.405 - 0.5) * camW / cov[1]);
    gl.uniform1f(U.imgTop, top0 * (1 - S.ter)); gl.uniform1f(U.time, CLOCK() + cloudBoost); gl.uniform1f(U.dusk, duskV);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /* ---------- Echte 3D-Szene: Leuchtturm aus Linien + Wasser ---------- */
  const tc = document.getElementById('three');
  const renderer = new THREE.WebGLRenderer({ canvas: tc, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.1, 100);
  camera.position.set(0, 2.7, 13); camera.lookAt(0, 2.5, 0);

  const pts = [];
  const seg = (a, b) => pts.push(a[0], a[1], a[2], b[0], b[1], b[2]);
  const ring = (y, r, n = 8) => { for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, b = (i + 1) / n * Math.PI * 2; seg([Math.cos(a) * r, y, Math.sin(a) * r], [Math.cos(b) * r, y, Math.sin(b) * r]); } };
  for (let i = 0; i < 60; i++) { const x0 = -4 + i * 8 / 60, x1 = x0 + 8 / 60; seg([x0, -0.1 + Math.sin(x0 * 2.2) * 0.08, 1.4], [x1, -0.1 + Math.sin(x1 * 2.2) * 0.08, 1.4]); }
  const rAt = y => 1.0 - (y / 4) * 0.38;
  for (let y = 0; y <= 4; y++) ring(y, rAt(y));
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; seg([Math.cos(a) * 1.0, 0, Math.sin(a) * 1.0], [Math.cos(a) * 0.62, 4, Math.sin(a) * 0.62]); }
  ring(4.0, 0.9, 16); ring(4.3, 0.9, 16);
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; seg([Math.cos(a) * .9, 4, Math.sin(a) * .9], [Math.cos(a) * .9, 4.3, Math.sin(a) * .9]); }
  ring(4.3, 0.46); ring(5.0, 0.46);
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; seg([Math.cos(a) * .46, 4.3, Math.sin(a) * .46], [Math.cos(a) * .46, 5.0, Math.sin(a) * .46]); seg([Math.cos(a) * .52, 5.0, Math.sin(a) * .52], [0, 5.55, 0]); }
  ring(5.0, 0.52); seg([0, 5.55, 0], [0, 5.85, 0]);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const total = pts.length / 3;
  const tower = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: BLUE, transparent: true }));
  const group = new THREE.Group(); group.add(tower); scene.add(group);
  const beamGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 4.65, 0), new THREE.Vector3(6, 4.95, 0), new THREE.Vector3(0, 4.65, 0), new THREE.Vector3(6, 4.35, 0)]);
  const beam = new THREE.LineSegments(beamGeo, new THREE.LineBasicMaterial({ color: BLUE, transparent: true, opacity: 0 }));
  group.add(beam);

  // Wasser-Übergang: Lagune steigt als Welle hoch und beruhigt sich zur Blaupause (Egyptian Blue)
  const wMat = new THREE.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false,
    uniforms: { level: { value: 0 }, time: { value: 0 }, deep: { value: new THREE.Color(0x03203D) }, shallow: { value: new THREE.Color(0x639CC5) }, foam: { value: new THREE.Color(0xEFE6D6) } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader: `varying vec2 vUv;uniform float level,time;uniform vec3 deep,shallow,foam;
      void main(){vec2 uv=vUv;float calm=smoothstep(.95,1.3,level);
        float edge=level+(.028*sin(uv.x*9.+time*1.6)+.013*sin(uv.x*26.-time*2.4))*(1.-calm);
        if(uv.y>edge+.006)discard;float d=clamp((edge-uv.y)*2.2,0.,1.);
        vec3 col=mix(shallow,deep,clamp(d+calm,0.,1.));
        col+=.035*sin(uv.x*55.+time*2.+uv.y*38.)*(1.-calm)*(1.-d);
        float line=smoothstep(.012,.0,abs(uv.y-edge))*(1.-calm);col=mix(col,foam,line*.9);
        gl_FragColor=vec4(col,1.);
        #include <colorspace_fragment>
      }`
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), wMat); water.frustumCulled = false; water.renderOrder = 10;
  scene.add(water);

  // Der Plan wird zum Haus: Linien auf der Blaupause, Baukörper wächst Geschoß für Geschoß
  const BEIGE = 0xEFE6D6, RED = 0xEB2F33;
  const plan = new THREE.Group(); plan.visible = false; scene.add(plan);
  const lineObj = (arr, color, dashed) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    const m = dashed ? new THREE.LineDashedMaterial({ color, dashSize: .25, gapSize: .15, transparent: true }) : new THREE.LineBasicMaterial({ color, transparent: true });
    m.depthTest = false; const o = new THREE.LineSegments(g, m); o.renderOrder = 20; if (dashed) o.computeLineDistances(); plan.add(o); return o; };
  const rect = (x0, z0, x1, z1, y = 0) => [x0, y, z0, x1, y, z0, x1, y, z0, x1, y, z1, x1, y, z1, x0, y, z1, x0, y, z1, x0, y, z0];
  const parcel = lineObj(rect(-3.2, -2.2, 3.2, 2.2), BEIGE);
  const grid = []; for (let i = -3; i <= 3; i++) { grid.push(i, 0, -2.2, i, 0, 2.2); } for (let j = -2; j <= 2; j++) { grid.push(-3.2, 0, j, 3.2, 0, j); }
  const gridO = lineObj(grid, 0x639CC5);
  const bfl = lineObj([-4.2, 0, 1.3, 4.2, 0, 1.3], RED, true);
  const foot = lineObj(rect(-2.1, -1.4, 2.1, 1.3), BEIGE);
  const box = []; const H = 3.2, FL = 4;
  [[-2.1, -1.4], [2.1, -1.4], [2.1, 1.3], [-2.1, 1.3]].forEach(([x, z]) => box.push(x, 0, z, x, H, z));
  for (let f = 1; f <= FL; f++) box.push(...rect(-2.1, -1.4, 2.1, 1.3, H * f / FL));
  const body = lineObj(box, BEIGE);
  const hm = lineObj([2.7, 0, 1.3, 2.7, H, 1.3, 2.55, H, 1.3, 2.85, H, 1.3, 2.55, 0, 1.3, 2.85, 0, 1.3], 0xA9C3DD);
  const STEPS = ['Grundstück · Beispiel 500 m²', 'Baufluchtlinie', 'Bauklasse II · bis 12 m', 'Baukörper · 4 Geschoße'];
  const planStep = document.getElementById('planStep');
  let lastStep = -1;
  const seg01 = (a, b) => Math.min(1, Math.max(0, (S.plan - a) / (b - a)));
  function updatePlan() {
    plan.visible = S.plan > 0.001;
    if (!plan.visible) return;
    const pa = seg01(0, .22), pb = seg01(.22, .38), pc = seg01(.38, .52), pd = seg01(.52, .95);
    parcel.material.opacity = pa; gridO.material.opacity = pa * .35;
    parcel.geometry.setDrawRange(0, Math.floor(8 * pa / 2) * 2);
    bfl.material.opacity = pb; bfl.scale.x = Math.max(.001, pb);
    foot.material.opacity = pc;
    body.material.opacity = pd > 0 ? 1 : 0; body.scale.y = Math.max(.001, pd); hm.material.opacity = pd; hm.scale.y = Math.max(.001, pd);
    const k = Math.min(1, S.plan * 1.6);
    camera.position.set(THREE.MathUtils.lerp(0, 7.5, k) + mouse.x * .5, THREE.MathUtils.lerp(2.7, 8.5, k) - mouse.y * .3, THREE.MathUtils.lerp(13, 10.5, k));
    camera.lookAt(0, THREE.MathUtils.lerp(2.5, .8, k), 0);
    const st = pd > 0 ? 3 : pc > 0 ? 2 : pb > 0 ? 1 : 0;
    if (st !== lastStep) { lastStep = st; planStep.textContent = STEPS[st]; }
  }

  const clock = new THREE.Clock();
  function drawThree() {
    const w = innerWidth, h = innerHeight;
    if (tc.width !== Math.round(w * renderer.getPixelRatio())) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
    const t = clock.getElapsedTime();
    tower.geometry.setDrawRange(0, Math.floor(total * Math.min(1, S.lt * 1.15) / 2) * 2);
    tower.material.opacity = Math.min(1, S.lt * 4);
    beam.material.opacity = Math.max(0, (S.lt - 0.85) / 0.15) * 0.9;
    beam.rotation.y = t * 0.8;
    group.rotation.y = -0.5 + S.lt * 0.7 + mouse.x * 0.12;
    group.position.y = -S.water * 3.2;
    if (S.plan <= 0.001) { camera.position.set(mouse.x * 0.6, 2.7 - mouse.y * 0.3, 13); camera.lookAt(0, 2.5, 0); }
    wMat.uniforms.level.value = S.water * 1.35 - 0.05;
    wMat.uniforms.time.value = t;
    water.visible = S.water > 0.001;
    updatePlan(t);
    renderer.render(scene, camera);
  }

  /* ---------- Scroll-Engine ---------- */
  const lenis = new Lenis({ lerp: 0.09 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(t => lenis.raf(t * 1000)); gsap.ticker.lagSmoothing(0);
  gsap.registerPlugin(ScrollTrigger);

  const $ = id => document.getElementById(id);
  const count = $('count');
  gsap.set('#arch', { xPercent: -50, yPercent: 100 });
  const tl = gsap.timeline({ defaults: { ease: 'none' }, onUpdate: () => kick(), scrollTrigger: { trigger: '#scroller', start: 'top top', end: 'bottom bottom', scrub: 1,
    onUpdate: st => { onProgress(st.progress); kick(); } } });
  // Wortmarke: „See beyond.“ so setzen, dass die Oberkante vom S knapp unter der Grundlinie von ESTATE liegt (Abstand 6 % der Titelhöhe);
  // Drehung 9°: S sitzt knapp unter ESTATE, nur das d lappt an einer Stelle leicht ins Wort (wie ERA).
  const placeSig = () => {
    const w = document.getElementById('heroWord'), sg = document.querySelector('.t-hero .sig'); if (!w || !sg) return;
    const mk = el => { let m = el.querySelector('.bl'); if (!m) { m = document.createElement('span'); m.className = 'bl'; m.style.cssText = 'display:inline-block;width:0;height:0'; el.append(m); } return m; };
    const mt = mk(w), ms = sg.querySelector('.bl0') || (() => { const m = document.createElement('span'); m.className = 'bl0'; m.style.cssText = 'display:inline-block;width:0;height:0'; sg.prepend(m); return m; })();
    // Breite: „See beyond.“ so groß, dass es etwa so breit ist wie ESTATE (wie „Estepona“ unter ÄRA)
    sg.style.fontSize = ''; const r0 = document.createRange(); r0.selectNodeContents(w); const lw = Math.max(...[...r0.getClientRects()].map(r => r.width));
    const sw = sg.getBoundingClientRect().width; if (sw > 0) sg.style.fontSize = (parseFloat(getComputedStyle(sg).fontSize) * 1.0 * lw / sw) + 'px';
    const F = parseFloat(getComputedStyle(sg).fontSize), T = parseFloat(getComputedStyle(w).fontSize) * 1.22;
    const cur = parseFloat(sg.style.marginTop) || 0;
    const want = mt.getBoundingClientRect().bottom + 0.1 * T + 0.79 * F;
    sg.style.marginTop = (cur + want - ms.getBoundingClientRect().bottom) + 'px';
  };
  document.fonts.ready.then(() => { placeSig(); requestAnimationFrame(placeSig); }); addEventListener('resize', placeSig);
  gsap.from('#tHero', { y: 36, opacity: 0, filter: 'blur(10px)', duration: 1.8, ease: 'power3.out', delay: 0.25, clearProps: 'filter' });   // Einstieg: Titel taucht aus dem Himmel auf
  tl.to('#heroWord', { letterSpacing: '0.5em', opacity: 0, duration: 1 }, 0)
    .to('#tHero .sig', { y: -40, opacity: 0, duration: 0.8 }, 0.1)
    .to(S, { ter: 1, duration: 1.6, ease: 'power1.inOut' }, 0.2)
    .to(S, { pan: 1, dolly: 1, duration: 2.6 }, 0.8)
    .to(S, { dusk: 1, duration: 1.1, ease: 'none' }, 1.35)   // Sonne geht unter, bevor der blaue Bogen aufsteigt
    .to('#tTer', { opacity: 1, duration: 0.4 }, 1.3).to('#tTer', { opacity: 0, duration: 0.3 }, 2.4)
    .to('#vis', { opacity: 0.75, duration: 0.3 }, 1.2).to('#vis', { opacity: 0, duration: 0.3 }, 3.6)
    .to('#arch', { yPercent: 0, xPercent: -50, duration: 1.1, ease: 'power2.out' }, 2.4)
    .to('#tArch', { opacity: 1, duration: 0.3 }, 3.0).to('#tArch', { opacity: 0, duration: 0.3 }, 3.7)
    .to('#arch', { scale: 3.4, duration: 0.9, ease: 'power2.in' }, 3.6)
    .to('#depth', { opacity: 0, duration: 0.1 }, 4.45)
    .to(S, { lt: 1, duration: 1.6 }, 3.95)
    .to('#tLt', { opacity: 1, duration: 0.3 }, 4.9).to('#tLt', { opacity: 0, duration: 0.3 }, 6.0)
    .to(S, { water: 1, duration: 1.4, ease: 'power1.inOut' }, 5.9)
    .to(S, { plan: 1, duration: 2.4 }, 7.1)
    .to('#tPlan', { opacity: 1, duration: 0.3 }, 7.45).to('#tPlan', { opacity: 0, duration: 0.3 }, 9.3)
    .to('#tNum', { opacity: 1, duration: 0.4 }, 9.2)
    .to({}, { duration: 0.6 }, 9.6);

  const cta = $('cta'), ctaText = $('ctaText'), hint = $('hint'), sealRing = $('sealRing');
  const CTAS = [[0, 'Grundstück prüfen', '#rechner'], [0.06, 'Wohnung wählen', '#objekte'], [0.4, 'Über Eduard', '#inhalt'], [0.68, 'Grundstück prüfen', '#rechner']];
  let ctaIdx = -1;
  // Abroll-Effekt wie ERA: jeder Buchstabe rollt einzeln nach oben weg, die Kopie kommt von unten (leicht versetzt)
  function rollify(el) {
    const lines = el.innerHTML.split(/<br\s*\/?>/i).map(t => t.replace(/<[^>]+>/g, ''));
    el.setAttribute('aria-label', lines.join(' ')); el.textContent = ''; let n = 0;
    lines.forEach((t, li) => { if (li) el.append(document.createElement('br'));
      t.split(' ').forEach((word, wi) => { if (wi) el.append(' '); const wd = document.createElement('span'); wd.style.whiteSpace = 'nowrap';   // Wörter nicht mitten im Wort umbrechen
        for (const c of word) { const ch = document.createElement('span'); ch.className = 'ch'; ch.style.setProperty('--i', n++); ch.setAttribute('aria-hidden', 'true');
          const in1 = document.createElement('span'); in1.textContent = c; const in2 = in1.cloneNode(true); const w = document.createElement('span'); w.append(in1, in2); ch.append(w); wd.append(ch); }
        el.append(wd); }); });
    if (!el.classList.contains('roll')) el.classList.add('roll');
  }
  document.querySelectorAll('.topnav .roll, .menu-btn .roll').forEach(rollify);
  function onProgress(p) {
    count.textContent = '0' + Math.min(6, 1 + Math.floor(p * 6)) + ' / 06';
    let i = 0; CTAS.forEach((c, k) => { if (p >= c[0]) i = k; });
    if (i !== ctaIdx) { ctaIdx = i; ctaText.textContent = CTAS[i][1]; cta.href = CTAS[i][2]; rollify(ctaText); }
    cta.classList.toggle('away', p > 0.05);   // Handy: Kreis nur im Einstieg (CSS greift nur ≤ 900 px)
    hint.style.opacity = p > 0.01 ? 0 : 1;
    document.body.classList.toggle('on-sky', p < 0.3); heroLive = p < 0.4;
  }
  let rot = 0;
  gsap.ticker.add((t, dms) => { const d = S.dusk - duskV; if (Math.abs(d) > 0.0005) { const dt = Math.min(dms, 50) / 1000; duskV += Math.sign(d) * Math.min(Math.abs(d), dt * (0.16 + Math.abs(d) * 0.3)); kick(); } });
  gsap.ticker.add(() => { cloudBoost += Math.min(6, Math.abs(lenis.velocity || 0)) * 0.015; });             // Wolken ziehen beim Scrollen kurz schneller (Wind)
  gsap.ticker.add(() => { rot += -0.078 + Math.max(-20, Math.min(20, lenis.velocity || 0)) * 0.6; /* Ruhe: eine Runde ≈ 77 s gegen den Uhrzeiger (wie ERA); Scrollen dreht kräftig mit */ sealRing.style.transform = 'rotate(' + rot.toFixed(2) + 'deg)'; });
  const menuBtn = $('menuBtn'), menu = $('menu');
  const setMenu = open => { menu.hidden = !open; menuBtn.setAttribute('aria-expanded', String(open)); const ml = menuBtn.querySelector('.roll'); ml.textContent = open ? 'Schließen' : 'Menü'; rollify(ml); open ? lenis.stop() : lenis.start(); };
  menuBtn.addEventListener('click', () => setMenu(menu.hidden));
  menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setMenu(false)));   // Link im Menü schließt es
  addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) setMenu(false); });
  $('seal').addEventListener('click', e => { e.preventDefault(); lenis.scrollTo(0, { duration: 2.2 }); });

  // X-Kreuzung: Jedes Dreieck hat die Spitze in der Mitte. Seite a (links) und Seite b (rechts)
  // drehen sich wie Uhrzeiger um die Spitze auf, bis sie sich gegenüber treffen – direkt am Scrollen.
  const cross = $('kreuzung');
  const tris = { down: $('triBottom'), right: $('triRight'), left: $('triLeft'), top: cross.querySelector('.t-top') };
  const BASE = { down: 90, right: 0, left: 180, top: 270 };          // Richtung der Grundseite c (Grad, y nach unten)
  const P = { down: 0, right: 0, left: 0 }, T = { down: 0, right: 0, left: 0 };
  const xc = cross.querySelector('.x-center');
  function fan(dirDeg, prog, W, H) {
    const cx = W / 2, cy = H / 2, rad = d => d * Math.PI / 180;
    const corners = [[0, 0], [W, 0], [W, H], [0, H]].map(([x, y]) => [x, y, Math.atan2(y - cy, x - cx) * 180 / Math.PI]);
    const norm = d => { d = ((d + 180) % 360 + 360) % 360 - 180; return d; };
    const hit = deg => { const c = Math.cos(rad(deg)), s = Math.sin(rad(deg)); const ts = [];
      if (c > 1e-6) ts.push((W - cx) / c); if (c < -1e-6) ts.push(-cx / c); if (s > 1e-6) ts.push((H - cy) / s); if (s < -1e-6) ts.push(-cy / s);
      const t = Math.min(...ts); return [cx + c * t, cy + s * t]; };
    // Startwinkel: Strahlen zu den Ecken der Grundseite c
    const inRange = corners.map(k => ({ k, d: norm(k[2] - dirDeg) })).filter(o => Math.abs(o.d) < 90).sort((p, q) => p.d - q.d);
    const a0 = Math.abs(inRange[0].d), b0 = Math.abs(inRange[inRange.length - 1].d);
    const e = prog * prog * (3 - 2 * prog);                          // weich ein- und auslaufen
    if (e > 0.995) return 'polygon(0% 0%,100% 0%,100% 100%,0% 100%)';  // ganz offen: Spalt bei 12 Uhr schließen
    const la = a0 + (180 - a0) * e, lb = b0 + (180 - b0) * e;          // Seite a und Seite b
    const pts = [[cx, cy], hit(dirDeg - la)];
    corners.map(k => ({ k, d: norm(k[2] - dirDeg) })).filter(o => o.d > -la + 0.01 && o.d < lb - 0.01).sort((p, q) => p.d - q.d).forEach(o => pts.push([o.k[0], o.k[1]]));
    pts.push(hit(dirDeg + lb));
    return 'polygon(' + pts.map(([x, y]) => (x / W * 100).toFixed(3) + '% ' + (y / H * 100).toFixed(3) + '%').join(',') + ')';
  }
  function drawX() {
    const W = cross.clientWidth, H = cross.clientHeight; if (!W) return;
    let active = null, max = 0;
    Object.keys(P).forEach(k => { P[k] += (T[k] - P[k]) * 0.22; if (Math.abs(T[k] - P[k]) < 0.0005) P[k] = T[k]; if (P[k] > max) { max = P[k]; active = k; } });
    Object.keys(tris).forEach(k => { const t = tris[k]; t.style.clipPath = fan(BASE[k], k === 'top' ? 0 : P[k], W, H); t.style.zIndex = k === active && max > 0 ? 3 : 1;
      const lab = t.querySelector('.lab'), sec = t.querySelector('.sec');
      lab.style.opacity = active && k !== active ? Math.max(0, 1 - max * 3) : (k === active ? Math.max(0, 1 - P[k] * 2.5) : 1);
      if (sec) { const r = k === active ? Math.min(1, Math.max(0, (P[k] - 0.45) / 0.45)) : 0; sec.style.opacity = r > 0 ? 1 : 0;
        [...sec.children].forEach((c, i) => { const q = Math.min(1, Math.max(0, r * 1.6 - i * 0.18)); const e2 = 1 - Math.pow(1 - q, 3);
          c.style.opacity = e2; c.style.transform = 'translateY(' + ((1 - e2) * 26).toFixed(1) + 'px)'; }); }
    });
    xc.style.opacity = Math.max(0, 1 - max * 4);
    cross.classList.toggle('open', max > 0.98);
  }
  const busy = () => Object.keys(T).find(k => T[k] > 0) || null;
  const KICK = 0.1;                                                 // ab 10 % Anstoß läuft es von selbst
  const tw = {};
  const auto = (k, to) => { if (tw[k] && tw[k].vars && tw[k].vars[k] === to && tw[k].isActive()) return; if (tw[k]) tw[k].kill();
    tw[k] = gsap.to(T, { [k]: to, duration: to ? 1.5 : 1.1, ease: to ? 'power3.inOut' : 'power2.inOut' }); };
  gsap.ticker.add(drawX);
  addEventListener('resize', drawX);
  // nach unten: am Scrollweg innerhalb der festgehaltenen Kreuzung
  ScrollTrigger.create({ trigger: cross, start: 'top top', end: '+=120%', pin: true,
    onUpdate: st => { const b = busy(); if (b && b !== 'down') return;
      if (st.direction > 0 && st.progress > 0.04 && T.down < 1) { auto('down', 1); if (st.progress < 0.6) lenis.scrollTo(st.start + (st.end - st.start) * 0.85, { duration: 1.5, easing: t => 1 - Math.pow(1 - t, 3) }); }
      if (st.direction < 0 && st.progress < 0.7 && T.down > 0) auto('down', 0); },
    onLeaveBack: () => { ['down', 'left', 'right'].forEach(k => auto(k, 0)); } });
  const atCross = () => { const r = cross.getBoundingClientRect(); return r.top <= 4 && r.bottom >= innerHeight - 4; };
  const side = (k, d) => { const b = busy(); if (b && b !== k) return;
    if (d > 0) { if (T[k] + d >= KICK || (tw[k] && tw[k].isActive())) auto(k, 1); else T[k] = Math.min(1, T[k] + d); }
    else if (d < 0) { if (T[k] < 1 - KICK * 0.5 || T[k] + d < 1 - KICK) auto(k, 0); else T[k] = Math.max(0, T[k] + d); } };
  // seitlich: am Wisch-/Trackpad-Weg, zurückwischen klappt wieder zu
  addEventListener('wheel', e => {
    if (!atCross()) return;
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      const d = e.deltaX / (innerWidth * 0.9);
      if (T.right > 0 || (d > 0 && !T.left)) side('right', d); else side('left', -d);
    } else if (e.deltaY < -6 && (T.left > 0 || T.right > 0)) { auto('left', 0); auto('right', 0); }
  }, { passive: true });
  let tx = 0;
  cross.addEventListener('touchstart', e => { tx = e.touches[0].clientX; }, { passive: true });
  cross.addEventListener('touchmove', e => { const x = e.touches[0].clientX, d = (tx - x) / (innerWidth * 0.8); tx = x;
    if (T.right > 0 || (d > 0 && !T.left)) side('right', d); else side('left', -d); }, { passive: true });
  addEventListener('keydown', e => { if (!atCross()) return;
    if (e.key === 'ArrowRight') { if (T.left > 0) auto('left', 0); else if (!busy() || busy() === 'right') auto('right', 1); }
    if (e.key === 'ArrowLeft') { if (T.right > 0) auto('right', 0); else if (!busy() || busy() === 'left') auto('left', 1); } });
  cross.querySelectorAll('.tri').forEach(t => t.addEventListener('click', e => {
    const d = t.dataset.dir;
    if (!d) { e.preventDefault(); lenis.scrollTo(0, { duration: 2.2 }); return; }
    if (P[d] < 0.98) { e.preventDefault(); if (d === 'down') lenis.scrollTo(cross, { offset: innerHeight * 1.0, duration: 1.5 }); else { ['left', 'right'].forEach(k => k !== d && auto(k, 0)); auto(d, 1); } }
  }));

  let raf = 0;
  function frame() {
    raf = 0;
    mouse.x += (mouse.tx - mouse.x) * 0.08; mouse.y += (mouse.ty - mouse.y) * 0.08;
    drawDepth();
    if (S.lt > 0 || S.water > 0) drawThree(); else renderer.clear();
    const moving = Math.abs(mouse.tx - mouse.x) + Math.abs(mouse.ty - mouse.y) > 0.001 || S.water > 0.001 || (S.lt > 0.85);
    if (moving || heroLive) kick();
  }
  function kick() { if (!raf) raf = requestAnimationFrame(frame); }
  addEventListener('pointermove', e => { if (e.pointerType !== 'mouse') return; mouse.tx = e.clientX / innerWidth - .5; mouse.ty = e.clientY / innerHeight - .5; kick(); }, { passive: true });
  addEventListener('resize', kick);
  dc.addEventListener('webglcontextlost', e => { e.preventDefault(); document.body.classList.add('no-motion'); });
  kick();
}
