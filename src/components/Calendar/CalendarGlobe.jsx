import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function CalendarGlobe() {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    const W = mount.clientWidth;
    const H = mount.clientHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 100);
    camera.position.set(0, 0, 4.2);

    // Main wireframe sphere
    const geo = new THREE.SphereGeometry(1.5, 28, 20);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x4a8fd4,
      wireframe: true,
      transparent: true,
      opacity: 0.10,
    });
    const globe = new THREE.Mesh(geo, mat);
    scene.add(globe);

    // Equator ring — slightly brighter accent
    const eqGeo = new THREE.TorusGeometry(1.5, 0.004, 4, 80);
    const eqMat = new THREE.MeshBasicMaterial({ color: 0x4a8fd4, transparent: true, opacity: 0.22 });
    const equator = new THREE.Mesh(eqGeo, eqMat);
    scene.add(equator);

    // Prime meridian ring
    const pmGeo = new THREE.TorusGeometry(1.5, 0.004, 4, 80);
    const pmMat = new THREE.MeshBasicMaterial({ color: 0xc46090, transparent: true, opacity: 0.16 });
    const meridian = new THREE.Mesh(pmGeo, pmMat);
    meridian.rotation.y = Math.PI / 2;
    scene.add(meridian);

    let animId;
    function animate() {
      animId = requestAnimationFrame(animate);
      globe.rotation.y += 0.0008;
      equator.rotation.y += 0.0008;
      renderer.render(scene, camera);
    }
    animate();

    const ro = new ResizeObserver(() => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    ro.observe(mount);

    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      ref={mountRef}
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: -1,
        overflow: 'hidden',
      }}
    />
  );
}
