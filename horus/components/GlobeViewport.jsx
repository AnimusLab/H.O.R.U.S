'use client';
import { useMemo, useRef, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Billboard, Stars, Text } from '@react-three/drei';
import * as THREE from 'three';
import { feature } from 'topojson-client';
import { useHorus, CAT } from './store';
import { bus } from './leaderBus';

// One scene, two projections. MODE is set at the top of GlobeViewport's render, before children read it.
let MODE = '3d';
const sph = (lat, lon, r = 1) => {
  const p = ((90 - lat) * Math.PI) / 180, t = ((lon + 180) * Math.PI) / 180;
  return new THREE.Vector3(-r * Math.sin(p) * Math.cos(t), r * Math.cos(p), r * Math.sin(p) * Math.sin(t));
};
const ll = (lat, lon, r = 1) => (MODE === '2d' ? new THREE.Vector3((lon / 180) * 2, lat / 90, r > 1.0005 ? 0.004 : 0) : sph(lat, lon, r));
const d2ll = (v) => { const n = v.clone().normalize(), lon = (Math.atan2(n.z, -n.x) * 180) / Math.PI - 180; return [(Math.asin(n.y) * 180) / Math.PI, ((lon + 540) % 360) - 180]; };
const place = (v, r) => (MODE === '2d' ? ll(...d2ll(v), r) : v.clone().multiplyScalar(r)); // unit direction -> scene position
const slerp = (A, B, t) => { const w = A.angleTo(B) || 1e-6, s = Math.sin(w); return A.clone().multiplyScalar(Math.sin((1 - t) * w) / s).add(B.clone().multiplyScalar(Math.sin(t * w) / s)); };
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), Z = new THREE.Vector3(0, 0, 1);

function Grid() {
  const mode = useHorus((s) => s.mode);
  const g = useMemo(() => {
    const p = [];
    for (let la = -80; la <= 80; la += 10) for (let o = -180; o < 180; o += 3) p.push(ll(la, o, 1.002), ll(la, o + 3, 1.002));
    for (let lo = -180; lo <= 180; lo += 10) for (let la = -90; la < 90; la += 3) p.push(ll(la, lo, 1.002), ll(la + 3, lo, 1.002));
    return new THREE.BufferGeometry().setFromPoints(p);
  }, [mode]);
  return <lineSegments geometry={g}><lineBasicMaterial color="#00F0FF" transparent opacity={0.12} blending={THREE.AdditiveBlending} depthWrite={false} /></lineSegments>;
}

function Land() { // Natural Earth land -> mask -> dot matrix (sphere sampling for 3D, regular grid for 2D)
  const mode = useHorus((s) => s.mode), [raw, setRaw] = useState(null);
  useEffect(() => {
    fetch('https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/land-110m.json').then((r) => r.json()).then((t) => {
      const f = feature(t, t.objects.land), W = 1440, H = 720, cv = document.createElement('canvas');
      cv.width = W; cv.height = H;
      const c = cv.getContext('2d'), X = (lo) => ((lo + 180) / 360) * W, Y = (la) => ((90 - la) / 180) * H, seg = [], d3 = [], d2 = [];
      c.fillStyle = '#fff';
      (f.features || [f]).forEach((x) => {
        const polys = x.geometry.type === 'Polygon' ? [x.geometry.coordinates] : x.geometry.coordinates;
        polys.forEach((poly) => {
          c.beginPath();
          poly.forEach((r) => { r.forEach(([lo, la], i) => (i ? c.lineTo(X(lo), Y(la)) : c.moveTo(X(lo), Y(la))));
            for (let i = 0; i < r.length - 1; i++) seg.push([r[i][1], r[i][0], r[i + 1][1], r[i + 1][0]]); });
          c.fill('evenodd');
        });
      });
      const px = c.getImageData(0, 0, W, H).data;
      const land = (la, lo) => px[(Math.min(H - 1, Math.floor(Y(la))) * W + Math.min(W - 1, Math.floor(X(lo)))) * 4 + 3] > 0;
      for (let la = -88; la <= 88; la += 1) {
        const n = Math.max(1, Math.round(360 * Math.cos((la * Math.PI) / 180)));
        for (let i = 0; i < n; i++) { const lo = -180 + (i * 360) / n; if (land(la, lo)) d3.push([la, lo]); }
        for (let lo = -180; lo < 180; lo += 1) if (land(la, lo)) d2.push([la, lo]);
      }
      setRaw({ seg, d3, d2 });
    }).catch(() => {});
  }, []);
  const g = useMemo(() => {
    if (!raw) return null;
    const ls = [];
    raw.seg.forEach(([a, b, c, d]) => { if (mode === '2d' && Math.abs(b - d) > 180) return; ls.push(ll(a, b, 1.002), ll(c, d, 1.002)); });
    return { dots: new THREE.BufferGeometry().setFromPoints((mode === '2d' ? raw.d2 : raw.d3).map(([la, lo]) => ll(la, lo, 1.003))), lines: new THREE.BufferGeometry().setFromPoints(ls) };
  }, [raw, mode]);
  if (!g) return null;
  return (<>
    <points geometry={g.dots}><pointsMaterial color="#38BDF8" size={0.0085} sizeAttenuation transparent opacity={0.95} blending={THREE.AdditiveBlending} depthWrite={false} /></points>
    <lineSegments geometry={g.lines}><lineBasicMaterial color="#00F0FF" transparent opacity={0.3} /></lineSegments>
  </>);
}

