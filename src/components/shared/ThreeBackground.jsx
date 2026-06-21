import { useEffect, useRef } from 'react';
import * as THREE from 'three';

const COLORS = ['#4a8fd4', '#c46090', '#c9a838', '#64c882'];
const BG     = '#0d0d0f';

const VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = `
  uniform float time;
  uniform vec3 cA;
  uniform vec3 cB;
  uniform vec3 cC;
  uniform vec3 cBg;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  void main() {
    vec2 uv = vUv;
    float w1 = sin(uv.x * 2.8 + time * 0.18) * 0.5 + 0.5;
    float w2 = sin(uv.x * 1.9 - time * 0.13 + 2.1) * 0.5 + 0.5;
    float w3 = sin(uv.y * 3.2 + time * 0.10 + 1.0) * 0.5 + 0.5;
    float w4 = sin((uv.x + uv.y) * 2.0 - time * 0.08) * 0.5 + 0.5;

    float mA = smoothstep(0.2, 0.9, w1 * (1.0 - uv.y * 0.6));
    float mB = smoothstep(0.2, 0.9, w2 * uv.y * 1.3);
    float mC = smoothstep(0.3, 0.8, w3 * w4 * 0.8);

    vec3 col = cBg;
    col += cA * mA * 0.09;
    col += cB * mB * 0.07;
    col += cC * mC * 0.05;

    gl_FragColor = vec4(col, 1.0);
  }
`;

export default function ThreeBackground() {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    const W = window.innerWidth, H = window.innerHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    mount.appendChild(renderer.domElement);

    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 100);
    camera.position.z = 6;

    // ── Aurora plane ──────────────────────────────────────────────
    const auroraGeo = new THREE.PlaneGeometry(24, 14);
    const auroraMat = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        cA:   { value: new THREE.Color(COLORS[0]) },
        cB:   { value: new THREE.Color(COLORS[1]) },
        cC:   { value: new THREE.Color(COLORS[2]) },
        cBg:  { value: new THREE.Color(BG) },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
    });
    const aurora = new THREE.Mesh(auroraGeo, auroraMat);
    aurora.position.z = -3;
    scene.add(aurora);


    // ── Mouse parallax ────────────────────────────────────────────
    const mouse = { x: 0, y: 0 };
    function onMouse(e) {
      mouse.x = (e.clientX / window.innerWidth  - 0.5) * 2;
      mouse.y = -(e.clientY / window.innerHeight - 0.5) * 2;
    }
    window.addEventListener('mousemove', onMouse);

    // ── Resize ────────────────────────────────────────────────────
    function onResize() {
      const w = window.innerWidth, h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener('resize', onResize);

    // ── Loop ──────────────────────────────────────────────────────
    let animId;
    const clock = new THREE.Clock();

    function animate() {
      animId = requestAnimationFrame(animate);
      if (document.hidden) return;
      const t = clock.getElapsedTime();

      auroraMat.uniforms.time.value = t;

      camera.position.x += (mouse.x * 0.4 - camera.position.x) * 0.025;
      camera.position.y += (mouse.y * 0.25 - camera.position.y) * 0.025;

      renderer.render(scene, camera);
    }
    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('mousemove', onMouse);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      ref={mountRef}
      style={{ position: 'fixed', inset: 0, zIndex: -2, pointerEvents: 'none' }}
    />
  );
}
