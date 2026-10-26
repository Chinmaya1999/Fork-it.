import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/** Real-time WebGL hologram: wireframe icosahedron + inner torus-knot + orbit rings + particle halo. Pointer parallax. */
export default function Hologram({ className }: { className?: string }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current; if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' }); } catch { return; } // no WebGL: render nothing
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // crisp on 4K/retina without runaway cost
    el.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = 'width:100%;height:100%;display:block';

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100); camera.position.z = 10.5;
    const cyan = new THREE.Color('#4ade80'), violet = new THREE.Color('#38bdf8'), pink = new THREE.Color('#fbbf24');
    const mat = (c: THREE.Color, o: number) => new THREE.MeshBasicMaterial({ color: c, wireframe: true, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false });

    const group = new THREE.Group(); scene.add(group);
    const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(1.9, 2), mat(cyan, 0.5));
    const core = new THREE.Mesh(new THREE.TorusKnotGeometry(0.8, 0.22, 140, 16), mat(violet, 0.75));
    const ringA = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.012, 8, 160), mat(pink, 0.9));
    const ringB = new THREE.Mesh(new THREE.TorusGeometry(2.25, 0.01, 8, 160), mat(cyan, 0.8));
    ringA.rotation.x = Math.PI / 2.4; ringB.rotation.y = Math.PI / 2.8;
    group.add(shell, core, ringA, ringB);

    const N = 900, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const r = 2.8 + Math.random() * 2.2, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
      pos.set([r * Math.sin(ph) * Math.cos(th), r * Math.sin(ph) * Math.sin(th) * 0.7, r * Math.cos(ph)], i * 3);
      const c = [cyan, violet, pink][i % 3]; col.set([c.r, c.g, c.b], i * 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const points = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.035, vertexColors: true, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
    scene.add(points);

    const resize = () => { const { clientWidth: w, clientHeight: h } = el; renderer.setSize(w, h, false); camera.aspect = w / Math.max(h, 1); camera.updateProjectionMatrix(); };
    resize(); const ro = new ResizeObserver(resize); ro.observe(el);

    const target = { x: 0, y: 0 };
    const onMove = (e: PointerEvent) => { const r = el.getBoundingClientRect(); target.x = ((e.clientX - r.left) / r.width - 0.5) * 2; target.y = ((e.clientY - r.top) / r.height - 0.5) * 2; };
    window.addEventListener('pointermove', onMove);

    let raf = 0, visible = true; const clock = new THREE.Clock();
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0 }); io.observe(el);
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!visible || document.hidden) return; // pause offscreen / background tab
      const t = clock.getElapsedTime() * (reduced ? 0.15 : 1);
      shell.rotation.set(t * 0.18, t * 0.25, 0); core.rotation.set(-t * 0.4, t * 0.3, t * 0.1);
      ringA.rotation.z = t * 0.5; ringB.rotation.x = t * -0.4; points.rotation.y = t * 0.05;
      const s = 1 + Math.sin(t * 1.4) * 0.025; shell.scale.setScalar(s);
      group.rotation.y += (target.x * 0.5 - group.rotation.y) * 0.05; group.rotation.x += (target.y * 0.3 - group.rotation.x) * 0.05;
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); window.removeEventListener('pointermove', onMove);
      scene.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose(); (m.material as THREE.Material | undefined)?.dispose(); });
      renderer.dispose(); renderer.domElement.remove();
    };
  }, []);

  return <div ref={host} className={className} aria-hidden />;
}