function Atmosphere() {
  return (
    <mesh scale={1.2}>
      <sphereGeometry args={[1, 64, 64]} />
      <shaderMaterial transparent side={THREE.BackSide} blending={THREE.AdditiveBlending} depthWrite={false}
        vertexShader="varying vec3 n;void main(){n=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}"
        fragmentShader="varying vec3 n;void main(){float i=pow(clamp(-dot(normalize(n),vec3(0.,0.,1.))/0.55,0.,1.),2.5);gl_FragColor=vec4(0.,0.75,1.,1.)*i*0.35;}" />
    </mesh>
  );
}

function Scan() { // screen space GLSL overlay: scanlines + CRT vignette
  const u = useRef({ t: { value: 0 } });
  useFrame(({ clock }) => { u.current.t.value = clock.elapsedTime; });
  return (
    <mesh renderOrder={999} frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial transparent depthTest={false} depthWrite={false} uniforms={u.current}
        vertexShader="varying vec2 v;void main(){v=position.xy;gl_Position=vec4(position.xy,0.,1.);}"
        fragmentShader="uniform float t;varying vec2 v;void main(){float s=0.5+0.5*sin(gl_FragCoord.y*1.6+t*3.);float vig=smoothstep(0.6,1.35,length(v));gl_FragColor=vec4(0.,0.03,0.07,vig*0.6+s*0.06);}" />
    </mesh>
  );
}

const HALO = { unrest: 0.1, election: 0.06, conflict: 0.05, anomaly: 0.03 };
function Ping({ e }) {
  const rings = useRef([]), select = useHorus((s) => s.select);
  const U = e.cat === 'unrest', c = CAT[e.cat].color, off = Math.abs(e.lat) * 0.13, N = U ? 3 : e.cat === 'conflict' ? 2 : 1, R = U ? 0.06 : 0.03;
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    rings.current.forEach((m, i) => {
      if (!m) return;
      if (e.cat === 'election') { m.scale.setScalar(1 + 0.12 * Math.sin(t * 3)); m.material.opacity = 0.75; }
      else if (e.cat === 'anomaly') { m.scale.setScalar(0.7); m.material.opacity = Math.sin(t * 25 + off * 9) > 0.55 ? 1 : 0.1; }
      else { const k = (t * (U ? 0.6 : 1.6) + i / N + off) % 1; m.scale.setScalar(U ? 1 + k * 1.5 : 0.3 + k * 1.8); m.material.opacity = 1 - k; }
    });
  });
  return (
    <Billboard position={ll(e.lat, e.lon, 1.012)}>
      <mesh><circleGeometry args={[HALO[e.cat], 32]} /><meshBasicMaterial color={U ? '#8B0000' : c} transparent opacity={U ? 0.45 : 0.13} depthWrite={false} /></mesh>
      {Array.from({ length: N }, (_, i) => (
        <mesh key={i} ref={(r) => (rings.current[i] = r)}><ringGeometry args={[R, R * 1.18, 48]} /><meshBasicMaterial color={c} transparent depthWrite={false} blending={THREE.AdditiveBlending} /></mesh>))}
      <mesh onClick={(ev) => { ev.stopPropagation(); select(e.id); }}><circleGeometry args={[0.014, 16]} /><meshBasicMaterial color={c} /></mesh>
    </Billboard>
  );
}

