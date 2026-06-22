import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function TaskScene({ count }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || count === 0) return;

    let w = mount.clientWidth, h = mount.clientHeight;
    if (w < 600) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    camera.position.z = 6;

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(-4, 5, 3);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.5);
    rimLight.position.set(4, -3, 1);
    scene.add(rimLight);

    const panels = [];
    const pointLights = [];

    function buildPanels() {
      panels.forEach(p => { scene.remove(p); p.geometry.dispose(); p.material.dispose(); });
      panels.length = 0;
      pointLights.forEach(l => scene.remove(l));
      pointLights.length = 0;

      const fovRad = camera.fov * Math.PI / 180;
      const frustumH = 2 * Math.tan(fovRad / 2) * camera.position.z;
      const frustumW = frustumH * (w / h);

      const MARGIN = frustumW * 0.012;
      const GAP    = frustumW * 0.018;
      const panelW = (frustumW - 2 * MARGIN - GAP * (count - 1)) / count;
      const panelH = frustumH * 0.92;
      const totalW = count * panelW + (count - 1) * GAP;
      const startX = -totalW / 2 + panelW / 2;

      for (let i = 0; i < count; i++) {
        const color = new THREE.Color(0xffffff);
        const shape = roundedRect(panelW, panelH, 0.09);

        const geo = new THREE.ExtrudeGeometry(shape, {
          depth: 0.14,
          bevelEnabled: true,
          bevelThickness: 0.045,
          bevelSize: 0.038,
          bevelOffset: 0,
          bevelSegments: 6,
        });
        geo.center();

        const mat = new THREE.MeshPhysicalMaterial({
          color,
          metalness: 0.0,
          roughness: 0.05,
          transparent: true,
          opacity: 0.15,
          side: THREE.DoubleSide,
          depthWrite: false,
        });

        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.x = startX + i * (panelW + GAP);
        scene.add(mesh);
        panels.push(mesh);

        const pl = new THREE.PointLight(0xffffff, 0.4, 6);
        pl.position.set(mesh.position.x, 1.5, 2.5);
        scene.add(pl);
        pointLights.push(pl);
      }
    }

    buildPanels();

    const mouse = { x: 0, y: 0 };
    const onMouse = e => {
      mouse.x = (e.clientX / window.innerWidth - 0.5) * 2;
      mouse.y = -(e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('mousemove', onMouse);

    const ro = new ResizeObserver(() => {
      const nw = mount.clientWidth, nh = mount.clientHeight;
      if (nw === w && nh === h) return;
      w = nw; h = nh;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      buildPanels();
    });
    ro.observe(mount);

    let animId;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      if (document.hidden) return;
      const t = clock.getElapsedTime();

      panels.forEach((p, i) => {
        p.rotation.y = Math.sin(t * 0.22 + i * 0.9) * 0.016;
        p.rotation.x = Math.sin(t * 0.15 + i * 0.6) * 0.009;
      });

      camera.position.x += (mouse.x * 0.1 - camera.position.x) * 0.025;
      camera.position.y += (mouse.y * 0.05 - camera.position.y) * 0.025;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('mousemove', onMouse);
      ro.disconnect();
      panels.forEach(p => { p.geometry.dispose(); p.material.dispose(); });
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, [count]);

  return <div ref={mountRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }} />;
}

function roundedRect(w, h, r) {
  const s = new THREE.Shape();
  const hw = w / 2, hh = h / 2;
  s.moveTo(-hw + r, -hh);
  s.lineTo(hw - r, -hh);
  s.quadraticCurveTo(hw, -hh, hw, -hh + r);
  s.lineTo(hw, hh - r);
  s.quadraticCurveTo(hw, hh, hw - r, hh);
  s.lineTo(-hw + r, hh);
  s.quadraticCurveTo(-hw, hh, -hw, hh - r);
  s.lineTo(-hw, -hh + r);
  s.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
  return s;
}
