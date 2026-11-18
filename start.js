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
  const archEl = document.getElementById('arch');
  const S = { ter: 0, pan: 0, dolly: 0, lt: 0, water: 0, plan: 0, dusk: 0, gate: 0 };
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
  const FS = `precision highp float;varying vec2 v;uniform sampler2D im,dp,sk,cl,li,sl;uniform vec4 archR;uniform vec2 res;uniform vec2 cov,mouse;uniform vec4 cam;uniform vec3 skyTop,avgTop;uniform float imgTop,time,dusk;
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
      // Blauer Bogen: innen Lagune + Skyline als Linie, deckungsgleich zum Foto (gleiche Kamera); außen weiter das Foto
      if(archR.z>archR.x){vec2 px=vec2(v.x,v.y)*res;vec4 a=archR*vec4(res,res);
        float rx=(a.z-a.x)*.5,ry=(a.w-a.y)*.48,cx=(a.x+a.z)*.5,cy=a.y+ry;
        float inR=step(a.x,px.x)*step(px.x,a.z)*step(a.y,px.y);
        vec2 e=(px-vec2(cx,cy))/vec2(rx,ry);float inE=px.y<cy?smoothstep(1.003,.997,length(e)):1.;
        float ins=inR*inE;
        if(ins>0.){vec2 SL=q.y>0.?texture2D(sl,qi).rg:vec2(0.);
          vec3 ac=vec3(.663,.765,.867)*(1.-.07*SL.g);
          ac=mix(ac,vec3(.012,.125,.239),SL.r*.8);
          col=mix(col,ac,ins);}}
      col+=(fract(sin(dot(gl_FragCoord.xy+fract(time*7.)*91.,vec2(12.9898,78.233)))*43758.5453)-.5)*.016;   // feines Filmkorn gegen CG-Look
      gl_FragColor=vec4(col,1.);}`;
  const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog); gl.useProgram(prog);
  const U = {}; ['im', 'dp', 'sk', 'cl', 'li', 'sl', 'archR', 'res', 'cov', 'mouse', 'cam', 'skyTop', 'avgTop', 'imgTop', 'time', 'dusk'].forEach(n => U[n] = gl.getUniformLocation(prog, n));
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const glTex = (img, unit, rep) => { const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER].forEach(p => gl.texParameteri(gl.TEXTURE_2D, p, gl.LINEAR));
    [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach(p => gl.texParameteri(gl.TEXTURE_2D, p, rep ? gl.REPEAT : gl.CLAMP_TO_EDGE)); };
  // Bilder als ImageBitmap laden: fertig entpackt abseits des Hauptthreads → Übergabe an die Grafikkarte ~13 ms statt ~900 ms Stillstand (live gemessen, 17.11.2026)
  const load = src => (window.createImageBitmap ? fetch(src).then(r => { if (!r.ok) throw 0; return r.blob(); }).then(b => createImageBitmap(b, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' }))
    : Promise.reject()).catch(() => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }));
  let depthReady = false, heroLive = true, cloudBoost = 0;
  let duskV = 0;   // angezeigter Sonnenstand: folgt dem Scrollziel S.dusk gedrosselt (voller Untergang ≥ ~4 s), damit schnelles Scrollen kein Aufblitzen erzeugt
  const t0 = performance.now(), CLOCK = () => (window.__heroT ?? (performance.now() - t0) / 1000);
  Promise.all([load('img/skyview-penthouse-dachterrasse-stephansdom' + (mobile ? '-m' : '') + '.webp'), load('img/skyview-penthouse-dachterrasse-stephansdom-tiefe.webp'), load('img/skyview-penthouse-dachterrasse-stephansdom-himmel.webp'), load('img/skyview-himmel-wolken.webp'), load('img/skyview-lichter.webp'), load('img/skyline-linie.webp')])
    .then(([a, b, c, d, e, f]) => { glTex(a, 0); glTex(b, 1); glTex(c, 2); glTex(d, 3, true); glTex(e, 4); gl.uniform1i(U.li, 4); glTex(f, 5); gl.uniform1i(U.sl, 5); document.body.classList.add('gl-arch'); gl.uniform1i(U.im, 0); gl.uniform1i(U.dp, 1); gl.uniform1i(U.sk, 2); gl.uniform1i(U.cl, 3); depthReady = true; kick(); requestAnimationFrame(() => window.__introTry && window.__introTry());
      // Große/Retina-Bildschirme: danach still die scharfe 3600-px-Version nachladen und austauschen
      // erst nach dem Einstieg (Intro fertig) und in einer ruhigen Sekunde – der Tausch des 3600-px-Bilds kostet einen Frame
      if (!mobile && innerWidth * (devicePixelRatio || 1) > 2400) setTimeout(() => load('img/skyview-penthouse-dachterrasse-stephansdom-xl.webp').then(x => (window.requestIdleCallback || setTimeout)(() => { glTex(x, 0); kick(); })).catch(() => {}), 5000); });

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
    gl.uniform1f(U.imgTop, top0 * (1 - S.ter)); gl.uniform1f(U.time, CLOCK() + cloudBoost);
    { const r = archEl.getBoundingClientRect(), W = innerWidth, H = innerHeight, on = r.top < H - 1;
      gl.uniform4f(U.archR, on ? r.left / W : 0, on ? r.top / H : 0, on ? r.right / W : 0, on ? r.bottom / H : 0); gl.uniform2f(U.res, W, H); } gl.uniform1f(U.dusk, duskV);
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
  // Seite startet immer ganz oben (Browser stellt sonst die alte Scrollposition oder einen #Anker wieder her)
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  scrollTo(0, 0);
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
    // Breite: „See beyond.“ etwas breiter als ESTATE → Kegelform (QUICK schmal, ESTATE mittel, See beyond. am breitesten); max. 92 % Bildschirm
    // Zeilenbreite je Zeile aus allen Teil-Rechtecken (Intro zerlegt das Wort in einzelne Buchstaben)
    sg.style.fontSize = ''; const r0 = document.createRange(); r0.selectNodeContents(w); const rows = {};
    [...r0.getClientRects()].forEach(r => { if (!r.width) return; const k = Math.round(r.top / 20); rows[k] = rows[k] || [1e9, -1e9]; rows[k][0] = Math.min(rows[k][0], r.left); rows[k][1] = Math.max(rows[k][1], r.right); });
    const lw = Math.max(...Object.values(rows).map(v => v[1] - v[0]));
    const sw = sg.getBoundingClientRect().width; if (sw > 0) sg.style.fontSize = (parseFloat(getComputedStyle(sg).fontSize) * Math.min(1.22 * lw, 0.92 * innerWidth) / sw) + 'px';
    const F = parseFloat(getComputedStyle(sg).fontSize), T = parseFloat(getComputedStyle(w).fontSize) * 1.22;
    const cur = parseFloat(sg.style.marginTop) || 0;
    const want = mt.getBoundingClientRect().bottom + 0.1 * T + 0.79 * F;
    sg.style.marginTop = (cur + want - ms.getBoundingClientRect().bottom) + 'px';
  };
  // Intro erst starten, wenn Schrift UND Himmelsbild da sind und die Seite sichtbar ist – sonst läuft es ungesehen ab (z. B. hinter dem Ladebildschirm)
  let introGo = 0; const introTry = () => { if (++introGo < 2) return; const go = () => { placeSig(); requestAnimationFrame(() => { placeSig(); heroIntro(); }); };
    document.visibilityState === 'visible' ? go() : document.addEventListener('visibilitychange', function v() { if (document.visibilityState === 'visible') { document.removeEventListener('visibilitychange', v); go(); } }); };
  window.__introTry = introTry;
  document.fonts.ready.then(() => { placeSig(); introTry(); }); setTimeout(() => { if (introGo < 2) { introGo = 1; introTry(); } }, 4000); addEventListener('resize', placeSig);
  // Einstieg: „See beyond.“ steht schon, QUICKESTATE schwebt weit auseinandergezogen herein und rückt zusammen (umgekehrt wie beim Scrollen)
  gsap.set('.qe-in', { opacity: 0 });
  // Buchstaben einzeln verschieben (nur transform/opacity = Grafikkarte) statt letter-spacing + Unschärfe am ganzen Wort (zwang jeden Frame zu Layout + Neuzeichnen → Ruckeln beim Laden)
  const heroIntro = () => {
    const w = document.querySelector('.qe-in');
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { gsap.set(w, { opacity: 1 }); return; }
    const fs = parseFloat(getComputedStyle(w).fontSize), ch = [];
    [...w.childNodes].forEach(n => { if (n.nodeType !== 3) return; const row = [...n.textContent], f = document.createDocumentFragment();
      row.forEach((c, i) => { const sp = document.createElement('span'); sp.className = 'qc'; sp.textContent = c; sp.dataset.o = ((i - (row.length - 1) / 2) * fs * 1.25).toFixed(1); f.appendChild(sp); ch.push(sp); });
      n.replaceWith(f); });
    gsap.set(w, { opacity: 1 });
    gsap.fromTo(ch, { x: i => +ch[i].dataset.o, opacity: 0 }, { x: 0, opacity: 1, duration: 2.4, ease: 'power3.out', delay: 0.5, stagger: { each: 0.02, from: 'edges' }, clearProps: 'transform,opacity' });
  };
  tl.to('#heroWord', { letterSpacing: '0.5em', opacity: 0, duration: 1 }, 0)
    .to('#tHero .sig', { y: -40, opacity: 0, duration: 0.8 }, 0.1)
    .to(S, { ter: 1, duration: 1.6, ease: 'power1.inOut' }, 0.2)
    .to(S, { pan: 1, dolly: 1, duration: 2.6 }, 0.8)
    .to(S, { dusk: 1, duration: 1.1, ease: 'none' }, 1.35)   // Sonne geht unter, bevor der blaue Bogen aufsteigt
    .to('#tTer', { opacity: 1, duration: 0.4 }, 1.3).to('#tTer', { opacity: 0, duration: 0.3 }, 2.4)
    .to('#arch', { yPercent: 0, xPercent: -50, duration: 1.1, ease: 'power2.out' }, 2.4)
    .to('#tArch', { opacity: 1, duration: 0.3 }, 3.0).to('#tArch', { opacity: 0, duration: 0.25 }, 4.25)
    .to('#arch', { scale: 3.4, duration: 0.9, ease: 'power2.in' }, 3.6)
    .to(S, { gate: 1, duration: 1.0, ease: 'none' }, 4.4)               // Tor klappt auf: Rechner mit Adressfeld
    .to('#cta', { autoAlpha: 0, duration: 0.2 }, 4.4).to('#cta', { autoAlpha: 1, duration: 0.2 }, 6.8)
    .to('#gate', { autoAlpha: 0, duration: 0.4 }, 6.5).to('#depth', { opacity: 0, duration: 0.4 }, 6.5)                 // weiter: So funktioniert's
    .to(S, { water: 1, duration: 1.4, ease: 'power1.inOut' }, 6.5)
    .to(S, { plan: 1, duration: 2.4 }, 7.7)
    .to('#tPlan', { opacity: 1, duration: 0.3 }, 8.05).to('#tPlan', { opacity: 0, duration: 0.3 }, 9.9)
    .to('#tNum', { opacity: 1, duration: 0.4 }, 9.8)
    .to({}, { duration: 0.6 }, 10.2);

  const cta = $('cta'), ctaText = $('ctaText'), hint = $('hint'), qeDot = $('qeDot');
  // Sprung zum offenen Tor (Rechner): Links mit #tor scrollen an die Stelle, an der das Tor ganz offen ist
  const toTor = e => { if (e.currentTarget.getAttribute('href') !== '#tor') return; e.preventDefault(); setMenu && !menu.hidden && setMenu(false); const st = tl.scrollTrigger; lenis.scrollTo(st.start + (st.end - st.start) * (5.7 / tl.duration()), { duration: 2.4 }); setTimeout(() => $('gateAddr').focus({ preventScroll: true }), 2500); };
  document.querySelectorAll('a[href="#tor"]').forEach(a => a.addEventListener('click', toTor));
  const CTAS = [[0, 'Grundstück prüfen', '#tor'], [0.06, 'Wohnung wählen', '#objekte'], [0.62, 'Folgen ansehen', '#folgen'], [0.8, 'Grundstück prüfen', '#tor']];
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
    document.body.classList.toggle('on-sky', !(p > 0.39 && p < 0.615)); heroLive = p < 0.4;   // Kopfzeile hell auf dunklem Grund – nur auf der hellen Lagune (Bogen) blau
  }
  gsap.ticker.add((t, dms) => { const d = S.dusk - duskV; if (Math.abs(d) > 0.0005) { const dt = Math.min(dms, 50) / 1000; duskV += Math.sign(d) * Math.min(Math.abs(d), dt * (0.16 + Math.abs(d) * 0.3)); kick(); } });
  gsap.ticker.add(() => { cloudBoost += Math.min(6, Math.abs(lenis.velocity || 0)) * 0.015; });             // Wolken ziehen beim Scrollen kurz schneller (Wind)
  /* QE-Monogramm: roter Punkt kreist beim Scrollen im Uhrzeigersinn ums Q (nur vorwärts) und rollt nach dem Loslassen
     wie eine Roulettekugel aus – Zielposition = nächstgelegene Q-Stellung am natürlichen Ausrollpunkt, Geschwindigkeit
     nimmt danach geometrisch ab (v = c·Restweg) → kein Stopp-und-Neustart, kein harter Halt. */
  const Q_REST = Math.PI / 4, TAU = Math.PI * 2, Q_CMIN = 0.01, Q_CMAX = 0.03;
  let qa = Q_REST, qv = 0, qt = null, qc = 0, qbl = 1;
  const qeStill = matchMedia('(prefers-reduced-motion: reduce)').matches;
  gsap.ticker.add(() => {
    if (qeStill) return;
    const k = gsap.ticker.deltaRatio(60), lv = Math.abs(lenis.velocity || 0);
    const want = lv > 0.3 ? Math.min(0.3, lv * 0.011) : 0;
    if (want > qv + 0.002) {                                 // Scrollen schiebt an (nur vorwärts) – langsamer werden = Schwungrad läuft frei aus
      qv += (want - qv) * (1 - Math.pow(0.88, k));
      qt = null;
    } else if (qv > 0 || qt !== null) {
      if (qt === null) {                                     // Loslassen: Landeplatz planen
        const stop = qa + qv / 0.016;
        qt = Q_REST + Math.round((stop - Q_REST) / TAU) * TAU;
        while (qt - qa < 0.02 || qv / (qt - qa) > Q_CMAX) qt += TAU;
        const c = qv / (qt - qa);
        qc = Math.max(Q_CMIN, Math.min(Q_CMAX, c)); qbl = c >= Q_CMIN ? 1 : 0.035;
      }
      const r = qt - qa;
      if (r < 0.0004) { qa = qt; qv = 0; qt = null; }
      else { qv += (qc * r - qv) * (qbl === 1 ? 1 : 1 - Math.pow(1 - qbl, k)); }
    }
    qa += qv * k;
    if (qt !== null && qa > qt) { qa = qt; qv = 0; qt = null; }
    qeDot.setAttribute('cx', (52 + 45 * Math.cos(qa)).toFixed(2));
    qeDot.setAttribute('cy', (58 + 45 * Math.sin(qa)).toFixed(2));
  });
  const menuBtn = $('menuBtn'), menu = $('menu');
  const setMenu = open => { menu.hidden = !open; menuBtn.setAttribute('aria-expanded', String(open)); const ml = menuBtn.querySelector('.roll'); ml.textContent = open ? 'Schließen' : 'Menü'; rollify(ml); open ? lenis.stop() : lenis.start(); };
  menuBtn.addEventListener('click', () => setMenu(menu.hidden));
  menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setMenu(false)));   // Link im Menü schließt es
  addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) setMenu(false); });
  $('seal').addEventListener('click', e => { e.preventDefault(); lenis.scrollTo(0, { duration: 2.2 }); });

  // Tor zum Rechner: Der blaue Bogen füllt den Bildschirm – im Blau steigt der Rechner-Einstieg Zeile für Zeile auf
  // (Frage → Erklärung → Adressfeld). Kein Farbwechsel, kein Keil (Eduard 16.11.).
  const gateEl = $('gate');
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
  function drawGate() {
    const W = innerWidth, H = innerHeight, p = S.gate;
    gateEl.style.visibility = p > 0.001 ? 'visible' : 'hidden';
    gateEl.classList.toggle('open', p > 0.98);
    [...gateEl.querySelectorAll('.g-in > *')].forEach((c, i) => { const q = Math.min(1, Math.max(0, p * 1.5 - i * 0.12)); const e2 = 1 - Math.pow(1 - q, 3);
      c.style.opacity = e2; c.style.transform = 'translateY(' + ((1 - e2) * 24).toFixed(1) + 'px)'; });
  }
  gsap.ticker.add(drawGate);
  // Riesenrad: Rad dreht (eine Runde ≈ 60 s), Waggons bleiben senkrecht hängen; „Prüfen“ gibt kurz Schwung
  const wRot = $('wheelRot'), gons = [...document.querySelectorAll('#wheelGon .gon')];
  let wA = 0, wV = 6, wBoost = 0;
  gsap.ticker.add((t, dms) => { if (!wRot || S.gate < 0.01 || document.body.classList.contains('no-motion')) return;
    const dt = Math.min(dms, 50) / 1000; wBoost *= Math.pow(0.35, dt); wA = (wA + (wV + wBoost) * dt) % 360;
    wRot.setAttribute('transform', 'rotate(' + wA.toFixed(2) + ')');
    gons.forEach((g, i) => { const a = (wA + i * 24 - 90) * Math.PI / 180, x = 250 * Math.cos(a), y = 250 * Math.sin(a);
      g.setAttribute('transform', 'translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ')');
      const tx = g.querySelector('text'); if (tx) tx.style.opacity = (0.35 + 0.65 * Math.max(0, -y / 250)).toFixed(2); }); });
  /* ── Baurechner Schritt 1: Adresse → Grundstück im Flächenwidmungsplan (17.11.2026) ──────────────────────────────
     Adresse: Adress-Service der Stadt Wien (OGD, CORS). Grundstück: BEV-Kataster als eigene Kacheln unter /kataster/16/
     (Zoom-16-Kacheln, Ringe als ganze Zahlen 1e-7 Grad, Start + Differenzen – Format wie im Rechner v204).
     Plan: WMTS-Kacheln flwbplmzk/rot der Stadt Wien. Nichts wird gespeichert. */
  const gIn = $('gateAddr'), gMsg = $('gateMsg'), gSug = $('gateSug'), gRes = $('gateRes'), gBox = document.querySelector('.g-in');
  const ADR = q => 'https://data.wien.gv.at/daten/OGDAddressService.svc/GetAddressInfo?Address=' + encodeURIComponent(q) + '&crs=EPSG:4326';
  const hol = u => fetch(u, AbortSignal.timeout ? { signal: AbortSignal.timeout(8000) } : {});   // nie ewig „Suche …“
  let wahlN = 0;                                                            // jede neue Suche macht ältere Antworten ungültig
  // „Sommerschuhgasse 3, 1230 Wien“: Stadt-Suche findet mit PLZ/Wien nur die Straße → PLZ und „Wien“ abtrennen, PLZ zum Sortieren nutzen (Eduard 18.11.)
  const adrSuche = q => { const m = q.match(/^(.*?)(?:[,\s]+(1\d{3}))?(?:[,\s]+Wien)?[,\s]*$/i), kern = m && m[1].trim() ? m[1].trim() : q, plz = m && m[2];
    return hol(ADR(kern)).then(r => r.ok ? r.text() : Promise.reject(r.status)).then(t => { try { const L = (JSON.parse(t).features || []).filter(f => f.geometry && f.properties);
      return plz ? L.sort((x, y) => (y.properties.PostalCode === plz) - (x.properties.PostalCode === plz)) : L; } catch { return []; } }); };
  const adrText = f => f.properties.Adresse + (f.properties.PostalCode ? ', ' + f.properties.PostalCode + ' Wien' : ', Wien');
  const hatNr = f => !!f.properties.StreetNumber;
  let sugList = [], sugT = 0, sugN = 0, kgNamen = null, modus = 'adr';
  // Vorschlagsliste: Einträge {t: Text, w: Auswahl-Funktion}
  const sugZeigen = L => { sugList = L; gSug.textContent = ''; L.forEach(x => { const li = document.createElement('li'); li.setAttribute('role', 'option'); li.tabIndex = -1;
      li.textContent = x.t; li.addEventListener('mousedown', e => { e.preventDefault(); x.w(); }); gSug.append(li); }); gSug.hidden = !L.length; };
  const adrSug = L => L.map(f => ({ t: adrText(f) + (hatNr(f) ? '' : ' – ganze Straße zeigen'), w: () => waehlen(f) }));
  // Grundstückssuche: „Jedlesee 675“, „01609 675/2“ – Katastralgemeinde (Name oder Nummer) + Grundstücksnummer
  const gstTeile = q => { const m = /^(.*?)[\s,]+(\.?\d+(?:\s*\/\s*\d+)?)\s*$/.exec(q.trim()); return m ? { kg: m[1].trim(), nr: m[2].replace(/\s+/g, '') } : { kg: q.trim(), nr: '' }; };
  const kgNorm = t => t.toLowerCase().replace(/^kg\s+/, '').replace(/ß/g, 'ss').replace(/[^a-z0-9äöü]/g, '');
  const kgTreffer = t => { const K = M.kg || {}, n = kgNorm(t); if (!n) return [];
    return Object.keys(K).filter(c => c === t.trim() || kgNorm(K[c]).startsWith(n) || kgNorm(K[c]).includes(n)).sort((x, y) => (kgNorm(K[y]).startsWith(n) - kgNorm(K[x]).startsWith(n)) || K[x].localeCompare(K[y], 'de')); };
  async function gstSuche(q) { const tok = ++wahlN;
    await ladeKg(); if (tok !== wahlN) return; const { kg, nr } = gstTeile(q), T = kgTreffer(kg), K = M.kg || {};
    const exakt = T.find(c => kgNorm(K[c]) === kgNorm(kg) || c === kg);
    if (!T.length) { gMsg.textContent = 'Diese Katastralgemeinde kenne ich nicht – z. B. „Jedlesee 675“.'; return; }
    if (!exakt && T.length > 1) { gMsg.textContent = 'Welche Katastralgemeinde meinst du?'; sugZeigen(T.slice(0, 6).map(c => ({ t: 'KG ' + K[c] + ' (' + c + ')', w: () => { gIn.value = K[c] + ' ' + nr; gMsg.textContent = ''; sugZeigen([]); if (nr) gstSuche(gIn.value); else gIn.focus(); } }))); return; }
    const c = exakt || T[0]; if (!nr) { gMsg.textContent = 'Bitte noch die Grundstücksnummer dazuschreiben, z. B. „' + K[c] + ' 675“.'; return; }
    gMsg.textContent = 'Grundstück wird gesucht …';
    let idx; try { idx = await hol('kataster/kg/' + c + '.json').then(r => r.json()); } catch { gMsg.textContent = 'Der Kataster ist gerade nicht erreichbar – bitte nochmal versuchen.'; return; }
    if (tok !== wahlN) return; const pt = idx && idx[nr]; if (!pt) { gMsg.textContent = 'Grundstück ' + nr + ' gibt es in der KG ' + K[c] + ' laut Kataster nicht.'; return; }
    const [x, y] = kKachel(pt[0], pt[1], KZ), d = await katLaden(x, y), rec = d.find(r => r[0] === c && r[1] === nr); if (tok !== wahlN) return;
    if (!rec) { gMsg.textContent = 'Grundstück ' + nr + ' konnte ich nicht laden – bitte nochmal versuchen.'; return; }
    const g = { kg: rec[0], gnr: rec[1], fl: +rec[2] || 0, polys: (rec[3] || []).map(pg => pg.map(kRing)) };
    gMsg.textContent = ''; M.marks = []; M.akt = null; nummernZeigen(); zeigeBox();
    requestAnimationFrame(() => { zoomAuf(bbox(g.polys.flatMap(pg => pg[0])), 0.5); grundstueckZeigen(g, ' · über Grundstücksnummer gesucht', pt); }); }
  // Reiter Adresse | Grundstück – immer nur eine Suchart aktiv
  const MODI = { adr: { ph: 'Stephansplatz 1, 1010 Wien', lab: 'Adresse in Wien' }, gst: { ph: 'Katastralgemeinde + Nr., z. B. Jedlesee 675', lab: 'Katastralgemeinde und Grundstücksnummer' } };
  document.querySelectorAll('.g-tabs [role=tab]').forEach(t => t.addEventListener('click', () => { const m = t.dataset.m; if (m === modus) return; modus = m; ++wahlN;
    document.querySelectorAll('.g-tabs [role=tab]').forEach(x => x.setAttribute('aria-selected', x === t)); gIn.value = ''; gMsg.textContent = ''; sugZeigen([]);
    gIn.placeholder = MODI[m].ph; document.querySelector('label[for=gateAddr]').textContent = MODI[m].lab; gIn.setAttribute('inputmode', 'text');
    const f = $('gateForm'); f.classList.remove('swap'); void f.offsetWidth; f.classList.add('swap'); gIn.focus({ preventScroll: true }); if (m === 'gst') ladeKg(); }));
  gIn.addEventListener('input', () => { gMsg.textContent = ''; clearTimeout(sugT); const q = gIn.value.trim();
    if (modus === 'gst') { const { kg, nr } = gstTeile(q); if (nr || kg.length < 2) { sugZeigen([]); return; }
      ladeKg().then(() => { const K = M.kg || {}; sugZeigen(kgTreffer(kg).slice(0, 6).map(c => ({ t: 'KG ' + K[c] + ' (' + c + ')', w: () => { gIn.value = K[c] + ' '; sugZeigen([]); gIn.focus(); } }))); }); return; }
    if (q.length < 3) { sugZeigen([]); return; }
    const n = ++sugN; sugT = setTimeout(() => adrSuche(q).then(L => { if (n === sugN && document.activeElement === gIn) sugZeigen(adrSug(L.slice(0, 6))); }).catch(() => {}), 280); });
  gIn.addEventListener('keydown', e => { const it = [...gSug.children]; if (gSug.hidden || !it.length) return; let i = it.indexOf(gSug.querySelector('.on'));
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); i = e.key === 'ArrowDown' ? Math.min(it.length - 1, i + 1) : Math.max(-1, i - 1); it.forEach((li, k) => li.classList.toggle('on', k === i)); }
    else if (e.key === 'Enter' && i >= 0) { e.preventDefault(); sugList[i].w(); } else if (e.key === 'Escape') sugZeigen([]); });
  gIn.addEventListener('blur', () => setTimeout(() => sugZeigen([]), 120));
  $('gateForm').addEventListener('submit', e => { e.preventDefault(); const q = gIn.value.trim(); if (q) wBoost = 140; clearTimeout(sugT); ++sugN; sugZeigen([]);
    if (!q) { gMsg.textContent = modus === 'gst' ? 'Bitte Katastralgemeinde und Grundstücksnummer eingeben, z. B. „Jedlesee 675“.' : 'Bitte eine Adresse in Wien eingeben.'; gIn.focus(); return; }
    if (modus === 'gst') { gstSuche(q); return; }
    gMsg.textContent = 'Suche …';
    adrSuche(q).then(L => { const f = L.find(hatNr);
      if (!L.length) { gMsg.textContent = 'Diese Adresse habe ich in Wien nicht gefunden – Schreibweise prüfen (z. B. „Gerstlgasse 18“).'; return; }
      waehlen(f || L[0]); }).catch(() => { gMsg.textContent = 'Die Adresssuche der Stadt Wien ist gerade nicht erreichbar – bitte gleich nochmal versuchen.'; }); });
  $('resBack').addEventListener('click', () => { ++wahlN; kartenLeeren(); M.marks = []; M.sel = null; M.akt = null; nummernZeigen(); gBox.classList.remove('has-res'); gRes.hidden = true; gIn.value = ''; gMsg.textContent = ''; gIn.focus({ preventScroll: true }); });

  // Kataster
  const KZ = 16, katC = new Map();
  const kKachel = (lon, lat, z) => { const n = 2 ** z, la = lat * Math.PI / 180; return [Math.floor((lon + 180) / 360 * n), Math.floor((1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2 * n)]; };
  const katLaden = (x, y) => { const k = x + '_' + y; if (!katC.has(k)) katC.set(k, hol('kataster/16/' + k + '.json').then(r => r.status === 404 ? [] : r.ok ? r.json() : Promise.reject(r.status)).catch(() => { katC.delete(k); return []; }));  return katC.get(k); };
  const kRing = fl => { const r = []; let x = 0, y = 0; for (let i = 0; i + 1 < fl.length; i += 2) { x += fl[i]; y += fl[i + 1]; r.push([x / 1e7, y / 1e7]); } return r; };
  const kDrin = (p, rg) => { let c = false; for (let i = 0, j = rg.length - 1; i < rg.length; j = i++) { const [xi, yi] = rg[i], [xj, yj] = rg[j];
      if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) c = !c; } return c; };
  const kInPoly = (p, polys) => polys.some(pg => kDrin(p, pg[0]) && !pg.slice(1).some(h => kDrin(p, h)));
  const kSegAbst = (p, a, b) => { const kx = 74000, ky = 111200, ax = (a[0] - p[0]) * kx, ay = (a[1] - p[1]) * ky, bx = (b[0] - p[0]) * kx, by = (b[1] - p[1]) * ky;   // Meter (Wien, grob)
    const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / ((dx * dx + dy * dy) || 1))); return Math.hypot(ax + t * dx, ay + t * dy); };
  async function grundstueck(lon, lat) {
    const [x, y] = kKachel(lon, lat, KZ), d = await katLaden(x, y), P = d.map(r => ({ kg: r[0], gnr: r[1], fl: +r[2] || 0, polys: (r[3] || []).map(pg => pg.map(kRing)) }));
    const hit = P.find(g => kInPoly([lon, lat], g.polys)); if (hit) return { g: hit, alle: P, genau: true };
    let best = null, bd = 12;                                        // Adresspunkt auf Gehsteig/Straße → nächstes Grundstück bis 12 m
    P.forEach(g => g.polys.forEach(pg => pg[0].forEach((a, i, R) => { const dd = kSegAbst([lon, lat], a, R[(i + 1) % R.length]); if (dd < bd) { bd = dd; best = g; } })));
    return best ? { g: best, alle: P, genau: false } : null; }

  /* Bauplatz = alle Grundstücke derselben Einlagezahl (EZ) wie das Adress-Grundstück – EZ live aus dem BEV-Kataster (Vektorkacheln kataster.bev.gv.at,
     tagesaktuell, CC BY 4.0). Stichprobe 17.11.2026, 120 Adressen: ~95 % ohne Zutun richtig. Grenzen/Flächen aus unserem Katasterstand. */
  const bevC = new Map();
  const bevLaden = (x, y) => { const k = x + '_' + y; if (!bevC.has(k)) bevC.set(k, hol('https://kataster.bev.gv.at/tiles/kataster/16/' + x + '/' + y + '.pbf')
    .then(r => r.ok ? r.arrayBuffer() : null).then(b => b && window.MVT ? (MVT.lies(b, 16, x, y).gst || []) : []).catch(() => { bevC.delete(k); return []; })); return bevC.get(k); };
  const um9 = (x, y, f) => { const L = []; for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) L.push(f(x + dx, y + dy)); return Promise.all(L); };
  const flBerechnet = polys => polys.reduce((s, pg) => s + pg.reduce((t, r, i) => { let a = 0; for (let j = 0; j < r.length - 1; j++) a += (r[j][0] * 74000) * (r[j + 1][1] * 111200) - (r[j + 1][0] * 74000) * (r[j][1] * 111200); return t + (i ? -1 : 1) * Math.abs(a / 2); }, 0), 0);
  async function bauplatz(g, lon, lat) {
    const [x, y] = kKachel(lon, lat, KZ);
    const [bev, unser] = await Promise.all([um9(x, y, bevLaden).then(a => a.flat()), um9(x, y, katLaden).then(a => a.flat())]);
    const s = bev.find(f => f.p.kg === g.kg && f.p.gnr === g.gnr) || bev.find(f => kInPoly([lon, lat], f.polys));
    if (!s || !s.p.ez) return { teile: [g], ez: null };
    const gleich = [...new Set(bev.filter(f => f.p.ez === s.p.ez && f.p.kgez === s.p.kgez).map(f => f.p.kg + '|' + f.p.gnr))];
    const B0 = bbox(g.polys.flatMap(pg => pg[0])), nah = q => { const b = bbox(q.polys.flatMap(pg => pg[0])); return b[0] < B0[2] + 0.004 && b[2] > B0[0] - 0.004 && b[1] < B0[3] + 0.0027 && b[3] > B0[1] - 0.0027; };   // ~300 m
    if (gleich.length > 20) return { teile: [g], ez: s.p.ez, kgez: s.p.kgez, gross: gleich.length };
    const U = new Map(); unser.forEach(r => U.set(r[0] + '|' + r[1], r));
    const teile = gleich.map(k => { if (k === g.kg + '|' + g.gnr) return g; const r = U.get(k); const [kg, gnr] = k.split('|');
      if (r) return { kg, gnr, fl: +r[2] || 0, polys: (r[3] || []).map(pg => pg.map(kRing)) };
      const polys = bev.filter(f => f.p.kg === kg && f.p.gnr === gnr).flatMap(f => f.polys); return polys.length ? { kg, gnr, fl: Math.round(flBerechnet(polys) * 100) / 100, polys, neu: true } : null; })
      .filter(Boolean).filter(t => t === g || nah(t));
    const nk = t => parseInt(t.gnr.replace(/^\./, ''), 10) || 0; teile.sort((a, b) => nk(a) - nk(b) || a.gnr.localeCompare(b.gnr, 'de'));
    return { teile, ez: s.p.ez, kgez: s.p.kgez }; }
  // Bauplatz für die Anzeige: Gesamtfläche, alle Flächen, Kanten (außen durchgezogen, zwischen den Grundstücken strichliert)
  function bauplatzObjekt(bp) {
    const T = bp.teile, polys = T.flatMap(t => t.polys), kanten = [];
    T.forEach(t => t.polys.forEach(pg => pg.forEach(r => { for (let i = 0; i < r.length - 1; i++) { const a = r[i], b = r[i + 1], m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const innen = T.some(u => u !== t && u.polys.some(pq => pq.some(rr => rr.some((c, j) => j < rr.length - 1 && kSegAbst(m, c, rr[j + 1]) < 0.3)))); kanten.push([a, b, innen]); } })));
    return { amtl: T.every(t => t.amtl), kg: T[0].kg, gnr: T.map(t => t.gnr).join(' + '), fl: Math.round(T.reduce((s, t) => s + t.fl, 0) * 100) / 100, polys, kanten, teile: T, ez: bp.ez, kgez: bp.kgez, gross: bp.gross }; }
  const mitTimeout = (pr, ms, ersatz) => Promise.race([pr, new Promise(r => setTimeout(() => r(ersatz), ms))]);
  /* Amtliche Fläche je Grundstück aus dem BEV-Grundstücksverzeichnis (= Grundbuch, CC BY 4.0), je KG eine Datei. Errechnete Fläche nur als Ersatz („ca.“). */
  const flC = new Map();
  const flAmt = kg => { if (!flC.has(kg)) flC.set(kg, hol('kataster/fl/' + kg + '.json').then(r => r.ok ? r.json() : {}).catch(() => { flC.delete(kg); return {}; })); return flC.get(kg); };
  async function bauplatzFuer(g, lon, lat) { let bp; try { bp = await mitTimeout(bauplatz(g, lon, lat), 4000, { teile: [g], ez: null }); } catch { bp = { teile: [g], ez: null }; }
    await Promise.all(bp.teile.map(async t => { if (t.amtl) return; const A = await mitTimeout(flAmt(t.kg), 3000, {}); if (A && A[t.gnr] != null) { t.flBer = t.fl; t.fl = A[t.gnr]; t.amtl = true; } }));
    return bauplatzObjekt(bp); }
  const grundNr = a => (a.str || '') + ' ' + String(a.nr || '').split(/[/(\s]/)[0].replace(/[A-Za-z]+$/, '');

  // Plan als bewegliche Karte: Ziehen = verschieben, + / − = zoomen (kein Mausrad – das bleibt fürs Seiten-Scrollen), Klick = Grundstück bzw. Hausnummer wählen
  const kMerc = (lon, lat) => { const la = lat * Math.PI / 180; return [(lon + 180) / 360 * 256, (1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2 * 256]; };   // Weltpixel Zoom 0
  const kGeo = (x, y) => [x / 256 * 360 - 180, Math.atan(Math.sinh(Math.PI * (1 - 2 * y / 256))) * 180 / Math.PI];
  const NS = 'http://www.w3.org/2000/svg', mapEl = $('resMap'), tilesEl = $('resTiles'), ovEl = $('resOv'), ldEl = $('resLoad');
  const M = { cx: 0, cy: 0, k: 1, sel: null, pt: null, marks: [], tiles: new Map(), tz: 0 };
  const mapS = () => mapEl.clientWidth || 400;
  const KMIN = 2 ** 17, KMAX = 2 ** 20;   // nie bis zur bunten Übersicht hinaus – immer Detailplan mit roten Linien
  function mapRender() {
    const s = mapS(), k = M.k, dpr = Math.min(2, devicePixelRatio || 1), zw = Math.round(Math.log2(k * dpr)), tz = Math.max(12, Math.min(19, zw));   // Plan gibt es bis Stufe 19, Luftbild bis 20
    const css = (x, y) => [(x - M.cx) * k + s / 2, (y - M.cy) * k + s / 2];
    const need = new Set(); let pend = 0;
    const LAG = M.lb ? ['lb/farbe', 'flwbplmzk/rot'] : ['flwbplmzk/rot'];   // Luftbild: Orthofoto unten, Widmungsplan darüber (Weiß wird per multiply durchsichtig)
    const zAkt = new Set();
    LAG.forEach(lg => { const tz = lg === 'lb/farbe' ? Math.max(12, Math.min(20, zw)) : Math.max(12, Math.min(19, zw)), n = 2 ** tz; zAkt.add(lg + tz);
    const tx0 = Math.floor((M.cx - s / 2 / k) * n / 256), tx1 = Math.floor((M.cx + s / 2 / k) * n / 256), ty0 = Math.floor((M.cy - s / 2 / k) * n / 256), ty1 = Math.floor((M.cy + s / 2 / k) * n / 256);
    for (let tx = tx0; tx <= tx1; tx++) for (let ty = ty0; ty <= ty1; ty++) { const key = lg + '/' + tz + '/' + ty + '/' + tx; need.add(key);
      let im = M.tiles.get(key); if (!im) { im = new Image(); im.alt = ''; im.decoding = 'async'; im.dataset.z = tz; im.dataset.x = tx; im.dataset.y = ty; im.dataset.li = lg === 'lb/farbe' ? 0 : 1; im.dataset.lg = lg; im.className = lg === 'lb/farbe' ? 'tlb' : 'tpl';
        im.onload = im.onerror = () => { im.dataset.ok = 1; aufraeumen(); }; im.src = 'https://maps.wien.gv.at/wmts/' + lg + '/google3857/' + tz + '/' + ty + '/' + tx + '.jpeg'; M.tiles.set(key, im); tilesEl.append(im); }
      if (!im.dataset.ok) pend++; } });
    M.need = need; M.tz = tz;
    M.tiles.forEach(im => { const z = +im.dataset.z, f = 256 / 2 ** z, [l, t] = css(+im.dataset.x * f, +im.dataset.y * f), w = 256 * k / 2 ** z;
      im.style.left = l.toFixed(1) + 'px'; im.style.top = t.toFixed(1) + 'px'; im.style.width = im.style.height = (w + 0.6).toFixed(1) + 'px'; im.style.zIndex = (zAkt.has(im.dataset.lg + z) ? 2 : 0) + +im.dataset.li; });
    ldEl.hidden = pend === 0; aufraeumen();
    ovEl.setAttribute('viewBox', '0 0 ' + s + ' ' + s); ovEl.textContent = '';
    const P = c => css(...kMerc(c[0], c[1])).map(v => v.toFixed(1)).join(' ');
    if (M.zon) zonZeichnen(ovEl, P, css);
    if (M.sel) { const p = document.createElementNS(NS, 'path'); p.setAttribute('d', M.sel.polys.map(pg => pg.map(r => 'M' + r.map(P).join('L') + 'Z').join('')).join('')); p.setAttribute('class', M.sel.kanten ? 'gsf' : 'gs'); p.setAttribute('fill-rule', 'evenodd'); ovEl.append(p);
      if (M.sel.kanten) [false, true].forEach(inn => { const q = document.createElementNS(NS, 'path'); q.setAttribute('d', M.sel.kanten.filter(k => k[2] === inn).map(k => 'M' + P(k[0]) + 'L' + P(k[1])).join('')); q.setAttribute('class', inn ? 'gsi' : 'gsa'); ovEl.append(q); }); }
    if (M.sel && M.sel.teile && M.k >= 2 ** 17.4) { const lb = [];   // Grundstücksnummer in die Mitte jedes Teils; nur wenn sie hineinpasst und nichts überdeckt (Eduard 18.11.)
      [...M.sel.teile].sort((a, b) => (b.fl || 0) - (a.fl || 0)).forEach(t => { const R = t.polys[0][0].map(c => css(...kMerc(c[0], c[1]))), xs = R.map(q => q[0]), ys = R.map(q => q[1]);
        let A = 0, cx = 0, cy = 0; for (let k = 0; k < R.length; k++) { const [x1, y1] = R[k], [x2, y2] = R[(k + 1) % R.length], f = x1 * y2 - x2 * y1; A += f; cx += (x1 + x2) * f; cy += (y1 + y2) * f; }
        if (Math.abs(A) < 1e-6) return; cx /= 3 * A; cy /= 3 * A; const w = t.gnr.length * 7.4 + 6;
        const frei = (x, y) => !lb.some(b => Math.abs(b[0] - x) < (b[2] + w) / 2 + 2 && Math.abs(b[1] - y) < 17);
        const passt = Math.max(...xs) - Math.min(...xs) >= w * 0.8 && Math.max(...ys) - Math.min(...ys) >= 15;
        let x = cx, y = cy; if (!passt || !frei(x, y)) { const kand = [[0, -24], [0, 24], [w * 0.8, 0], [-w * 0.8, 0], [w * 0.6, -22], [-w * 0.6, -22], [w * 0.6, 22], [-w * 0.6, 22], [0, -44], [0, 44]]; const f = kand.find(([dx, dy]) => frei(cx + dx, cy + dy)); if (f) { x = cx + f[0]; y = cy + f[1]; } }
        lb.push([x, y, w]); if (x !== cx || y !== cy) { const ln = document.createElementNS(NS, 'path'); ln.setAttribute('d', 'M' + cx.toFixed(1) + ' ' + cy.toFixed(1) + 'L' + x.toFixed(1) + ' ' + (y - 2).toFixed(1)); ln.setAttribute('class', 'gnrl'); ovEl.append(ln);
          const pt = document.createElementNS(NS, 'circle'); pt.setAttribute('cx', cx.toFixed(1)); pt.setAttribute('cy', cy.toFixed(1)); pt.setAttribute('r', '2.2'); pt.setAttribute('class', 'gnrp'); ovEl.append(pt); }
        const tx = document.createElementNS(NS, 'text'); tx.setAttribute('x', x.toFixed(1)); tx.setAttribute('y', (y + 4).toFixed(1)); tx.setAttribute('class', 'gnr'); tx.textContent = t.gnr; ovEl.append(tx); }); }
    const belegt = [];                                                       // Hausnummern-Schilder; zu eng beisammen → weglassen statt Ameisenhaufen
    M.marks.forEach(m => { const [x, y] = css(...kMerc(m.lon, m.lat)); if (x < -20 || y < -20 || x > s + 20 || y > s + 20) return;
      const w = 10 + 6.2 * m.nr.length; if (m !== M.akt && belegt.some(b => Math.abs(b[0] - x) < (b[2] + w) / 2 + 2 && Math.abs(b[1] - y) < 17)) return; belegt.push([x, y, w]);
      const r = document.createElementNS(NS, 'rect'); r.setAttribute('x', (x - w / 2).toFixed(1)); r.setAttribute('y', (y - 8).toFixed(1)); r.setAttribute('width', w.toFixed(1)); r.setAttribute('height', 16); r.setAttribute('rx', 3); r.setAttribute('class', 'hn' + (m === M.akt ? ' on' : '')); ovEl.append(r);
      const t = document.createElementNS(NS, 'text'); t.setAttribute('x', x.toFixed(1)); t.setAttribute('y', (y + 3.5).toFixed(1)); t.setAttribute('class', 'hnt'); t.textContent = m.nr; ovEl.append(t); });
    if (M.pt) { const [x, y] = css(...kMerc(M.pt[0], M.pt[1])), c = document.createElementNS(NS, 'circle'); c.setAttribute('cx', x.toFixed(1)); c.setAttribute('cy', y.toFixed(1)); c.setAttribute('r', 5); c.setAttribute('class', 'ap'); ovEl.append(c); }
    hlUpdate(css); }
  function aufraeumen() {                                                   // alte Zoomstufe erst entfernen, wenn die neue fertig ist
    if (!M.need) return; const fertig = [...M.need].every(k => { const im = M.tiles.get(k); return im && im.dataset.ok; });
    if (fertig) { ldEl.hidden = true; M.tiles.forEach((im, key) => { if (!M.need.has(key)) { im.remove(); M.tiles.delete(key); } }); } }
  let rq = 0; const mapKick = () => { if (!rq) rq = requestAnimationFrame(() => { rq = 0; mapRender(); }); };
  const zoomAuf = (box, anteil) => { const s = mapS(), [x0, y0] = kMerc(box[0], box[3]), [x1, y1] = kMerc(box[2], box[1]);
    M.cx = (x0 + x1) / 2; M.cy = (y0 + y1) / 2; M.k = Math.max(KMIN, Math.min(2 ** 19.6, anteil * s / Math.max(x1 - x0, y1 - y0, 1e-9))); };
  const bbox = pts => [Math.min(...pts.map(p => p[0])), Math.min(...pts.map(p => p[1])), Math.max(...pts.map(p => p[0])), Math.max(...pts.map(p => p[1]))];
  $('mapIn').addEventListener('click', () => { M.k = Math.min(KMAX, M.k * 2); mapKick(); });
  document.querySelectorAll('#mapLay button').forEach(bt => bt.addEventListener('click', () => { M.lb = bt.dataset.l === '1';   // Plan ↔ Luftbild mit Widmungslinien
    document.querySelectorAll('#mapLay button').forEach(x => x.setAttribute('aria-pressed', x === bt)); mapEl.classList.toggle('g-lb', M.lb); mapKick(); }));
  $('mapOut').addEventListener('click', () => { M.k = Math.max(KMIN, M.k / 2); mapKick(); });
  let drag = null, tipT = 0; const tipZeigen = () => { const t = $('mapTip'); t.classList.add('on'); clearTimeout(tipT); tipT = setTimeout(() => t.classList.remove('on'), 4500); };
  mapEl.addEventListener('pointerdown', e => { if (e.target.closest('.g-zoom')) return; $('mapTip').classList.remove('on'); drag = { x: e.clientX, y: e.clientY, cx: M.cx, cy: M.cy, moved: false }; mapEl.setPointerCapture(e.pointerId); mapEl.classList.add('drag'); });
  mapEl.addEventListener('pointermove', e => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.hypot(dx, dy) > 4) drag.moved = true;
    if (drag.moved) { M.cx = drag.cx - dx / M.k; M.cy = drag.cy - dy / M.k; mapKick(); } });
  const dragEnde = e => { if (!drag) return; const d = drag; drag = null; mapEl.classList.remove('drag'); if (d.moved || e.type === 'pointercancel') return;
    const r = mapEl.getBoundingClientRect(), s = mapS(), px = e.clientX - r.left, py = e.clientY - r.top;
    const hit = M.marks.find(m => { const [mx, my] = kMerc(m.lon, m.lat); return Math.hypot((mx - M.cx) * M.k + s / 2 - px, (my - M.cy) * M.k + s / 2 - py) < (e.pointerType === 'touch' ? 22 : 12); });
    if (hit) { nummerWaehlen(hit); return; }
    const [lon, lat] = kGeo(M.cx + (px - s / 2) / M.k, M.cy + (py - s / 2) / M.k);
    const zz = M.zonZiel && M.zon && M.zonZiel.find(z => z.poly.reduce((a, r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) c = !c; } return a !== c; }, false));
    if (zz) { if (!zz.sec.classList.contains('auf')) zz.kopf.click(); if (zz.el !== zz.kopf && zz.el.getAttribute('aria-expanded') !== 'true') zz.el.click(); zz.sec.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); return; }   // Fläche im Plan antippen = passender Abschnitt im Steckbrief
    parzelleWaehlen(lon, lat); };
  mapEl.addEventListener('pointerup', dragEnde); mapEl.addEventListener('pointercancel', dragEnde);

  const flText = g => g.fl.toLocaleString('de-AT', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  /* Umfeld je Bauplatz (Punkt 11–13): Widmung + Bauklasse (GENFLWIDMUNGOGD), Schutzzone, Wohnzone, Bausperre, Bestand (GEBAEUDEINFOOGD), Straßenbäume (BAUMKATOGD) – Stadt Wien;
     Hochwasser HQ30/100/300 (LFRZ, Bund). Einmal je Bauplatz geladen und gemerkt. Fehlt eine Quelle → „nicht abrufbar“, nie „nein“. */
  const WFSB = (l, B, m, max) => hol('https://data.wien.gv.at/daten/geo?service=WFS&request=GetFeature&version=1.0.0&typeName=ogdwien:' + l + '&srsName=EPSG:4326&outputFormat=json&maxFeatures=' + (max || 300) + '&bbox='
    + [B[0] - m, B[1] - m * 0.67, B[2] + m, B[3] + m * 0.67].map(v => v.toFixed(6)).join(',') + ',EPSG:4326').then(r => r.ok ? r.json() : Promise.reject(r.status)).then(j => (j.features || []).filter(f => f.geometry && f.properties));
  const fPolys = gm => gm.type === 'Polygon' ? [gm.coordinates] : gm.type === 'MultiPolygon' ? gm.coordinates : [];
  const HQ = ['HQ30', 'HQ100', 'HQ300'], HQL = HQ.map(h => 'Hochwasserueberflutungsflaechen ' + h).join(',');
  const hochwasser = ([lon, lat]) => hol('https://inspire.lfrz.gv.at/000801/ows?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetFeatureInfo&LAYERS=' + encodeURIComponent(HQL) + '&QUERY_LAYERS=' + encodeURIComponent(HQL)
    + '&STYLES=&CRS=CRS:84&BBOX=' + [lon - 0.01, lat - 0.0065, lon + 0.01, lat + 0.0065].join(',') + '&WIDTH=101&HEIGHT=101&I=50&J=50&FEATURE_COUNT=10&INFO_FORMAT=text/plain')   // Dienst zeigt erst ab 1:25.000 → größerer Ausschnitt, Mitte abfragen
    .then(r => r.ok ? r.text() : Promise.reject(r.status)).then(t => HQ.filter(h => t.includes('Hochwasserueberflutungsflaechen ' + h + "'")));
  const proben = g => { const B = bbox(g.polys.flatMap(pg => pg[0])), P = [];                // Punkte innerhalb des Bauplatzes (Mitte zuerst) – für „mehrere Widmungen?“
    for (let a = 0; a < 7; a++) for (let b = 0; b < 7; b++) { const p = [B[0] + (B[2] - B[0]) * (a + 0.5) / 7, B[1] + (B[3] - B[1]) * (b + 0.5) / 7]; if (kInPoly(p, g.polys)) P.push(p); }
    const m = [(B[0] + B[2]) / 2, (B[1] + B[3]) / 2]; P.sort((x, y) => Math.hypot(x[0] - m[0], x[1] - m[1]) - Math.hypot(y[0] - m[0], y[1] - m[1])); return P.length ? P : [m]; };
  const umfC = new Map();
  function umfeld(g) { const key = g.teile.map(t => t.kg + '|' + t.gnr).join(','); if (umfC.has(key)) return umfC.get(key);
    const B = bbox(g.polys.flatMap(pg => pg[0])), P = proben(g), p0 = P[0], drin = (f, p) => kInPoly(p, fPolys(f.geometry));
    const W = q => q.then(v => ({ ok: true, v }), () => ({ ok: false }));
    const pr = Promise.all([W(WFSB('GENFLWIDMUNGOGD', B, 0.0002)), W(WFSB('SCHUTZZONEOGD', B, 0.0001)), W(WFSB('GRPZONENOGD', B, 0.0001)), W(WFSB('BAUSPERRE82OGD', B, 0.0001)), W(WFSB('BAUSPERRE86OGD', B, 0.0001)),
      W(WFSB('GEBAEUDEINFOOGD', B, 0.00005)), W(WFSB('BAUMKATOGD', B, 0.00015, 400)), W(hochwasser(p0))]).then(([wi, sz, gz, b82, b86, geb, baum, hq]) => {
      const u = {};
      if (wi.ok) { const an = p => wi.v.find(f => drin(f, p)); const f0 = an(p0) || wi.v.slice().sort((a, b) => Math.min(...fPolys(a.geometry).map(pg => pg[0].reduce((m, c, i, R) => Math.min(m, kSegAbst(p0, c, R[(i + 1) % R.length])), 1e9)))
          - Math.min(...fPolys(b.geometry).map(pg => pg[0].reduce((m, c, i, R) => Math.min(m, kSegAbst(p0, c, R[(i + 1) % R.length])), 1e9))))[0];
        const alle = [...new Set(P.map(an).filter(Boolean).map(f => f.properties.WIDMUNG))]; u.wid = f0 ? f0.properties : null; u.widAlle = alle; u.widRand = !an(p0); u.widGeo = f0 ? f0.geometry : null; u.widPts = f0 ? P.filter(p => an(p) === f0) : [];
        const Z = new Map(); P.forEach(p => { const f = an(p); if (f) { if (!Z.has(f)) Z.set(f, []); Z.get(f).push(p); } });   // Widmungszonen im Bauplatz (Straßentrakt/Hof)
        u.widZonen = [...Z].map(([f, pts]) => ({ w: f.properties, geo: f.geometry, pts }));
        // Straßenfront (Eduard 18.11., Linzer Straße 22): Kante des Bauplatzes, hinter der 4 m außen keine Widmungszone liegt = Straße. Jede Zone an so einer Kante ist Straßentrakt – auch an der Ecke mit anderer Widmung.
        const kante = [];
        g.polys.forEach(pg => { const R = pg[0], n = R.length, cx = R.reduce((a, c) => a + c[0], 0) / n, cy = R.reduce((a, c) => a + c[1], 0) / n;
          for (let i = 0; i < n; i++) { const a = R[i], b = R[(i + 1) % n], dx = (b[0] - a[0]) * 74000, dy = (b[1] - a[1]) * 111200, L = Math.hypot(dx, dy); if (L < 3) continue;
            let nx = dy / L, ny = -dx / L; const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2; if ((mx - cx) * 74000 * nx + (my - cy) * 111200 * ny < 0) { nx = -nx; ny = -ny; }
            if (wi.v.some(f => drin(f, [mx + nx * 4 / 74000, my + ny * 4 / 111200]))) continue;
            for (let k = 1; k < 10; k += 2) kante.push([a[0] + (b[0] - a[0]) * k / 10 - nx * 1.5 / 74000, a[1] + (b[1] - a[1]) * k / 10 - ny * 1.5 / 111200]); } });
        u.widZonen.forEach(z => { z.front = kante.some(p => drin({ geometry: z.geo }, p)); }); }
      if (sz.ok) { const f = sz.v.find(f => P.some(p => drin(f, p))); u.schutz = f ? f.properties : false; u.schutzGeo = f ? f.geometry : null; }
      if (gz.ok) { const f = gz.v.find(f => f.properties.LAYER === 'DN_L-WZ' && P.some(p => drin(f, p))); u.wohnzone = !!f; u.wzGeo = f ? f.geometry : null; }
      if (b82.ok && b86.ok) { const f = b82.v.concat(b86.v).find(f => P.some(p => drin(f, p))); u.sperre = !!f; u.spGeo = f ? f.geometry : null; }
      if (geb.ok) { const H = geb.v.filter(f => f.geometry.type === 'Point' && kInPoly(f.geometry.coordinates, g.polys));   // Gebäudepunkte der Stadt im Bauplatz
        u.bestand = H.length ? { gesch: Math.max(0, ...H.map(f => +f.properties.GESCH_ANZ || 0)) || null, jahr: (H.find(f => f.properties.BAUJAHR) || {}).properties?.BAUJAHR || null, periode: (H.find(f => f.properties.L_BAUJ) || {}).properties?.L_BAUJ || null } : false; }
      if (baum.ok) { u.baumPts = baum.v.filter(f => { const c = f.geometry.coordinates; return kInPoly(c, g.polys) || g.polys.some(pg => pg[0].some((a, i, R) => kSegAbst(c, a, R[(i + 1) % R.length]) < 8)); }).map(f => f.geometry.coordinates); u.baeume = u.baumPts.length; }
      if (hq.ok) u.hq = hq.v;
      return u; });
    umfC.set(key, pr); pr.catch(() => umfC.delete(key)); return pr; }
  /* ── Planbild-Leser (übernommen aus Rechner v204, Messtest 26.10.2026: Straßenbreite ±0,3 m) ──────────────────────────────────────────
     Liest die rote Planzeichnung (WMTS flwbplmzk/rot, Zoom 19, ~0,2 m je Pixel) entlang von Messlinien senkrecht zur Straßenseite:
     Baulinie = rot durchgehend, Baufluchtlinie = rot strichliert. Ergebnis: Abtretung, Straßenbreite, Vorgarten, Trakttiefe (Straßentrakt). */
  const PLAN_Z = 19, PLAN_K = new Map();
  const planPx = (lon, lat) => { const n = 256 * 2 ** PLAN_Z, r = lat * Math.PI / 180; return [(lon + 180) / 360 * n, (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n]; };
  function planKachel(x, y) { const k = x + '/' + y; if (PLAN_K.has(k)) return PLAN_K.get(k);
    const p = new Promise((ok, no) => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => { try { const c = document.createElement('canvas'); c.width = c.height = 256; const cx = c.getContext('2d', { willReadFrequently: true }); cx.drawImage(im, 0, 0); ok(cx.getImageData(0, 0, 256, 256).data); } catch (e) { no(e); } };
      im.onerror = () => no(new Error('Kachel')); im.src = 'https://maps.wien.gv.at/wmts/flwbplmzk/rot/google3857/' + PLAN_Z + '/' + y + '/' + x + '.jpeg'; });
    PLAN_K.set(k, p); p.catch(() => PLAN_K.delete(k)); return p; }
  const PLAN_D = new Map();   // geladene Kacheldaten (synchron lesbar)
  async function planLaden(bp) { const P = bp.polys.flatMap(pg => pg[0]), B = bbox(P), m = 0.0009, [x0, y0] = planPx(B[0] - m, B[3] + m * 0.67), [x1, y1] = planPx(B[2] + m, B[1] - m * 0.67), L = [];   // Bauplatz ± ~65 m
    for (let tx = Math.floor(x0 / 256); tx <= Math.floor(x1 / 256); tx++) for (let ty = Math.floor(y0 / 256); ty <= Math.floor(y1 / 256); ty++) { const k = tx + '/' + ty; if (!PLAN_D.has(k)) L.push(planKachel(tx, ty).then(d => PLAN_D.set(k, d))); }
    await Promise.all(L); }
  function planRot(lon, lat, eng) { const [px, py] = planPx(lon, lat);
    for (const oy of eng ? [0] : [0, -1, 1]) for (const ox of eng ? [0] : [0, -1, 1]) { const X = Math.floor(px) + ox, Y = Math.floor(py) + oy, tx = Math.floor(X / 256), ty = Math.floor(Y / 256), d = PLAN_D.get(tx + '/' + ty); if (!d) continue;
      const i = ((Y - ty * 256) * 256 + (X - tx * 256)) * 4, r = d[i], g = d[i + 1], b = d[i + 2];
      if (r > 140 && g < 110 && b < 110 && r - g > 50) return true; }   // nur kräftiges Rot (Linien), nicht die rosa Schraffur
    return false; }
  // Straßenseite = äußere Kante des Bauplatzes, die dem Eingang am nächsten liegt; gerade Nachbarkanten werden angehängt
  function frontKante(bp, ref) { const K = (bp.kanten || []).filter(k => !k[2]), mx = 111320 * Math.cos(bp.polys[0][0][0][1] * Math.PI / 180), my = 110574, len = k => Math.hypot((k[1][0] - k[0][0]) * mx, (k[1][1] - k[0][1]) * my);
    if (!K.length || !ref) return null; let best = null, bd = 1e9; K.forEach(k => { if (len(k) < 1.5) return; const d = kSegAbst(ref, k[0], k[1]); if (d < bd) { bd = d; best = k; } }); if (!best) return null;
    const dir = k => { const l = len(k) || 1; return [(k[1][0] - k[0][0]) * mx / l, (k[1][1] - k[0][1]) * my / l]; }, d0 = dir(best), gleich = (p, q) => Math.hypot((p[0] - q[0]) * mx, (p[1] - q[1]) * my) < 0.3;
    let von = best[0], bis = best[1], wachs = true, runden = 0; const genutzt = new Set([best]);
    while (wachs && runden++ < 50) { wachs = false; for (const k of K) { if (genutzt.has(k)) continue; const d = dir(k), par = Math.abs(d[0] * d0[0] + d[1] * d0[1]); if (par < 0.985) continue; const vorher = von + '|' + bis;
      if (gleich(k[1], von) && !gleich(k[0], bis)) { von = k[0]; wachs = true; } else if (gleich(k[0], von) && !gleich(k[1], bis)) { von = k[1]; wachs = true; } else if (gleich(k[0], bis) && !gleich(k[1], von)) { bis = k[1]; wachs = true; } else if (gleich(k[1], bis) && !gleich(k[0], von)) { bis = k[0]; wachs = true; } if (von + '|' + bis !== vorher) genutzt.add(k); } }
    return { von, bis, abstand: bd }; }
  function messRahmen(e, bp) { const pts = bp.polys.flatMap(pg => pg[0]), c = [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length];
    const m = 111320 * Math.cos(e.von[1] * Math.PI / 180), dx = (e.bis[0] - e.von[0]) * m, dy = (e.bis[1] - e.von[1]) * 110574, L0m = Math.hypot(dx, dy) || 1; let nx = -dy / L0m, ny = dx / L0m;
    if (((c[0] - e.von[0]) * m * nx + (c[1] - e.von[1]) * 110574 * ny) < 0) { nx = -nx; ny = -ny; }   // Normale ins Grundstück
    return { L0m, pt: (f, t) => [e.von[0] + f * (e.bis[0] - e.von[0]) + nx * t / m, e.von[1] + f * (e.bis[1] - e.von[1]) + ny * t / 110574] }; }
  async function linienArt(pt, L0m, t) { const st = 0.2 / L0m, luecken = []; let an = 0, ges = 0, lauf = 0;
    for (let f = -0.6; f <= 1.6 + 1e-9; f += st) { let r = false; for (const dt of [-0.3, 0, 0.3]) { const q = pt(f, t + dt); if (planRot(q[0], q[1], true)) { r = true; break; } }
      if (f >= 0.05 && f <= 0.95) { ges++; if (r) an++; } if (r) { if (lauf) luecken.push(lauf * 0.2); lauf = 0; } else lauf++; }
    const strich = luecken.filter(l => l >= 0.5 && l <= 2.2).length, anteil = ges ? an / ges : 0; return { anteil, strich, durch: anteil >= 0.85 && strich <= 1 }; }
  const FS9 = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9], r1 = x => Math.round(x * 10) / 10, r2 = x => Math.round(x * 100) / 100;
  async function baulinieLesen(e, bp) { const { L0m, pt } = messRahmen(e, bp), treffer = [];                      // Abtretung: liegt die Baulinie (rot durchgehend) im Grundstück?
    for (const f of FS9) for (let t = -4; t <= 15; t += 0.1) { const p = pt(f, t); if (!(planRot(p[0], p[1]))) continue; let t2 = t; while (t2 + 0.1 <= t + 1.5) { const q = pt(f, t2 + 0.1); if (!(planRot(q[0], q[1]))) break; t2 += 0.1; } treffer.push({ f, t: (t + t2) / 2 }); t = t2 + 0.1; }
    const gesehen = [];
    for (const h of [...treffer].sort((a, b) => a.t - b.t)) { if (gesehen.some(t => Math.abs(t - h.t) <= 0.6)) continue; const g = treffer.filter(u => Math.abs(u.t - h.t) <= 0.6); if (new Set(g.map(u => u.f)).size < 5) continue;
      const t = g.reduce((a, u) => a + u.t, 0) / g.length; gesehen.push(t); const art = await linienArt(pt, L0m, t); if (!art.durch) continue;
      const tiefe = t > 1.0 ? r1(t) : 0; return { tiefe, laenge: r1(L0m), flaeche: tiefe ? r1(L0m * tiefe) : 0, t, geo: tiefe ? [[pt(0, 0), pt(1, 0), pt(1, t), pt(0, t), pt(0, 0)]] : [], linie: [pt(0, t), pt(1, t)] }; }
    throw new Error(treffer.length ? 'nur strichlierte Linien an der Straßenseite' : 'keine rote Linie an der Straßenseite'); }
  async function strasseLesen(e, bp, tb) { const { L0m, pt } = messRahmen(e, bp), treffer = [];                // Straßenbreite: eigene Baulinie bis zur Fluchtlinie gegenüber (rot durchgehend)
    for (const f of FS9) for (let t = tb - 1.2; t >= tb - 60; t -= 0.1) { const p = pt(f, t); if (!(planRot(p[0], p[1]))) continue; let t2 = t; while (t2 - 0.1 >= t - 1.5) { const q = pt(f, t2 - 0.1); if (!(planRot(q[0], q[1]))) break; t2 -= 0.1; } treffer.push({ f, t: (t + t2) / 2 }); t = t2 - 0.1; }
    const gesehen = [];
    for (const h of [...treffer].sort((a, b) => b.t - a.t)) { if (gesehen.some(t => Math.abs(t - h.t) <= 0.6)) continue; const g = treffer.filter(u => Math.abs(u.t - h.t) <= 0.6); if (new Set(g.map(u => u.f)).size < 5) continue;
      const t = g.reduce((a, u) => a + u.t, 0) / g.length; gesehen.push(t); if (!(await linienArt(pt, L0m, t)).durch) continue; const b = r2(tb - t); if (b < 3) continue;
      return { breite: b, linie: [pt(0.5, tb), pt(0.5, t)] }; }
    throw new Error('keine Fluchtlinie gegenüber'); }
  async function tiefeLesen(e, bp, vg) { const { L0m, pt } = messRahmen(e, bp), drin = p => kInPoly(p, bp.polys), treffer = [];     // Baufluchtlinien hinter der Baulinie: Vorgarten (vorne) und Trakttiefe (hinten)
    for (const f of FS9) { let rot0 = true;
      for (let t = vg + 0.5; t <= vg + 45; t += 0.1) { const p = pt(f, t); if (t > vg + 3 && !drin(p)) break; const r = planRot(p[0], p[1]); if (!r) { rot0 = false; continue; } if (rot0 || t < vg + 2) continue;
        let t2 = t; while (t2 + 0.1 <= t + 1.5) { const q = pt(f, t2 + 0.1); if (!(planRot(q[0], q[1]))) break; t2 += 0.1; } treffer.push({ f, t: (t + t2) / 2 }); t = t2 + 0.1; } }
    const anteil = async (t, a, b) => { let an = 0, ges = 0; for (let f = a; f <= b; f += 0.2 / L0m) { ges++; for (const dt of [-0.3, 0, 0.3]) { const q = pt(f, t + dt); if (planRot(q[0], q[1], true)) { an++; break; } } } return ges ? an / ges : 0; };
    const linien = []; for (const h of [...treffer].sort((a, b) => a.t - b.t)) { const g = treffer.filter(u => Math.abs(u.t - h.t) <= 0.6), n = new Set(g.map(u => u.f)).size; if (n < 5 || linien.some(l => Math.abs(l.t - h.t) <= 0.6)) continue; const t = g.reduce((a, u) => a + u.t, 0) / g.length;
      const innen = await anteil(t, 0.05, 0.95), seite = Math.max(await anteil(t, -0.6, -0.05), await anteil(t, 1.05, 1.6)); if (innen >= 0.5 && (innen >= 0.65 || seite >= 0.65)) linien.push({ t, n }); }
    linien.sort((a, b) => a.t - b.t); if (!linien.length) throw new Error('keine Baufluchtlinie');
    const vorne = linien[0].t - vg <= 8 ? linien[0] : null, hinten = vorne ? linien[1] : linien[0];
    return { vorgarten: vorne ? r1(vorne.t - vg) : null, tiefe: hinten ? r1(hinten.t - vg) : null, linieV: vorne ? [pt(0, vorne.t), pt(1, vorne.t)] : null, linieH: hinten ? [pt(0, hinten.t), pt(1, hinten.t)] : null, n: hinten ? hinten.n : 0 }; }
  // Alle geraden Außenseiten des Bauplatzes (zusammenhängende, gleich gerichtete Außenkanten)
  function seitenListe(bp) { const K = (bp.kanten || []).filter(k => !k[2]), S = [], frei = new Set(K);
    for (const k of K) { if (!frei.has(k)) continue; const mitte = [(k[0][0] + k[1][0]) / 2, (k[0][1] + k[1][1]) / 2], e = frontKante({ ...bp, kanten: [...frei].map(x => [x[0], x[1], false]) }, mitte); if (!e) continue;
      [...frei].forEach(x => { if (kSegAbst([(x[0][0] + x[1][0]) / 2, (x[0][1] + x[1][1]) / 2], e.von, e.bis) < 0.3) frei.delete(x); }); frei.delete(k);
      const mx = 111320 * Math.cos(e.von[1] * Math.PI / 180), L = Math.hypot((e.bis[0] - e.von[0]) * mx, (e.bis[1] - e.von[1]) * 110574); if (L >= 4) S.push({ von: e.von, bis: e.bis, laenge: L }); }
    return S; }
  const leserC = new Map();
  async function leserLauf(bp, ref) { const key = bp.teile.map(t => t.kg + '|' + t.gnr).join(','); if (leserC.has(key)) return leserC.get(key);
    const pr = (async () => { await planLaden(bp);
      // Straßenseite = Seite mit durchgehender Baulinie im Plan (nur zur Straße hin); mehrere → Eckgrundstück, die nächste zum Eingang zuerst
      const S = seitenListe(bp).map(e => { try { return { e, b: null }; } catch (x) { return null; } }).filter(Boolean);
      for (const x of S) { try { x.b = await baulinieLesen(x.e, bp); } catch (_) { x.b = null; } }
      const mitBL = S.filter(x => x.b), dist = x => ref ? kSegAbst(ref, x.e.von, x.e.bis) : 0; mitBL.sort((a, b) => dist(a) - dist(b));
      if (!mitBL.length) return { fehler: 'keine Baulinie an einer Grundstücksseite gefunden', seiten: S.length };
      const e = mitBL[0].e, R = { front: { ...e, abstand: dist(mitBL[0]) }, abtr: mitBL[0].b, ecke: mitBL.slice(1).map(x => ({ front: x.e, abtr: x.b })) };
      const tb = R.abtr ? R.abtr.t : 0;
      try { R.strasse = await strasseLesen(e, bp, tb); } catch (x) { R.strasseFehler = String(x.message || x); }
      try { R.tiefe = await tiefeLesen(e, bp, R.abtr ? R.abtr.tiefe : 0); } catch (x) { R.tiefeFehler = String(x.message || x); }
      for (const x of R.ecke) { try { x.strasse = await strasseLesen(x.front, bp, x.abtr.t); } catch (_) { } }
      return R; })();
    leserC.set(key, pr); pr.catch(() => leserC.delete(key)); return pr; }
  if (/[?&]leser=1/.test(location.search)) window.QE_ZONEN = async () => { if (!M.sel) return { fehler: 'kein Bauplatz' }; const L = await import('./planleser.js?v=3'); return L.zonenLesen(M.sel.polys.map(pg => pg[0]), planKachel, 40); };   // Testmodus Zonen-Leser
  if (/[?&]leser=1/.test(location.search)) window.QE_LESER = () => M.sel ? leserLauf(M.sel, M.pt) : Promise.resolve({ fehler: 'kein Bauplatz' });   // Testmodus (nicht für Kunden)
  const ROEM = ['', 'I', 'II', 'III', 'IV', 'V', 'VI'], BKH = { 1: [9, 3], 2: [12, 4], 3: [16, 5], 4: [21, 7], 5: [26, 8] };   // Wiener Bauordnung § 75: Höchsthöhe je Bauklasse
  const WTXT = { W: 'Wohngebiet – hier darf man Wohnhäuser bauen.', WGV: 'Wohngebiet mit Geschäftsviertel – Wohnhäuser, das Erdgeschoss muss für Geschäfte genutzt werden (Wohnungen erst ab 3,5 m Fußbodenhöhe).',
    GB: 'Gemischtes Baugebiet – Wohnungen und Betriebe sind erlaubt.', GBGV: 'Gemischtes Baugebiet mit Geschäftsviertel – Wohnungen und Geschäfte, das Erdgeschoss muss für Geschäfte genutzt werden (Wohnungen erst ab 3,5 m Fußbodenhöhe).',
    GBBG: 'Betriebsbaugebiet – nur für Betriebe, keine Wohnhäuser (nur Wohnungen für die Betriebsleitung).', GS: 'Gartensiedlungsgebiet – kleine Wohnhäuser mit Garten.', IG: 'Industriegebiet – für Betriebe, keine Wohnungen.', SO: 'Sondergebiet – nur für den im Plan festgelegten Zweck.' };
  const widKl = w => { const k = String(w.WIDMUNGSKLASSE || '').toUpperCase().replace(/[\s-]/g, '').replace(/^WO/, 'W').replace('GF', '');   // Stadt: WO, WOGV, WOGF, GBGFGV … (GF = geförderter Wohnbau)
    return WTXT[k] ? k : /^SO/.test(k) ? 'SO' : null; };
  const widGF = w => /GF/.test(String(w.WIDMUNGSKLASSE || ''));
  /* Ergebnis als Karten in Alltagssprache: links „Was ist das?“, rechts „Was heißt das für dich?“ – Ampel grün/gelb/rot, Fachbegriffe per „Was heißt das?“ */
  const karte = (art, titel, text, mehr, zeig) => { const d = document.createElement('div'); d.className = 'g-card ' + art;
    const h = document.createElement('p'); h.className = 'g-ct'; h.textContent = titel; d.append(h);
    const lang = text && text.length > 70 && !/\bimmer\b/.test(art);   // kompakt (Eduard 18.11.): lange Erklärung erst beim Aufklappen
    if (text && !lang) { const t = document.createElement('p'); t.className = 'g-cx'; t.textContent = text; d.append(t); }
    if (lang || mehr) { const x = document.createElement('details'), sm = document.createElement('summary'); sm.textContent = 'Was heißt das?';
      x.append(sm); [lang ? text : '', mehr || ''].filter(Boolean).forEach(v => { const b = document.createElement('p'); b.textContent = v; x.append(b); }); d.append(x); }
    if (zeig) { d.classList.add('zeigbar'); d.tabIndex = 0; d.setAttribute('role', 'button'); d.setAttribute('aria-label', titel + ' – im Plan zeigen'); const z = () => zeigen(zeig, d);
      d.addEventListener('click', e => { if (!e.target.closest('details')) z(); }); d.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('details')) { e.preventDefault(); z(); } });
      const hz = document.createElement('span'); hz.className = 'g-zg'; hz.textContent = 'Im Plan zeigen'; d.append(hz); }
    return d; };
  const kartenLeeren = () => { $('resFakten').textContent = ''; $('resDeut').textContent = ''; document.querySelectorAll('.g-leg,.g-skiz').forEach(x => x.remove()); M.zon = null; M.zonZiel = null; if (M.hl) { M.hl = null; mapKick(); } };
  /* Einkreisen (Eduard 17.11.): Klick auf eine Karte → Stelle im Plan wird wie mit dem Bleistift eingekreist, leiser Bleistift-Ton. Geometrie aus den geprüften Daten. */
  const hlEl = document.createElementNS(NS, 'svg'); hlEl.setAttribute('class', 'g-hl blau'); hlEl.setAttribute('aria-hidden', 'true'); mapEl.append(hlEl);
  const wackel = (cx, cy, rx, ry, seed) => { let q = seed; const rnd = () => (q = (q * 9301 + 49297) % 233280) / 233280, N = 64, st = -2.2 + rnd() * 0.4, L = [];
    for (let i = 0; i <= N * 1.1; i++) { const a = st + i / N * Math.PI * 2, f = 1 + (rnd() - 0.5) * 0.035 + i / N * 0.06; L.push((cx + Math.cos(a) * rx * f).toFixed(1) + ' ' + (cy + Math.sin(a) * ry * f).toFixed(1)); }
    return 'M' + L.join('L'); };
  function hlUpdate(css) { const s = mapS(); hlEl.setAttribute('viewBox', '0 0 ' + s + ' ' + s); const H = M.hl; if (!H) { hlEl.textContent = ''; return; }
    if (!H.els) { hlEl.textContent = ''; H.els = [];
      if (H.clip) { const df = document.createElementNS(NS, 'defs'), cp = document.createElementNS(NS, 'clipPath'), cpp = document.createElementNS(NS, 'path'); cp.setAttribute('id', 'qeHlClip'); cpp.setAttribute('clip-rule', 'evenodd'); cp.append(cpp); df.append(cp); hlEl.append(df); H.clipEl = cpp; }
      H.grau = H.zonen.length && M.zon ? M.zon.clip : null;   // Fokus (Eduard 18.11.): gemeinte Fläche bleibt in Farbe, restlicher Bauplatz grau – Karte rundherum bleibt normal
      if (H.grau) { const p = document.createElementNS(NS, 'path'); p.setAttribute('class', 'hlg'); p.setAttribute('fill-rule', 'evenodd'); hlEl.append(p); H.els.push(p); }
      H.zonen.forEach(() => { const p = document.createElementNS(NS, 'path'); p.setAttribute('class', H.grau ? 'hlo' : 'hlz'); p.setAttribute('fill-rule', 'evenodd'); if (H.clip) p.setAttribute('clip-path', 'url(#qeHlClip)'); hlEl.append(p); H.els.push(p); });
      H.polys.forEach(() => { const p = document.createElementNS(NS, 'path'); p.setAttribute('class', 'hlf'); p.setAttribute('fill-rule', 'evenodd'); hlEl.append(p); H.els.push(p); });
      H.kreise.forEach((K, j) => { const p = document.createElementNS(NS, 'path'); p.setAttribute('class', 'hlk'); p.setAttribute('pathLength', '1'); p.style.animationDelay = (j * 0.18) + 's'; hlEl.append(p); H.els.push(p); });
      (H.linien || []).forEach(() => { const p = document.createElementNS(NS, 'path'); p.setAttribute('class', 'hlm'); hlEl.append(p); H.els.push(p); const t = document.createElementNS(NS, 'text'); t.setAttribute('class', 'hlmt'); hlEl.append(t); H.els.push(t); }); }
    let i = 0; const S = c => css(...kMerc(c[0], c[1])), D = pg => pg.map(r => 'M' + r.map(c => S(c).map(v => v.toFixed(1)).join(' ')).join('L') + 'Z').join('');
    if (H.clipEl) H.clipEl.setAttribute('d', H.clip.map(D).join(''));
    if (H.grau) H.els[i++].setAttribute('d', H.grau.map(D).join('') + H.zonen.map(D).join(''));
    H.zonen.forEach(pg => { H.els[i++].setAttribute('d', D(pg)); });
    H.polys.forEach(pg => { H.els[i++].setAttribute('d', pg.map(r => 'M' + r.map(c => S(c).map(v => v.toFixed(1)).join(' ')).join('L') + 'Z').join('')); });
    H.kreise.forEach((K, j) => { const P = K.map(S), xs = P.map(p => p[0]), ys = P.map(p => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      H.els[i++].setAttribute('d', wackel((x0 + x1) / 2, (y0 + y1) / 2, Math.max(H.klein || 24, (x1 - x0) * 0.6 + 6), Math.max(H.klein ? H.klein * 0.62 : 15, (y1 - y0) * 0.6 + 6), 11 + j * 17)); });
    (H.linien || []).forEach(L => { const [a, b] = L.p.map(S), dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l * 7, ny = dx / l * 7, f = v => v.toFixed(1);   // Maßband in Gold (Straßenfront)
      H.els[i++].setAttribute('d', 'M' + f(a[0]) + ' ' + f(a[1]) + 'L' + f(b[0]) + ' ' + f(b[1]) + 'M' + f(a[0] - nx) + ' ' + f(a[1] - ny) + 'L' + f(a[0] + nx) + ' ' + f(a[1] + ny) + 'M' + f(b[0] - nx) + ' ' + f(b[1] - ny) + 'L' + f(b[0] + nx) + ' ' + f(b[1] + ny));
      const t = H.els[i++], w = Math.atan2(dy, dx) * 180 / Math.PI, ww = w > 90 || w < -90 ? w + 180 : w; t.setAttribute('transform', 'translate(' + f((a[0] + b[0]) / 2 - nx * 1.6) + ' ' + f((a[1] + b[1]) / 2 - ny * 1.6) + ') rotate(' + ww.toFixed(1) + ')'); t.textContent = L.t || ''; }); }
  let tonCtx = null;
  function bleistift() { try { tonCtx = tonCtx || new (window.AudioContext || window.webkitAudioContext)(); const ac = tonCtx, d = 0.55, n = Math.floor(ac.sampleRate * d), b = ac.createBuffer(1, n, ac.sampleRate), x = b.getChannelData(0);
      for (let k = 0; k < n; k++) { const t = k / ac.sampleRate, hub = 0.5 + 0.5 * Math.abs(Math.sin(t * Math.PI * 2 * 6.5)); x[k] = (Math.random() * 2 - 1) * hub * (Math.random() < 0.06 ? 1.7 : 1); }
      const src = ac.createBufferSource(), hp = ac.createBiquadFilter(), bp = ac.createBiquadFilter(), gn = ac.createGain(), t0 = ac.currentTime; src.buffer = b;
      hp.type = 'highpass'; hp.frequency.value = 1600; bp.type = 'bandpass'; bp.frequency.value = 4300; bp.Q.value = 0.8;
      gn.gain.setValueAtTime(0, t0); gn.gain.linearRampToValueAtTime(0.08, t0 + 0.04); gn.gain.setValueAtTime(0.08, t0 + d - 0.14); gn.gain.linearRampToValueAtTime(0, t0 + d);
      src.connect(hp); hp.connect(bp); bp.connect(gn); gn.connect(ac.destination); src.start(); } catch (e) { /* ohne Ton weiter */ } }
  function vorschau(spec) { if (!spec || (M.hl && !M.hl.vor)) return; M.hl = { polys: spec.polys || [], zonen: spec.zonen || [], clip: spec.clip || null, kreise: (spec.kreise || []).filter(K => K && K.length), klein: spec.klein, linien: spec.linien || [], vor: true }; mapKick(); }
  function vorschauEnde() { if (M.hl && M.hl.vor) { M.hl = null; mapKick(); } }
  function zeigen(spec, el) { document.querySelectorAll('.g-card.an').forEach(c => c.classList.remove('an'));
    if (!spec || (el && M.hl && M.hl.el === el)) { M.hl = null; mapKick(); return; }                 // zweiter Klick auf dieselbe Karte = ausblenden
    el && el.classList.add('an'); M.hl = { polys: spec.polys || [], zonen: spec.zonen || [], clip: spec.clip || null, kreise: (spec.kreise || []).filter(K => K && K.length), klein: spec.klein, linien: spec.linien || [], farbe: spec.farbe, el };
    const pts = M.hl.kreise.flat().concat(M.hl.zonen.flat(2)).concat(M.hl.linien.flatMap(L => L.p)).concat(M.hl.clip ? M.hl.clip.flatMap(pg => pg[0]) : []); if (pts.length) { const B = bbox(pts), [x0, y0] = kMerc(B[0], B[3]), [x1, y1] = kMerc(B[2], B[1]), s = mapS() / 2 - 20;
      if ((x0 - M.cx) * M.k < -s || (x1 - M.cx) * M.k > s || (y0 - M.cy) * M.k < -s || (y1 - M.cy) * M.k > s) { M.cx = (x0 + x1) / 2; M.cy = (y0 + y1) / 2; } }
    mapKick(); if (!matchMedia('(prefers-reduced-motion: reduce)').matches) bleistift(); }
  /* Planleser (Testmodus ?leser=1): vorberechnete Ergebnisse aus dem Planbild – Stadt-Daten + gelesener Plan müssen übereinstimmen. Kunden sehen das noch nicht. */
  const LESER_TEST = true; let PL = null, plG = null;   // live seit 18.11. (Eduard): Planleser-Ergebnisse, Straßenfront-Regel, Farben
  if (LESER_TEST) hol('planleser/ergebnis.json?v=3').then(r => r.json()).then(d => { PL = {}; Object.values(d).forEach(e => e.gnr.split('+').forEach(n => { PL[e.kg + '_' + n] = e; })); if (plG) zeigeInfo(plG, plG.infoO); }).catch(() => {});
  const PL_ROLLE = { strasse: 'Straßentrakt', hof: 'Hof', hof_links: 'Hof links', hof_rechts: 'Hof rechts', abtretung: 'Grundabtretung', vorgarten: 'Vorgarten', frei: 'Hinterer Teil' };
  const PL_W = { W: 'Wohngebiet', WGV: 'Wohngebiet – Geschäftsviertel', GB: 'Gemischtes Baugebiet', GBGV: 'Gemischtes Baugebiet – Geschäftsviertel', G: 'Garten' }, PL_BK = { I: [2.5, 9], II: [2.5, 12], III: [9, 16], IV: [12, 21], V: [16, 26] }, PL_BW = { g: 'geschlossene Bauweise', o: 'offene Bauweise', gk: 'gekuppelte Bauweise' };
  const plLang = p => { const bk = PL_BK[p.bauklasse], h = p.hoehe ? parseFloat(p.hoehe.replace(',', '.')) : null;
    return [PL_W[p.widmung] || p.widmung, p.bauklasse ? 'Bauklasse ' + p.bauklasse + (bk ? ' (normal ' + String(bk[0]).replace('.', ',') + '–' + bk[1] + ' m)' : p.bauklasse === 'VI' ? ' (über 26 m)' : '') : '',
      h ? 'hier begrenzt auf höchstens ' + p.hoehe + (bk && h < bk[1] ? ' statt ' + bk[1] + ' m' : '') : '', PL_BW[p.bauweise] || ''].filter(Boolean).join(' · '); };
  const plText = p => [p.widmung, p.bauklasse, p.hoehe, p.bauweise].filter(Boolean).join(' ') + (p.bb ? ' · ' + p.bb : '') + (p.bebauung ? ' · [' + p.bebauung + ']' : '');
  /* Bauland blau · Garten (G) grün mit Punkten · Grundabtretung rot gestreift · ungeprüft grau (Eduard 18.11.). Gemeinsam für Karte und Skizze. */
  const ZART = t => t.art === 'G' ? 'zg' : t.art === 'vorgarten' ? 'zv' : t.art === 'frei' ? 'zn' : t.art === 'abtretung' ? 'za' : t.art === 'abstand' ? 'zs' : t.stadt_plan_gleich ? 'zb' : 'zx';
  const ZTXT = { zb: 'Bauland', zg: 'Garten (G)', zv: 'Vorgarten', zn: 'Nicht bebaubar', za: 'Grundabtretung', zs: 'Abstand zum Nachbarn', zx: 'Wird noch geprüft' };
  const ZERK = { zb: 'Hier darfst du bauen – innerhalb der Baulinien und Baufluchtlinien.', zg: 'Gärtnerisch auszugestalten: Grünfläche, hier darf kein Gebäude stehen.', zv: 'Streifen zwischen Straße und Baufluchtlinie – bleibt frei (Garten, Zugang, Zufahrt).',
    zn: 'Liegt außerhalb der Baufluchtlinien – hier darf kein Gebäude stehen.', za: 'Liegt vor der Baulinie: Dieser Streifen muss beim Bauen an die Stadt abgetreten werden (für Straße oder Gehsteig).', zs: 'Seitenstreifen innerhalb der Baufluchtlinien – offene Bauweise, hier darf kein Gebäude stehen (BO § 79 Abs. 3).', zx: 'Diesen Teil prüfen wir noch.' };
  const zKurz = t => t.art === 'abstand' ? '' : t.art === 'G' ? 'G' + (t.plan.bb ? ' ' + t.plan.bb : '') : t.art === 'abtretung' ? 'Abtretung' : t.art === 'vorgarten' ? 'Vorgarten' : t.art === 'frei' ? 'nicht bebaubar' : plText(t.plan) || '?';
  // Abstand offene Bauweise, BO § 79 Abs. 3: 6 m; BK I Heranrücken auf halbe Gebäudehöhe, mind. 3 m, Hausseite ≤ 15 m, Überstand ≤ 45 m² je Seite / 90 m² gesamt
  const abstand = (p, tf) => { const gh = p.hoehe ? parseFloat(p.hoehe.replace(',', '.')) : (PL_BK[p.bauklasse] || [0, 0])[1], a = Math.max(3, gh / 2), f = (6 - a) * tf, ok = p.bauklasse === 'I' && gh > 0 && tf <= 15 && f <= 45 && 2 * f <= 90; return { gh, a, f, ok, m: ok ? a : 6 }; };
  const frontLen = e => { const kx = Math.cos(e.front[0][1] * Math.PI / 180) * 111320; return Math.hypot((e.front[1][0] - e.front[0][0]) * kx, (e.front[1][1] - e.front[0][1]) * 110574); };
  // Seitenstreifen im Straßentrakt (Eduard 18.11.): grün statt blau. Annahme: Seitengrenzen annähernd rechtwinklig zur Straße.
  function seitenStreifen(g, e) { const sTr = e.teile.find(t => t.rolle === 'strasse' && t.art === 'bebaubar' && t.tiefe && (t.plan || {}).bauweise === 'o'); if (!sTr || !e.front) return [];
    const A = abstand(sTr.plan, sTr.tiefe.plan), o = e.front[0], kx = Math.cos(o[1] * Math.PI / 180) * 111320, ky = 110574;
    const loc = c => [(c[0] - o[0]) * kx, (c[1] - o[1]) * ky], glo = q => [o[0] + q[0] / kx, o[1] + q[1] / ky], b = loc(e.front[1]), L = Math.hypot(b[0], b[1]), d = [b[0] / L, b[1] / L], u = q => q[0] * d[0] + q[1] * d[1];
    const fl = R => Math.abs(R.reduce((a, q, i) => { const r = R[(i + 1) % R.length]; return a + q[0] * r[1] - r[0] * q[1]; }, 0)) / 2;
    const clip = (R, sg, c) => { const out = []; R.forEach((P, i) => { const Q = R[(i + 1) % R.length], vp = sg * u(P) - c, vq = sg * u(Q) - c; if (vp <= 0) out.push(P); if ((vp < 0 && vq > 0) || (vp > 0 && vq < 0)) { const t = vp / (vp - vq); out.push([P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t]); } }); return out; };
    const R = sTr.poly[0].map(loc), us = R.map(u), lot = (g.teile || [g]).flatMap(t => t.polys).reduce((a, pg) => a + fl(pg[0].map(loc)), 0);
    return [clip(R, 1, Math.min(...us) + A.m), clip(R, -1, -(Math.max(...us) - A.m))].filter(r => r.length > 2 && fl(r) > 0.5)
      .map(r => ({ art: 'abstand', rolle: 'abstand', poly: [r.map(glo)], anteil: fl(r) / lot, m2_plan: fl(r), labels: [], plan: {} })); }
  function zonDefs(svg, pre) { const d = document.createElementNS(NS, 'defs');
    d.innerHTML = '<pattern id="' + pre + 'G" width="7" height="7" patternUnits="userSpaceOnUse"><circle cx="3.5" cy="3.5" r="1.1" fill="#1E6B35"/></pattern>'
      + '<pattern id="' + pre + 'A" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="3" height="7" fill="#C8102E" opacity=".55"/></pattern>'
      + '<pattern id="' + pre + 'V" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><rect width="1.4" height="6" fill="#1E6B35" opacity=".7"/></pattern>';
    svg.append(d); }
  function zonPfade(svg, Z, D, pre) { Z.teile.forEach(t => { const k = ZART(t), d = t.poly.map(D).join('');
      const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); p.setAttribute('class', 'zf ' + k); p.setAttribute('fill-rule', 'evenodd'); if (Z.clipId) p.setAttribute('clip-path', 'url(#' + Z.clipId + ')'); svg.append(p);
      if (k === 'za') { const q = p.cloneNode(); q.setAttribute('class', 'zm'); q.setAttribute('fill', 'url(#' + pre + (k === 'zg' ? 'G' : k === 'zv' || k === 'zs' ? 'V' : 'A') + ')'); svg.append(q); } }); }
  function zonZeichnen(svg, P, css) { const Z = M.zon, D = r => 'M' + r.map(P).join('L') + 'Z';
    zonDefs(svg, 'qeZm'); const cp = document.createElementNS(NS, 'clipPath'); cp.setAttribute('id', 'qeZonClip'); const cpp = document.createElementNS(NS, 'path');
    cpp.setAttribute('d', Z.clip.map(pg => pg.map(D).join('')).join('')); cpp.setAttribute('clip-rule', 'evenodd'); cp.append(cpp); svg.querySelector('defs').append(cp);
    zonPfade(svg, { teile: Z.teile, clipId: 'qeZonClip' }, D, 'qeZm');
    if (false) Z.teile.forEach(t => {   // Kürzel nur in der Skizze – im Plan steht die Schrift schon, sonst Überlappung mit der Grundstücksnummer const r = t.poly[0]; if (!r) return; const c = r.reduce((a, q) => [a[0] + q[0] / r.length, a[1] + q[1] / r.length], [0, 0]), [x, y] = css(...kMerc(c[0], c[1]));
      const tx = document.createElementNS(NS, 'text'); tx.setAttribute('x', x.toFixed(1)); tx.setAttribute('y', (y + 14).toFixed(1)); tx.setAttribute('class', 'zt'); tx.textContent = zKurz(t); svg.append(tx); }); }
  // Skizze: Grundstück so gedreht, als stündest du auf der Straße davor (Straße unten)
  function skizze(g, e) { const box = document.createElement('div'); box.className = 'g-skiz'; if (!e.front) return box;
    const alle = (g.teile || [g]).flatMap(t => t.polys), lat0 = e.front[0][1], kx = Math.cos(lat0 * Math.PI / 180) * 111320, ky = 110574;
    const loc = c => [(c[0] - e.front[0][0]) * kx, (c[1] - e.front[0][1]) * ky], b = loc(e.front[1]), L = Math.hypot(b[0], b[1]), d = [b[0] / L, b[1] / L];
    const pts = alle.flatMap(pg => pg[0]).map(loc), cen = pts.reduce((a, q) => [a[0] + q[0] / pts.length, a[1] + q[1] / pts.length], [0, 0]);
    let n = [-d[1], d[0]]; if (cen[0] * n[0] + cen[1] * n[1] < 0) n = [d[1], -d[0]]; const re = [n[1], -n[0]];
    const T = c => { const q = loc(c); return [q[0] * re[0] + q[1] * re[1], q[0] * n[0] + q[1] * n[1]]; }, U = pts.map(q => [q[0] * re[0] + q[1] * re[1], q[0] * n[0] + q[1] * n[1]]);
    const x0 = Math.min(...U.map(q => q[0])), x1 = Math.max(...U.map(q => q[0])), y1 = Math.max(...U.map(q => q[1])), W = 300, Hs = 300, rand = 34, sk = Math.min((W - 2 * rand) / (x1 - x0), (Hs - 2 * rand - 30) / y1);
    const S = c => { const q = T(c); return [rand + (q[0] - x0) * sk + ((W - 2 * rand) - (x1 - x0) * sk) / 2, Hs - rand - 30 - q[1] * sk]; }, Pp = c => S(c).map(v => v.toFixed(1)).join(' '), D = r => 'M' + r.map(Pp).join('L') + 'Z';
    const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 ' + W + ' ' + Hs); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'Skizze des Grundstücks, Straße unten');
    zonDefs(svg, 'qeZs'); const cp = document.createElementNS(NS, 'clipPath'); cp.setAttribute('id', 'qeSkClip'); const cpp = document.createElementNS(NS, 'path'); cpp.setAttribute('d', alle.map(pg => pg.map(D).join('')).join('')); cp.append(cpp); svg.querySelector('defs').append(cp);
    const yF = Hs - rand - 30, st = document.createElementNS(NS, 'rect'); st.setAttribute('x', 0); st.setAttribute('y', yF + 2); st.setAttribute('width', W); st.setAttribute('height', 26); st.setAttribute('class', 'sks'); svg.append(st);
    const stt = document.createElementNS(NS, 'text'); stt.setAttribute('x', W / 2); stt.setAttribute('y', yF + 19); stt.setAttribute('class', 'skst'); stt.textContent = 'STRASSE'; svg.append(stt);
    zonPfade(svg, { teile: e.teile, clipId: 'qeSkClip' }, D, 'qeZs');
    const um = document.createElementNS(NS, 'path'); um.setAttribute('d', alle.map(pg => pg.map(D).join('')).join('')); um.setAttribute('class', 'sku'); svg.append(um);
    e.teile.forEach(t => { const r = t.poly[0]; if (!r) return; const P2 = r.map(S), c = P2.reduce((a, q) => [a[0] + q[0] / P2.length, a[1] + q[1] / P2.length], [0, 0]);
      const tx = document.createElementNS(NS, 'text'); tx.setAttribute('x', c[0].toFixed(1)); tx.setAttribute('y', (c[1] + 4).toFixed(1)); tx.setAttribute('class', 'skt'); tx.textContent = zKurz(t); svg.append(tx); });
    const mass = (xa, ya, xb, yb, txt, sen) => { const l = document.createElementNS(NS, 'path'); l.setAttribute('d', 'M' + xa.toFixed(1) + ' ' + ya.toFixed(1) + 'L' + xb.toFixed(1) + ' ' + yb.toFixed(1)); l.setAttribute('class', 'skm'); svg.append(l);
      const t = document.createElementNS(NS, 'text'); t.setAttribute('class', 'skmt'); if (sen) t.setAttribute('transform', 'translate(' + (xa - 5).toFixed(1) + ' ' + ((ya + yb) / 2).toFixed(1) + ') rotate(-90)'); else { t.setAttribute('x', ((xa + xb) / 2).toFixed(1)); t.setAttribute('y', (ya + 12).toFixed(1)); } t.textContent = txt; svg.append(t); };
    const f0 = S(e.front[0]), f1 = S(e.front[1]); mass(Math.min(f0[0], f1[0]), yF + 31, Math.max(f0[0], f1[0]), yF + 31, 'Front ca. ' + L.toFixed(1).replace('.', ',') + ' m');
    const sTr = e.teile.find(t => t.rolle === 'strasse' && t.tiefe); if (sTr) { const tief = sTr.tiefe ? sTr.tiefe.plan : Math.max(...sTr.poly.flat().map(c => T(c)[1])), xl = Math.min(...alle.flatMap(pg => pg[0]).map(c => S(c)[0])) - 9;   // Planzahl geht vor – Messung nur zur Kontrolle
      mass(xl, yF, xl, yF - tief * sk, sTr.tiefe ? 'Trakttiefe ' + tief.toFixed(2).replace('.', ',') + ' m' : 'Trakttiefe: Planzahl fehlt', true); }
    box.append(svg); const k = document.createElement('p'); k.className = 'g-skk'; k.textContent = 'So stehst du vor deinem Grundstück. Maße ca., aus dem Plan gemessen.'; box.append(k); return box; }
  function legende(g, e) { const box = document.createElement('div'); box.className = 'g-leg'; const fl = t => g.fl ? Math.round(t.anteil * g.fl) : Math.round(t.m2_plan), sum = {};
    e.teile.forEach(t => { const k = ZART(t); sum[k] = (sum[k] || 0) + fl(t); }); if (sum.zs && sum.zb) sum.zb -= sum.zs;
    const nb = ['zg', 'zv', 'zn', 'zs'].filter(k => sum[k]), NBN = { zg: 'Garten (G)', zv: 'Vorgarten', zn: 'hinterer Teil', zs: 'Abstand zum Nachbarn' };   // Plan nur blau/grün (Eduard 18.11.) – das Warum steht im Steckbrief
    const zl = (k, txt, erk) => { const z = document.createElement('div'); z.className = 'lz'; z.innerHTML = '<i class="sw ' + k + '"></i>'; const s_ = document.createElement('span'), b_ = document.createElement('b'); b_.textContent = txt; s_.append(b_, document.createTextNode(' – ' + erk)); z.append(s_); box.append(z); };
    if (sum.zb) zl('zb', 'Hier darfst du bauen · ca. ' + sum.zb + ' m²', 'innerhalb der Baufluchtlinien' + (sum.zs ? ', ohne Abstand zum Nachbarn' : '') + '.');
    if (nb.length) zl('zg', 'Hier darfst du nicht bauen · ca. ' + nb.reduce((a, k) => a + sum[k], 0) + ' m²', nb.map(k => NBN[k]).join(', ') + '. Details: Zeile im Steckbrief antippen.');
    if (sum.za) zl('za', 'Grundabtretung · ca. ' + sum.za + ' m²', ZERK.za);
    if (sum.zx) zl('zx', ZTXT.zx + ' · ca. ' + sum.zx + ' m²', ZERK.zx);
    return box; }
  function planAnzeige(g, e) { document.querySelectorAll('.g-leg,.g-skiz').forEach(x => x.remove()); M.zon = null;
    if (e) { const sts = seitenStreifen(g, e), ex = Object.assign({}, e, { teile: e.teile.map(t => sts.length && t.rolle === 'strasse' && t.art === 'bebaubar' ? Object.assign({}, t, { poly: t.poly.concat(sts.flatMap(x => x.poly)) }) : t).concat(sts) }); M.zon = { teile: ex.teile, clip: (g.teile || [g]).flatMap(t => t.polys) }; const w = $('resHint'); w.before(legende(g, ex)); $('resDeut').append(skizze(g, ex)); }
    mapKick(); }
  function planKarten(g, L) { if (!PL) return; const e = (g.teile || [g]).map(t => PL[t.kg + '_' + t.gnr]).find(Boolean); planAnzeige(g, e); if (!e) return;
    L.append(karte('meta', 'Aus dem Plan gelesen', 'Tippe auf eine Zeile – die Stelle wird im Plan eingekreist.', 'Jeder Wert ist im Flächenwidmungsplan nachgelesen und mit den Daten der Stadt Wien abgeglichen (Stand ' + e.stand.split('-').reverse().join('.') + ').'));
    const BW = { g: 'geschlossene Bauweise', o: 'offene Bauweise', gk: 'gekuppelte Bauweise' }, BWX = { g: 'Haus an Haus gebaut, ohne Abstand zu den Nachbarn.', o: 'Freistehend, mit Abstand zu den Nachbarn.', gk: 'Zwei Häuser stehen zusammen an der gemeinsamen Grenze.' };
    const st = document.createElement('div'); st.className = 'g-steck'; L.append(st);
    const zeile = (kz, titel, erkl, zeig, eigen) => { const b = document.createElement('button'); b._zeig = zeig; b.type = 'button'; b.className = 'g-zl'; b.setAttribute('aria-expanded', 'false');
      b.innerHTML = '<span class="kz"></span><span class="tt"></span><span class="pf" aria-hidden="true">›</span><span class="ex"></span>';
      b.querySelector('.kz').textContent = kz; b.querySelector('.tt').textContent = titel; b.querySelector('.ex').textContent = erkl;
      if (matchMedia('(hover:hover)').matches) { b.addEventListener('mouseenter', () => vorschau(zeig)); b.addEventListener('mouseleave', vorschauEnde); }   // am Computer: Fläche schon beim Drüberfahren zeigen
      if (!eigen) b.addEventListener('click', () => { const auf = b.getAttribute('aria-expanded') !== 'true'; st.querySelectorAll('.g-zl[aria-expanded="true"]').forEach(x => x.setAttribute('aria-expanded', 'false')); b.setAttribute('aria-expanded', auf ? 'true' : 'false');
        if (M.hl && M.hl.vor) M.hl = null; const kp = !auf && b.closest('.g-sec.auf') && b.closest('.g-sec.auf').querySelector('.kopf');   // zweiter Klick schließt – zurück auf die Fläche des Abschnitts
        if (kp && kp !== b) { kp.setAttribute('aria-expanded', 'true'); M.hl = null; zeigen(kp._zeig, kp); } else zeigen(auf ? zeig : null, auf ? b : null); if (auf && matchMedia('(max-width:1099px)').matches) { const m = $('resMap'), r = m.getBoundingClientRect(); if (r.bottom < 60 || r.top > innerHeight - 80) m.scrollIntoView({ behavior: 'smooth', block: 'center' }); } });
      return b; };
    const kopfKlick = (sec, b) => { const auf = !sec.classList.contains('auf'); st.querySelectorAll('.g-sec.auf').forEach(x => x.classList.remove('auf')); st.querySelectorAll('.g-zl[aria-expanded="true"]').forEach(x => x.setAttribute('aria-expanded', 'false'));
      sec.classList.toggle('auf', auf); b.setAttribute('aria-expanded', auf ? 'true' : 'false'); M.hl = null; zeigen(auf && b._zeig && (b._zeig.zonen || []).length ? b._zeig : null, auf ? b : null); };   // Klick öffnet, zweiter Klick schließt
    M.zonZiel = [];
    const RANG = { strasse: 0, vorgarten: 1, hof: 2, hof_links: 2, hof_rechts: 3, frei: 4, abtretung: 5 };
    [...e.teile].sort((a, b) => (RANG[a.rolle] ?? 4) - (RANG[b.rolle] ?? 4)).forEach(t => { const fl = g.fl ? Math.round(t.anteil * g.fl) : Math.round(t.m2_plan), p = t.plan || {}, zone = (sx => sx.length ? [t.poly.concat(sx.flatMap(x => x.poly))] : t.poly.map(r => [r]))(t.rolle === 'strasse' && t.art === 'bebaubar' ? seitenStreifen(g, e) : []);   // blauer Stein ohne die grünen Seitenstreifen
      const zb_ = bbox(t.poly.flat()), mx = 30 / (111320 * Math.cos(zb_[1] * Math.PI / 180)), my = 30 / 110574, nah = B => B && B.every(c => c[0] > zb_[0] - mx && c[0] < zb_[2] + mx && c[1] > zb_[1] - my && c[1] < zb_[3] + my);   // nur Planzeichen in der Nähe einkreisen (G BB kann 100 m weiter stehen)
      const boxen = a => t.labels.flatMap(l => a === '*' ? [l.box] : l.teile && l.teile[a] ? [l.teile[a]] : []).filter(nah), fb = { zb: 'b', za: 'r', zx: 'n' }[ZART(t)] || 'g', mit = (a, x) => { const k = boxen(a).concat(x || []); return { zonen: zone, kreise: k.length ? k : boxen('*'), klein: 6, farbe: fb }; };
      const k = ZART(t), sec = document.createElement('div'); sec.className = 'g-sec ' + k; st.append(sec);
      const kopf = (PL_ROLLE[t.rolle] || t.rolle) + ' · ' + (t.art === 'bebaubar' ? (plText(p) || ZTXT[k]).replace(' · ', ' ') : t.art === 'G' ? 'G' + (p.bb ? ' ' + p.bb : '') : t.art === 'vorgarten' ? 'nicht bebaubar' : ZTXT[k]) + ' · ' + fl + ' m²';   // ganze Widmung in der Kopfzeile wie in den Rechenbeispielen (z. B. „Straßentrakt · W I 6,5 m o BB1“)
      const kb = zeile('', kopf, ZERK[k], { zonen: zone, kreise: boxen('*'), klein: 7, farbe: fb }, true); kb.classList.add('kopf'); sec.append(kb);
      kb.addEventListener('click', () => kopfKlick(sec, kb)); M.zonZiel.push({ poly: t.poly, sec, kopf: kb, el: kb });   // zugeklappt: nur die Kopfzeile, Klick zeigt die Einzelteile
      if (t.art === 'G') { sec.append(zeile('G', 'gärtnerisch auszugestalten', 'Garten oder Grünfläche – hier darf kein Gebäude stehen.', mit('*'))); if (p.bb) sec.append(zeile(p.bb, 'Besondere Bestimmung' + (p.bb_text ? '' : ' (Hof)'), p.bb_text ? p.bb_text + ' (Plandokument ' + e.plandokument.nr + ')' : 'Eigene Zusatzregel für diese Fläche – der genaue Text steht im Plandokument.', mit('*'))); return; }
      if (t.art === 'vorgarten') { const v = (e.teile.find(x => x.vorgarten) || {}).vorgarten; sec.append(zeile(v && v.plan ? v.plan.toFixed(2).replace('.', ',') : 'Vg', 'Vorgarten', 'Streifen zwischen Straße und Baufluchtlinie. Hier darf nicht gebaut werden – Garten, Zugang, Zufahrt.', mit('*'))); return; }
      if (t.art !== 'bebaubar') return;
      if (p.widmung) sec.append(zeile(p.widmung, PL_W[p.widmung] || 'Widmung', 'Die Widmung sagt, was hier gebaut werden darf. ' + ({ W: 'W = Wohngebiet: Wohnhäuser.', GB: 'GB = Gemischtes Baugebiet: Wohnungen und Betriebe.', WGV: 'WGV = Wohngebiet Geschäftsviertel: Erdgeschoss für Geschäfte, Wohnungen erst ab 3,5 m.', GBGV: 'GBGV = Gemischtes Baugebiet Geschäftsviertel: Erdgeschoss für Geschäfte.' }[p.widmung] || ''), mit('widmung')));
      if (p.bauklasse) { const bk = PL_BK[p.bauklasse]; sec.append(zeile(p.bauklasse, 'Bauklasse ' + p.bauklasse + (bk ? ' · ' + String(bk[0]).replace('.', ',') + '–' + bk[1] + ' m' : ''), 'Die Bauklasse (römische Zahl) legt die Gebäudehöhe fest' + (bk ? ': hier ' + String(bk[0]).replace('.', ',') + ' bis ' + bk[1] + ' m.' : '.'), mit('bauklasse'))); }
      if (p.hoehe) { const bk = PL_BK[p.bauklasse], h = parseFloat(p.hoehe.replace(',', '.')); sec.append(zeile(p.hoehe.replace(' ', ''), 'Höhe begrenzt', 'Die Meterzahl im Plan geht vor: höchstens ' + p.hoehe + (bk && h < bk[1] ? ' statt der ' + bk[1] + ' m der Bauklasse.' : '.'), mit('hoehe'))); }
      if (p.bauweise) sec.append(zeile(p.bauweise, BW[p.bauweise] || 'Bauweise', 'Bauweise ' + p.bauweise + ': ' + (BWX[p.bauweise] || ''), mit('bauweise')));
      if (p.bb) sec.append(zeile(p.bb, 'Besondere Bestimmung', p.bb_text ? p.bb_text + ' (Plandokument ' + e.plandokument.nr + ')' : 'Zusätzliche Regel für diese Fläche – der genaue Text steht im Plandokument.', mit('bb')));
      if (t.tiefe) sec.append(zeile(t.tiefe.plan.toFixed(2).replace('.', ','), t.tiefe.art === 'baufenster' ? 'Bebaubare Tiefe' : 'Trakttiefe', t.tiefe.art === 'baufenster' ? 'Tiefe der bebaubaren Fläche zwischen den Baufluchtlinien – die Zahl mit den zwei Pfeilen im Plan (steht hier beim Nachbarn derselben Häuserzeile).' : 'So tief darf von der Straße aus gebaut werden – die Zahl mit den zwei Pfeilen im Plan.', mit('-', t.tiefe.box ? [t.tiefe.box] : [])));
      if (p.bauweise === 'o' && t.tiefe && t.rolle === 'strasse') { const tf = t.tiefe.plan, z = v => v.toFixed(2).replace('.', ','), A = abstand(p, tf), sts = seitenStreifen(g, e);
        sec.append(zeile(z(A.m).replace(',00', '') + ' m', 'Abstand zum Nachbarn', 'Offene Bauweise: grundsätzlich 6 m zur seitlichen Grundstücksgrenze, auf eigenem Grund. In Bauklasse I darf man nach BO § 79 Abs. 3 bis auf die halbe Gebäudehöhe heranrücken (mindestens 3 m), wenn die Hausseite höchstens 15 m lang ist und der Teil über der 6-m-Linie je Seite höchstens 45 m², zusammen höchstens 90 m² hat. ' + (A.ok ? 'Geprüft: Gebäudehöhe ' + z(A.gh) + ' m ÷ 2 = ' + z(A.a) + ' m; Überstand ' + z(6 - A.a) + ' m × ' + z(tf) + ' m Tiefe = ' + z(A.f) + ' m² je Seite, zusammen ' + z(2 * A.f) + ' m² – passt.' : 'Hier nicht erfüllt, daher 6 m.') + ' Im Plan grün.', { zonen: sts.flatMap(x => x.poly.map(r => [r])), kreise: [], farbe: 'g' })); sts.forEach(x => M.zonZiel.unshift({ poly: x.poly, sec, kopf: sec.querySelector('.kopf'), el: sec.lastChild }));
        if (e.front) { const Lf = frontLen(e), br = Math.round((Lf - 2 * A.m) * 100) / 100, net = br * tf, gfl = g.fl || 0, w = { W: 1, GB: 1 }[p.widmung], dr = w && gfl ? Math.min(gfl / 3, { I: 350, II: 700 }[p.bauklasse] || Infinity) : null, bbm = (p.bb_text || '').match(/höchstens (\d+) m² bebaut/), bm = bbm ? +bbm[1] : null;
          const kand = [[net, 'Hausbreite ' + z(br) + ' m (Front ' + z(Lf) + ' m − 2 × ' + z(A.m) + ' m Abstand) × Tiefe ' + z(tf) + ' m = ' + Math.floor(net) + ' m²']].concat(dr ? [[dr, 'Drittel-Regel (BO § 76 Abs. 10): ' + gfl + ' m² ÷ 3 = ' + Math.floor(dr) + ' m²']] : [], bm ? [[bm, p.bb + ': ' + bm + ' m²']] : []), min = Math.min(...kand.map(k => k[0]));
          if (br > 0) sec.append(zeile(Math.floor(min) + ' m²', 'Bebaubar höchstens', 'Es gilt der kleinste Wert: ' + kand.map(k => k[1]).join(' · ') + '. Annahme: Grundstück annähernd rechteckig.' + (min < net - 0.5 ? ' Die blaue Fläche ist größer – wo du innerhalb davon baust, entscheidest du.' : ''), { zonen: zone, kreise: [], farbe: 'b' }));
            g.bebaubar = { m2: Math.floor(min), text: 'Kleinster Wert aus: ' + kand.map(k => k[1]).join(' · ') + '. Annahme: Grundstück annähernd rechteckig.', zeig: { zonen: [t.poly.concat(sts.flatMap(x => x.poly))], kreise: [], farbe: 'b' } }; }
      }
      if (t.rolle === 'strasse' && e.front) { const kx = Math.cos(e.front[0][1] * Math.PI / 180) * 111320, Lf = Math.hypot((e.front[1][0] - e.front[0][0]) * kx, (e.front[1][1] - e.front[0][1]) * 110574); sec.append(zeile(Lf.toFixed(1).replace('.', ','), 'Straßenfront', 'Länge der Grundstücksgrenze an der Straße (aus dem Kataster) – im Plan als goldenes Maßband.', { zonen: [], kreise: [], linien: [{ p: e.front, t: Lf.toFixed(1).replace('.', ',') + ' m' }] })); }
      (t.strassenmasse || []).forEach(sm => sec.append(zeile(sm.v.toFixed(2).replace('.', ','), 'Breite Baulinie–Baulinie', 'Abstand von Baulinie zu Baulinie quer über die Straße, so im Plan eingetragen (Zahl mit Pfeilen) – gilt an der Stelle der Pfeile.', mit('-', [sm.box]))));
      if (t.strassenbreite && t.strassenbreite.plan) { const b = t.strassenbreite; sec.append(zeile(b.plan.toFixed(2).replace('.', ','), 'Straßenbreite', 'Zahl mit Pfeilen im Plan, am Grundstück nachgemessen (' + b.gemessen.toFixed(2).replace('.', ',') + ' m). Breitere Straße = oft mehr Höhe möglich.', mit('-', b.box ? [b.box] : []))); }
    });
    if (e.plandokument && e.plandokument.allgemein) { const sec = document.createElement('div'); sec.className = 'g-sec zx'; st.append(sec);
      sec.append(zeile('', 'Allgemeine Regeln im Plangebiet (keine BB) · Plandokument ' + e.plandokument.nr, 'Textliche Bestimmungen für alle Grundstücke im Plangebiet, ohne eigenes Planzeichen. Regeln, die hier nichts ändern, sind ausgeblendet. Beschluss ' + e.plandokument.beschluss + '.', { zonen: [], kreise: [] })); sec.lastChild.classList.add('kopf');
      { const kb = sec.lastChild; kb.addEventListener('click', e => { e.stopImmediatePropagation(); kopfKlick(sec, kb); }, true); }
      const tMax = Math.max(0, ...e.teile.filter(t => t.tiefe).map(t => t.tiefe.plan));
      e.plandokument.allgemein.filter(a => !(/^Trakttiefe höchstens/.test(a[1]) && tMax && parseFloat(a[0].replace(',', '.')) >= tMax)).forEach(a => sec.append(zeile(a[0], a[1], a[2], { zonen: [], kreise: [] }))); } }
  const zeigeInfo = (g, o = {}) => { const K = (M.kg || {})[g.kg] || g.kg, n = g.teile ? g.teile.length : 1, L = $('resFakten'), D = $('resDeut'), u = g.umf; g.infoO = o; kartenLeeren(); $('resInfo').textContent = '';
    const gelb = [], rot = [];
    const zG = { zonen: (g.teile || [g]).flatMap(t => t.polys), kreise: (g.teile || [g]).map(t => [proben({ polys: t.polys })[0]]) }, alleP = (g.teile || [g]).flatMap(t => t.polys.flatMap(pg => pg[0]));
    const ca = g.amtl === false ? 'ca. ' : '', flQ = g.amtl === false ? ' Fläche aus den Grenzen errechnet – amtlicher Wert gerade nicht abrufbar.' : ' Fläche laut Grundbuch.';
    L.append(n > 1 ? karte('immer', 'Bauplatz ' + ca + flText(g) + ' m²', 'Grundstücke ' + g.teile.map(t => t.gnr + ' (' + (t.amtl ? '' : 'ca. ') + flText(t) + ' m²)').join(' + '), 'Besteht aus ' + n + ' Grundstücken, die im Grundbuch zusammen geführt werden.' + flQ + ' Ein Bauplatz ist die Fläche, auf der gebaut werden darf. Grundstücke mit derselben Grundbuch-Einlage (EZ) werden gemeinsam geführt und zählen zusammen. Flächen aus dem amtlichen Grundstücksverzeichnis des BEV.', zG)
      : karte('', 'Grundstück ' + g.gnr + ' · ' + ca + flText(g) + ' m²', 'Ein einzelnes Grundstück.' + flQ, 'Grundstücksnummer und Fläche stammen aus dem amtlichen Grundstücksverzeichnis des Bundesamts für Eich- und Vermessungswesen (BEV) – dieselbe Fläche wie im Grundbuch.', zG));
    $('resDeut').append(karte('meta kat', 'KG ' + K + (g.ez ? ' · EZ ' + g.ez : ''), '', 'KG = Katastralgemeinde, der Vermessungsbezirk. EZ = Einlagezahl, die Nummer im Grundbuch.'));   // Kataster rechts (Eduard 18.11.)
    if (!u) L.append(karte('bald', 'Widmung, Schutz und Hochwasser werden geladen …', ''));
    else {
      if (u.wid === undefined) L.append(karte('meta', 'Widmung gerade nicht abrufbar', 'Bitte im Plan ablesen (rote Schrift) oder später nochmal versuchen.'));
      else if (!u.wid) { L.append(karte('meta', 'Keine Widmung gefunden', 'Wahrscheinlich Straße oder Verkehrsfläche – bitte im Plan prüfen.')); gelb.push('Keine Widmung gefunden – bitte im Plan prüfen.'); }
      else {
        // Mehrere Widmungen: Zone, die der Adresse (Eingang) am nächsten liegt = Straßentrakt, die übrigen = Hof (Stadt-Daten, Theresiengasse 47)
        let Z = (u.widZonen && u.widZonen.length ? u.widZonen : [{ w: u.wid, geo: u.widGeo, pts: u.widPts }]).filter(z => z.pts.length >= 2 || (u.widZonen || []).length === 1);
        if (!Z.length) Z = [{ w: u.wid, geo: u.widGeo, pts: u.widPts }];
        const ref = M.pt, dmin = z => ref ? Math.min(...z.pts.map(p => Math.hypot((p[0] - ref[0]) * 74000, (p[1] - ref[1]) * 111200))) : 0;
        if (Z.length > 1) Z.sort((a, b) => LESER_TEST ? (!!b.front - !!a.front) || dmin(a) - dmin(b) : dmin(a) - dmin(b));
        const nFront = LESER_TEST ? Z.filter(z => z.front).length : 0;
        const plE = PL && (g.teile || [g]).map(t => PL[t.kg + '_' + t.gnr]).find(Boolean);   // Planleser vorhanden → Widmung steht im Steckbrief, nicht doppelt
        if (!plE) Z.forEach((z, zi) => { const w = z.w, kl = widKl(w), bk = +(String(w.WIDMUNG || '').match(/(\d)\s*$/) || [])[1] || 0, h = BKH[bk];
          const nH = Z.length - nFront, hi = zi - nFront;
          const vor = Z.length < 2 ? '' : !LESER_TEST ? (zi === 0 ? 'Straßentrakt: ' : Z.length === 2 ? 'Hof: ' : Z.length === 3 ? (zi === 1 ? 'Hof vorne: ' : 'Hof hinten: ') : 'Hof ' + zi + ': ')
            : z.front ? (zi === 0 ? 'Straßentrakt: ' : 'Straßentrakt Ecke: ') : nFront === 0 && zi === 0 ? 'Straßentrakt: ' : nH === 1 ? 'Hof: ' : nH === 2 ? (hi === 0 ? 'Hof vorne: ' : 'Hof hinten: ') : 'Hof ' + (hi + 1) + ': ';
          const bkT = bk === 6 ? 'Bauklasse VI: über 26 m hoch.' : h ? 'Bauklasse ' + ROEM[bk] + ': höchstens ' + h[0] + ' m hoch (ca. ' + h[1] + ' Geschosse) – im Detailplan kann eine niedrigere Grenze stehen.' : '';
          const gross1 = t => t.charAt(0).toUpperCase() + t.slice(1), zz = { zonen: z.geo ? fPolys(z.geo) : [], clip: g.polys };
          if (!kl) { L.append(karte('rot', vor + (w.WIDMUNG_TXT || w.WIDMUNGSKLASSE_TXT || 'Kein Bauland'), 'Kein Bauland – hier darf grundsätzlich nicht gebaut werden.', 'Grünland, Parks, Wald, Verkehrsflächen und ähnliche Widmungen sind kein Bauland. Bauen ist dort nur in Ausnahmen erlaubt.', zz)); if (zi === 0) rot.push('Laut Flächenwidmung kein Bauland.'); }
          else L.append(karte('', vor + WTXT[kl].split(' – ')[0], gross1(WTXT[kl].split(' – ')[1]) + (bkT ? ' ' + bkT : '') + (widGF(w) ? ' Rund zwei Drittel der neuen Wohnungen müssen geförderter Wohnbau sein.' : ''), 'Amtlich: „' + (w.WIDMUNG_TXT || w.WIDMUNG) + '“. Die Bauklasse legt die Höhe fest (Wiener Bauordnung § 75). Im Detailplan kann zusätzlich eine eigene Höchstgrenze stehen, z. B. „14m“ – die gilt dann. Das lesen wir im nächsten Schritt aus.', zz));
          if (kl && !h && bk !== 6) gelb.push('Bauklasse nicht ablesbar – bitte im Plan prüfen.'); });
        if (Z.length === 1 && u.widRand) gelb.push('Widmung am Rand des Grundstücks abgelesen – bitte im Plan prüfen.'); }
      if (LESER_TEST) { plG = g; planKarten(g, L); }
      const sch = [];
      if (u.schutz) { sch.push('Schutzzone' + (u.schutz.SLANG ? ' „' + u.schutz.SLANG + '“' : '')); gelb.push('Schutzzone: Abbruch und Umbau der Fassade brauchen eine Bewilligung, Neues muss ins Stadtbild passen.'); }
      if (u.wohnzone) sch.push('Wohnzone');
      if (u.sperre) { sch.push('Bausperre'); gelb.push('Bausperre: Der Plan wird gerade überarbeitet – Bauen ist nur eingeschränkt möglich.'); }
      const unbek = [u.schutz === undefined && 'Schutzzone', u.wohnzone === undefined && 'Wohnzone', u.sperre === undefined && 'Bausperre'].filter(Boolean);
      L.append(sch.length ? karte('gelb-k', sch.join(' · '), u.schutz ? 'Das Stadtbild ist hier geschützt.' : u.wohnzone ? 'Hier müssen vorwiegend Wohnungen entstehen.' : 'Der Plan wird überarbeitet.', 'Schutzzone: Gebäude prägen das Stadtbild, Abbruch braucht eine Bewilligung. Wohnzone: Büros und Geschäfte sind nur eingeschränkt erlaubt. Bausperre: Bis der neue Plan gilt, wird nur eingeschränkt bewilligt.', { zonen: [u.schutzGeo, u.wzGeo, u.spGeo].filter(Boolean).flatMap(fPolys), clip: g.polys })
        : karte('gruen-k', 'Keine Schutzzone, Wohnzone oder Bausperre', unbek.length ? unbek.join(', ') + ' gerade nicht abrufbar.' : ''));
      if (u.hq === undefined) L.append(karte('meta', 'Hochwasser gerade nicht abrufbar', ''));
      else if (u.hq.length) { const t = u.hq[0]; L.append(karte(t === 'HQ300' ? 'meta' : 'gelb-k', 'Hochwassergebiet ' + t, t === 'HQ30' ? 'Statistisch alle 30 Jahre überflutet.' : t === 'HQ100' ? 'Statistisch alle 100 Jahre überflutet.' : 'Nur bei sehr seltenem Hochwasser (alle 300 Jahre) betroffen.', 'Daten: Hochwasser-Überflutungsflächen des Bundes (LFRZ), Genauigkeit ca. 15 m. Im 30-jährlichen Gebiet braucht ein Neubau zusätzlich eine wasserrechtliche Bewilligung.'));
        if (t !== 'HQ300') gelb.push('Hochwassergebiet ' + t + (t === 'HQ30' ? ': zusätzliche wasserrechtliche Bewilligung nötig.' : '.')); }
      else L.append(karte('gruen-k', 'Kein Hochwassergebiet', 'Auch nicht bei sehr seltenem Hochwasser (300 Jahre). Starkregen ist hier nicht erfasst.'));
      if (u.baeume === undefined) L.append(karte('meta', 'Bäume gerade nicht abrufbar', ''));
      else L.append(karte(u.baeume ? '' : 'meta', u.baeume ? u.baeume + (u.baeume === 1 ? ' städtischer Baum' : ' städtische Bäume') + ' direkt am Grundstück' : 'Keine städtischen Bäume direkt am Grundstück',
        u.baeume ? 'Bei Zufahrt oder Baustelle müssen sie geschützt werden.' : '', 'Erfasst sind nur Bäume der Stadt (Straße, Park). Bäume auf privatem Grund stehen ebenfalls unter Schutz (Wiener Baumschutzgesetz) – Fällen nur mit Bewilligung und Ersatzpflanzung.', u.baeume ? { kreise: u.baumPts.map(c => [c]) } : null));
    }
    if (o.auch && o.auch.length) L.append(karte('', 'Auf diesem Bauplatz auch', o.auch.slice(0, 4).join(', ') + (o.auch.length > 4 ? ' und weitere' : '')));
    if (o.ohneAdr) L.append(karte('meta', 'Ohne Adresse', 'Diesem Grundstück ist keine Hausnummer zugeordnet.'));
    const bp = o.hinweis || (g.gross ? 'Diese Grundbuch-Einlage ist sehr groß (' + g.gross + ' Grundstücke) – gezeigt wird nur dieses Grundstück.' : '')
      || (o.auch && o.auch.length ? 'Zu dieser Einlage gehören mehrere Häuser. Ist das wirklich dein Bauplatz?' : '') || (g.fl > 2000 ? 'Der Bauplatz ist ungewöhnlich groß. Ist das wirklich deiner?' : '');
    if (bp) gelb.unshift(bp);
    const kopf = rot.length ? karte('rot', 'Hier wird es schwierig', rot.concat(gelb).join(' ')) : gelb.length ? karte('gelb', gelb.length === 1 ? 'Ein Punkt zum Prüfen' : gelb.length + ' Punkte zum Prüfen', '')
      : karte('gruen', u ? 'Keine Auffälligkeiten' : 'Grundstück eindeutig gefunden', u ? 'Bauland, kein Schutzgebiet, kein Hochwasser, Grundstück eindeutig.' : 'Fläche und Grenzen stammen aus dem amtlichen Kataster.');
    if (!rot.length && gelb.length) { const ul = document.createElement('ul'); ul.className = 'g-pl'; gelb.forEach(t => { const li = document.createElement('li'); li.textContent = t; ul.append(li); }); kopf.append(ul); }
    D.append(kopf);
    D.append(g.bebaubar ? karte('bau', 'Bebaubar höchstens ' + g.bebaubar.m2 + ' m²', 'So viel Grundfläche darf dein Haus haben – die blaue Fläche im Plan.', g.bebaubar.text, g.bebaubar.zeig) : karte('bald', 'Wie viel darfst du hier bauen?', 'Erlaubte Höhe, Geschosse und Reserve in m² berechnen wir im nächsten Schritt.')); requestAnimationFrame(ueberlauf);
    if (!u && g.teile) umfeld(g).then(v => { g.umf = v; if (M.sel === g) zeigeInfo(g, g.infoO); }, () => { g.umf = {}; if (M.sel === g) zeigeInfo(g, g.infoO); }); };
  const ladeKg = () => { if (!kgNamen) kgNamen = fetch('kataster/kg.json').then(r => r.json()).then(j => (M.kg = j.kg)).catch(() => (M.kg = {})); return kgNamen; };
  const ueberlauf = () => gBox.toggleAttribute('data-lenis-prevent', gBox.scrollHeight > gBox.clientHeight + 2);   // nur wenn die Box selbst scrollen muss, sonst scrollt die Seite
  if (window.ResizeObserver) { const ro = new ResizeObserver(() => requestAnimationFrame(ueberlauf)); ro.observe(gRes); ro.observe(gBox); } addEventListener('resize', () => requestAnimationFrame(ueberlauf));
  const zeigeBox = () => { const neu = gRes.hidden; gRes.hidden = false; gBox.classList.add('has-res'); if (neu) tipZeigen(); };
  // Adressen auf einem Grundstück: Stadt-Wien-Adressen im Umkreis holen, Gebäudepunkt (bzw. Eingang) muss im Grundstück liegen
  async function adressenAuf(g) {
    const B = bbox(g.polys.flatMap(pg => pg[0])), m = 0.00008;
    let fc = null; try { fc = await hol('https://data.wien.gv.at/daten/geo?service=WFS&request=GetFeature&version=1.0.0&typeName=ogdwien:ADRESSENOGD&srsName=EPSG:4326&outputFormat=json&maxFeatures=300&bbox='
      + [B[0] - m, B[1] - m, B[2] + m, B[3] + m].map(v => v.toFixed(6)).join(',') + ',EPSG:4326').then(r => r.json()); } catch { return []; }
    const L = ((fc && fc.features) || []).map(x => { const c = x.geometry && x.geometry.coordinates, p = x.properties || {}; if (!c || !p.NAME_ONR) return null; const ein = zugang(c[0], c[1], p);
      return (kInPoly(c, g.polys) || kInPoly(ein, g.polys)) ? { name: p.NAME, str: p.NAME_STR, nr: p.NAME_ONR, plz: p.PLZ, haupt: p.HAUPT_IDENT_PSEUDO === 'H', ein, geb: c } : null; }).filter(Boolean);
    const nk = n => parseInt(n, 10) || 1e6; L.sort((a, b) => (b.haupt - a.haupt) || a.str.localeCompare(b.str, 'de') || nk(a.nr) - nk(b.nr));
    const seen = new Set(); return L.filter(a => !seen.has(a.name) && seen.add(a.name)); }
  const adrTitel = A => A.length ? A[0].name + (A[1] ? ' / ' + (A[1].str === A[0].str ? A[1].nr : A[1].name) : '') + (A.length > 2 ? ' u. a.' : '') + ', ' + A[0].plz + ' Wien' : '';
  const auchText = A => { const haupt = A.length ? grundNr(A[0]) : ''; const andere = [...new Set(A.filter(a => grundNr(a) !== haupt).map(a => a.name.replace(/\/.*$/, '')))];
    return andere; };
  // Grundstück gewählt (Klick oder Grundstückssuche) → Adresse dazu suchen und oben anzeigen
  async function grundstueckZeigen(g, wie, pkt) { const tok = ++wahlN;
    const ip = pkt || (() => { const b = bbox(g.polys.flatMap(pg => pg[0])); return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]; })();
    g = await bauplatzFuer(g, ip[0], ip[1]); if (tok !== wahlN) return; if (!g.teile.some(t => kInPoly(ip, t.polys)) && pkt) { /* Punkt außerhalb: trotzdem anzeigen */ }
    M.sel = g; M.pt = null; M.akt = null; M.marks.forEach(x => x.btn && x.btn.classList.remove('on'));
    $('resAddr').textContent = 'Grundstück ' + g.gnr; zeigeInfo(g); $('resHint').textContent = 'Ziehen = verschieben · + / − = zoomen · Klick = anderes Grundstück'; mapKick();
    const A = await adressenAuf(g); if (M.sel !== g || tok !== wahlN) return;
    if (!A.length) { $('resAddr').textContent = 'Grundstück ' + g.gnr; zeigeInfo(g, { ohneAdr: true }); return; }
    $('resAddr').textContent = adrTitel(A); zeigeInfo(g, { auch: auchText(A) }); M.pt = A[0].ein; gIn.value = A[0].name + ', ' + A[0].plz + ' Wien';
    const mk = M.marks.find(x => x.f.properties.Adresse === A[0].name); if (mk) { M.akt = mk; M.marks.forEach(x => x.btn && x.btn.classList.toggle('on', x === mk)); mk.btn && mk.btn.scrollIntoView({ block: 'nearest', inline: 'center' }); }
    mapKick(); }
  async function parzelleWaehlen(lon, lat) {
    const tok = ++wahlN; const r = await grundstueck(lon, lat); await ladeKg(); if (tok !== wahlN || !r || !r.genau) return;   // Klick auf Straße ohne Kataster → nichts ändern
    grundstueckZeigen(r.g, '', [lon, lat]); }

  // Zugangspunkt (Eingang an der Straße) = Gebäudepunkt + Versatz ZUG − GEB (Gauß-Krüger, Meter) – Gebäudepunkt liegt mitten im Haus
  const zugang = (lon, lat, p) => { const dx = (+p.ZUG_X) - (+p.GEB_X), dy = (+p.ZUG_Y) - (+p.GEB_Y);
    if (!isFinite(dx) || !isFinite(dy) || Math.hypot(dx, dy) > 80) return [lon, lat];
    return [lon + dx / (111320 * Math.cos(lat * Math.PI / 180)), lat + dy / 110540]; };
  const WFSADR = cql => 'https://data.wien.gv.at/daten/geo?service=WFS&request=GetFeature&version=1.0.0&typeName=ogdwien:ADRESSENOGD&srsName=EPSG:4326&outputFormat=json&maxFeatures=1500&cql_filter=' + encodeURIComponent(cql);
  const adrPunkte = f => hol(WFSADR("NAME='" + f.properties.Adresse.replace(/'/g, "''") + "'" + (f.properties.PostalCode ? " AND PLZ='" + f.properties.PostalCode + "'" : '')))
    .then(r => r.json()).then(fc => { const x = (fc.features || [])[0]; return x ? { geb: x.geometry.coordinates, ein: zugang(x.geometry.coordinates[0], x.geometry.coordinates[1], x.properties) } : null; }).catch(() => null);
  // ganze Straße (ohne Hausnummer): alle Adressen der Straße holen und als Hausnummern zeigen
  const STR = (name, bez) => 'https://data.wien.gv.at/daten/geo?service=WFS&request=GetFeature&version=1.0.0&typeName=ogdwien:ADRESSENOGD&srsName=EPSG:4326&outputFormat=json&maxFeatures=1500&cql_filter='
    + encodeURIComponent("NAME_STR='" + name.replace(/'/g, "''") + "'" + (bez ? " AND GEB_BEZIRK IN (" + String(bez).split(/\s*,\s*/).filter(Boolean).map(b => "'" + b.padStart(2, '0') + "'").join(',') + ")" : ''));   // Straße über mehrere Bezirke: „16, 17“
  async function strasseZeigen(f) { const tok = wahlN;
    const name = f.properties.StreetName || f.properties.Adresse, bez = f.properties.Bezirk; gMsg.textContent = 'Straße wird geladen …';
    let fc; try { fc = await hol(STR(name, bez)).then(r => r.json()); } catch { fc = null; }
    const L = ((fc && fc.features) || []).filter(x => x.geometry && x.properties && x.properties.NAME_ONR).map(x => { const [elon, elat] = zugang(x.geometry.coordinates[0], x.geometry.coordinates[1], x.properties); return { lon: elon, lat: elat, nr: x.properties.NAME_ONR, ein: [elon, elat],
      f: { geometry: { coordinates: x.geometry.coordinates }, properties: { Adresse: x.properties.NAME, PostalCode: x.properties.PLZ, StreetNumber: x.properties.NAME_ONR, StreetName: x.properties.NAME_STR } } }; });
    await ladeKg(); if (tok !== wahlN) return; gMsg.textContent = ''; kartenLeeren(); M.marks = L; M.sel = null; M.pt = null; M.akt = null;
    if (!L.length) { nummernZeigen();                                                      // Flurname/Platz ohne Hausnummern (z. B. Wiese, Park): nur Ausschnitt zeigen, nichts vorwählen
      const [lon, lat] = f.geometry.coordinates; $('resAddr').textContent = name; $('resInfo').textContent = 'Kein Ort mit Hausnummern – klick auf das Grundstück, das du meinst';
      $('resHint').textContent = 'Ziehen = verschieben · + / − = zoomen · Klick = Grundstück wählen'; zeigeBox();
      requestAnimationFrame(() => { [M.cx, M.cy] = kMerc(lon, lat); M.k = 2 ** 17.5; mapRender(); }); return; }
    const nrKey = n => { const m = /^(\d+)(.*)$/.exec(n) || [0, 1e6, n]; return [+m[1], m[2]]; };
    L.sort((a, b) => { const A = nrKey(a.nr), B = nrKey(b.nr); return A[0] - B[0] || A[1].localeCompare(B[1], 'de'); });
    const seen = new Set(), anz = {}; M.marks = L.filter(m => { const k = m.nr + '|' + m.f.properties.PostalCode; return !seen.has(k) && seen.add(k); });
    M.marks.forEach(m => anz[m.nr] = (anz[m.nr] || 0) + 1); M.marks.forEach(m => { m.lab = anz[m.nr] > 1 ? m.nr + ' (' + m.f.properties.PostalCode + ')' : m.nr; });   // gleiche Nummer in 2 Bezirken
    $('resAddr').textContent = name + (bez ? ', ' + String(bez).split(/\s*,\s*/).join('./') + '. Bezirk' : ', Wien'); $('resInfo').textContent = 'Wähle oben deine Hausnummer – oder klick im Plan direkt auf ein Grundstück.';
    $('resHint').textContent = ''; nummernZeigen(); zeigeBox();
    requestAnimationFrame(() => { const m0 = M.marks[0]; [M.cx, M.cy] = kMerc(m0.lon, m0.lat); M.k = 2 ** 18.3; mapRender(); }); }
  function nummernZeigen() {
    const box = $('numChips'); box.textContent = ''; gBox.classList.toggle('has-nums', M.marks.length > 0); $('resNums').hidden = !M.marks.length;
    M.marks.forEach(m => { const b = document.createElement('button'); b.type = 'button'; b.textContent = m.lab || m.nr; b.setAttribute('role', 'listitem'); m.btn = b;
      b.addEventListener('click', () => nummerWaehlen(m)); box.append(b); }); }
  function nummerWaehlen(m) { M.akt = m; M.marks.forEach(x => x.btn && x.btn.classList.toggle('on', x === m)); m.btn && m.btn.scrollIntoView({ block: 'nearest', inline: 'center' });
    [M.cx, M.cy] = kMerc(m.lon, m.lat); if (M.k < 2 ** 18) M.k = 2 ** 18.3; waehlen(m.f, true, m.ein); }
  $('numIn').addEventListener('keydown', e => { if (e.key !== 'Enter') return; e.preventDefault(); const v = e.target.value.trim().toLowerCase().replace(/\s+/g, '');
    const m = M.marks.find(x => x.nr.toLowerCase().replace(/\s+/g, '') === v) || M.marks.find(x => parseInt(x.nr, 10) === parseInt(v, 10)) || M.marks.find(x => { const b = /^(\d+)-(\d+)/.exec(x.nr); return b && +v >= +b[1] && +v <= +b[2]; });
    if (m) { nummerWaehlen(m); e.target.value = ''; } else { $('resInfo').textContent = 'Hausnummer ' + e.target.value + ' gibt es in dieser Straße nicht.'; } });

  async function waehlen(f, ausKarte, ein) {
    clearTimeout(sugT); ++sugN; sugZeigen([]); const tok = ++wahlN; if (!hatNr(f)) { gIn.value = f.properties.Adresse; return strasseZeigen(f); }
    gIn.value = adrText(f); if (!ausKarte) gMsg.textContent = 'Grundstück wird gesucht …';
    const [lon, lat] = f.geometry.coordinates;
    try {
      const [r0, ap] = await Promise.all([grundstueck(lon, lat), ein ? null : mitTimeout(adrPunkte(f), 4000, null), ladeKg()]); if (tok !== wahlN) return;
      let r = r0; if (ap && ap.geb) { const rg = await grundstueck(ap.geb[0], ap.geb[1]); if (tok !== wahlN) return; if (rg && rg.genau) r = rg; }   // Gebäudepunkt zuerst – Adresspunkt liegt oft am Gehsteig
      if (!r) { gMsg.textContent = 'An dieser Adresse habe ich kein Grundstück gefunden – bitte eine andere Hausnummer probieren.'; return; }
      const bp = await bauplatzFuer(r.g, lon, lat); if (tok !== wahlN) return;
      gMsg.textContent = ''; $('resAddr').textContent = adrText(f); zeigeInfo(bp, r.genau ? {} : { hinweis: 'Der Adresspunkt liegt knapp außerhalb eines Grundstücks – wir haben das nächste gewählt.' });
      $('resHint').textContent = 'Ziehen = verschieben · + / − = zoomen · Klick = anderes Grundstück';
      M.sel = bp; M.pt = ein || (ap && ap.ein) || [lon, lat]; if (!ausKarte) { M.marks = []; M.akt = null; nummernZeigen(); } zeigeBox();
      if (bp.teile.length > 1) adressenAuf(bp).then(A => { if (M.sel === bp && A.length) { const t = auchText([{ str: f.properties.StreetName || '', nr: f.properties.StreetNumber, name: f.properties.Adresse }].concat(A)); if (t.length) zeigeInfo(bp, { auch: t }); } });
      requestAnimationFrame(() => { if (!ausKarte) zoomAuf(bbox(bp.polys.flatMap(pg => pg[0])), 0.5); mapRender(); });
    } catch (err) { if (tok === wahlN) gMsg.textContent = 'Das Grundstück konnte gerade nicht geladen werden – bitte nochmal versuchen.'; } }

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