function EventCluster({ events }) {
  const select = useHorus((s) => s.select);
  const setFocus = useHorus((s) => s.setFocus);
  const first = events[0];
  const center = events.reduce((point, event) => ({
    lat: point.lat + event.lat / events.length,
    lon: point.lon + event.lon / events.length,
  }), { lat: 0, lon: 0 });
  const radius = Math.min(0.055, 0.024 + events.length * 0.003);
  return (
    <Billboard position={ll(events.reduce((sum, event) => sum + event.lat, 0) / events.length, events.reduce((sum, event) => sum + event.lon, 0) / events.length, 1.014)}>
      <mesh onClick={(ev) => {
        ev.stopPropagation();
        select(first.id);
        setFocus(center);
      }}>
        <circleGeometry args={[radius, 24]} />
        <meshBasicMaterial color="#FBBF24" transparent opacity={0.8} depthWrite={false} />
      </mesh>
      <Text position={[0, 0, 0.01]} fontSize={0.025} color="#020617" anchorX="center" anchorY="middle">
        {events.length}
      </Text>
    </Billboard>
  );
}

function Arc({ a, b, i }) {
  const dots = useRef([]), mode = useHorus((s) => s.mode), selectArc = useHorus((s) => s.selectArc);
  const { curve, geo } = useMemo(() => {
    const A = ll(...a), B = ll(...b), m = A.clone().add(B).multiplyScalar(0.5);
    let ctrl;
    if (MODE === '2d') { ctrl = m.clone(); ctrl.y += A.distanceTo(B) * 0.5; ctrl.z = 0.01; }
    else { const h = 0.35 * Math.sqrt(A.angleTo(B) / Math.PI); ctrl = m.clone().setLength(2 * (1 + h) - m.length()); } // peak altitude capped at 0.35 R
    const curve = new THREE.QuadraticBezierCurve3(A, ctrl, B);
    return { curve, geo: new THREE.BufferGeometry().setFromPoints(curve.getPoints(80)) };
  }, [a, b, mode]);
  useFrame(({ clock }) => dots.current.forEach((m, k) => m.position.copy(curve.getPoint(((clock.elapsedTime * 0.22 + k / 3) % 1)))));
  return (<group>
    <line geometry={geo} onClick={(ev) => { ev.stopPropagation(); selectArc(i); }}><lineBasicMaterial color="#FF0033" transparent opacity={0.9} blending={THREE.AdditiveBlending} /></line>
    {[0, 1, 2].map((k) => (<mesh key={k} ref={(r) => (dots.current[k] = r)}><sphereGeometry args={[0.013, 12, 12]} /><meshBasicMaterial color="#FF7088" /></mesh>))}
  </group>);
}

// ---- Optional layers. SIMULATED tracks; swap in live ADS-B / AIS / TLE data. ----
const ROUTES = [[[40.64, -73.78], [51.47, -0.45]], [[25.25, 55.36], [1.36, 103.99]], [[33.94, -118.4], [35.77, 140.39]], [[-23.43, -46.47], [40.47, -3.57]], [[-26.13, 28.24], [25.27, 51.61]],
  [[-33.94, 151.18], [1.36, 103.99]], [[28.56, 77.1], [51.47, -0.45]], [[33.64, -84.43], [50.03, 8.57]], [[40.08, 116.58], [37.62, -122.38]], [[49.0, 2.55], [25.25, 55.36]]];
function Air() {
  const ref = useRef(), R = useMemo(() => ROUTES.map(([a, b]) => [sph(...a), sph(...b)]), []), N = R.length * 4;
  const d = useMemo(() => new THREE.Object3D(), []), geo = useMemo(() => new THREE.ConeGeometry(0.007, 0.024, 3).rotateX(Math.PI / 2), []);
  useFrame(({ clock }) => {
    for (let i = 0; i < N; i++) {
      const [A, B] = R[i % R.length], t = (clock.elapsedTime * 0.02 + (i / N) * 3.7) % 1;
      const p = place(slerp(A, B, t), 1.02), q = place(slerp(A, B, Math.min(1, t + 0.01)), 1.02);
      d.position.copy(p); d.up.copy(MODE === '2d' ? Z : _a.copy(p).normalize()); d.lookAt(q); d.updateMatrix(); ref.current.setMatrixAt(i, d.matrix);
    }
    ref.current.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[geo, undefined, N]} frustumCulled={false}><meshBasicMaterial color="#F8FAFC" /></instancedMesh>;
}

const LANES = [[[51.9, 4], [48.5, -5], [36, -8], [35.9, 14], [31.3, 32.3], [12.6, 43.3], [12, 50], [6, 78], [1.2, 103.8], [22, 114], [31.2, 122.5]],
  [[50, -5], [46, -35], [40.5, -73.5]], [[31, 122], [40, 160], [42, -170], [37, -122.5]], [[36, -8], [5, -20], [-34.5, 18.4], [-20, 50], [6, 78]]];
function Ships() {
  const L = useMemo(() => LANES.map((l) => l.map(([a, b]) => sph(a, b))), []), N = 56;
  const geo = useMemo(() => new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3)), []);
  useFrame(({ clock }) => {
    const pos = geo.attributes.position;
    for (let i = 0; i < N; i++) {
      const w = L[i % L.length], n = w.length - 1, u = (((i * 0.618) % 1) + clock.elapsedTime * 0.01) % 1 * n, k = Math.min(n - 1, Math.floor(u));
      const p = place(slerp(w[k], w[k + 1], u - k), 1.006); pos.setXYZ(i, p.x, p.y, p.z);
    }
    pos.needsUpdate = true;
  });
  return <points geometry={geo} frustumCulled={false}><pointsMaterial color="#A7F3D0" size={0.014} sizeAttenuation depthWrite={false} /></points>;
}

const SATS = [[51.6, 0.5, 1.12, 0.5], [98, 2.2, 1.18, 0.4], [63, 4, 1.3, 0.3], [28, 1, 1.1, 0.6], [87, 5, 1.24, 0.35], [0, 0, 1.5, 0.15]]; // incl deg, raan rad, radius, speed
function Sats() {
  const mode = useHorus((s) => s.mode), pts = useRef();
  const Q = useMemo(() => SATS.map(([i, r]) => new THREE.Quaternion().setFromEuler(new THREE.Euler((i * Math.PI) / 180, r, 0, 'YXZ'))), []);
  const dir = (k, a) => new THREE.Vector3(Math.cos(a), 0, Math.sin(a)).applyQuaternion(Q[k]);
  const tracks = useMemo(() => {
    const p = [];
    SATS.forEach(([, , r], k) => { for (let i = 0; i < 96; i++) { const A = place(dir(k, (i / 96) * 6.2832), r), B = place(dir(k, ((i + 1) / 96) * 6.2832), r); if (MODE === '3d' || Math.abs(A.x - B.x) < 1.5) p.push(A, B); } });
    return new THREE.BufferGeometry().setFromPoints(p);
  }, [mode]);
  useFrame(({ clock }) => {
    const a = pts.current.geometry.attributes.position;
    SATS.forEach(([, , r, sp], k) => { const p = place(dir(k, clock.elapsedTime * sp * 0.3), r); a.setXYZ(k, p.x, p.y, p.z); });
    a.needsUpdate = true;
  });
  return (<>
    <lineSegments geometry={tracks}><lineBasicMaterial color="#C4B5FD" transparent opacity={0.4} /></lineSegments>
    <points ref={pts} frustumCulled={false}><bufferGeometry><bufferAttribute attach="attributes-position" count={SATS.length} array={new Float32Array(SATS.length * 3)} itemSize={3} /></bufferGeometry><pointsMaterial color="#EDE9FE" size={0.03} sizeAttenuation /></points>
  </>);
}

function Projector({ items }) { // world -> NDC -> pixels each frame; redraws the SVG overlay in the same frame
  const { camera, size } = useThree(), mode = useHorus((s) => s.mode);
  const pts = useMemo(() => items.map((e) => ll(e.lat, e.lon, 1.012)), [items, mode]);
  useFrame(() => {
    items.forEach((e, i) => {
      const p = _c.copy(pts[i]).project(camera);
      bus[e.id] = { x: (p.x * 0.5 + 0.5) * size.width, y: (-p.y * 0.5 + 0.5) * size.height,
        vis: p.z < 1 && (MODE === '2d' ? Math.abs(p.x) < 1 && Math.abs(p.y) < 1 : _a.copy(camera.position).normalize().dot(_b.copy(pts[i]).normalize()) > 0.3) };
    });
    if (bus.update) bus.update();
  });
  return null;
}

function Rig() {
  const { camera } = useThree(), ctl = useRef(), focus = useHorus((s) => s.focus), mode = useHorus((s) => s.mode), flat = mode === '2d';
  useEffect(() => {
    camera.position.set(...(flat ? [0, 0, 2.55] : sph(32, 20, 2.7).toArray()));
    ctl.current.target.set(0, 0, 0); ctl.current.update();
  }, [mode]);
  useFrame(() => {
    if (focus) {
      const t = ll(focus.lat, focus.lon, flat ? 1 : 2.2);
      if (flat) { ctl.current.target.lerp(_a.set(t.x, t.y, 0), 0.06); camera.position.lerp(_b.set(t.x, t.y, 2.2), 0.06); } else camera.position.lerp(t, 0.06);
    }
    ctl.current.autoRotate = !focus && !flat;
    ctl.current.update();
  });
  return <OrbitControls ref={ctl} enablePan={flat} enableRotate={!flat} minDistance={1.5} maxDistance={flat ? 5 : 4} autoRotateSpeed={0.35} rotateSpeed={0.5}
    mouseButtons={{ LEFT: flat ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }}
    onStart={() => useHorus.getState().setFocus(null)} />;
}

export default function GlobeViewport() {
  const { events, filters, sourceFilters, severityFilters, arcs, layers, mode } = useHorus();
  MODE = mode;
  const live = layers.pings ? events.filter((e) => filters[e.cat] && sourceFilters[e.source] !== false && severityFilters[e.severity] !== false) : [];
  const groups = useMemo(() => {
    const grouped = new Map();
    live.forEach((event) => {
      const cell = mode === '2d' ? 8 : 12;
      const key = `${Math.floor(event.lat / cell)}:${Math.floor(event.lon / cell)}`;
      const group = grouped.get(key) || [];
      group.push(event);
      grouped.set(key, group);
    });
    return [...grouped.values()];
  }, [live, mode]);
  return (
    <Canvas camera={{ position: sph(32, 20, 2.7).toArray(), fov: 45 }} dpr={[1, 2]} raycaster={{ params: { Line: { threshold: 0.03 } } }}>
      <Stars radius={30} depth={30} count={2500} factor={2.2} fade speed={0.4} />
      {mode === '3d' && <><mesh><sphereGeometry args={[0.995, 64, 64]} /><meshBasicMaterial color="#030712" /></mesh><Atmosphere /></>}
      <Grid /><Land />
      {layers.air && <Air />}{layers.ships && <Ships />}{layers.sats && <Sats />}
      {layers.pings && filters.conflict && arcs.map((r, i) => <Arc key={i} i={i} {...r} />)}
      {groups.map((group) => group.length === 1
        ? <Ping key={group[0].id} e={group[0]} />
        : <EventCluster key={group.map((event) => event.id).join('-')} events={group} />)}
      <Rig />
      <Projector items={live.filter((e) => e.callout)} />
      <Scan />
    </Canvas>
  );
}
