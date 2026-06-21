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
  precision highp float;
  uniform float time;
  uniform vec3 cA;
  uniform vec3 cB;
  uniform vec3 cC;
  uniform vec3 cBg;
  varying vec2 vUv;

  vec3 mod289v3(vec3 x){return x-floor(x*(1./289.))*289.;}
  vec4 mod289v4(vec4 x){return x-floor(x*(1./289.))*289.;}
  vec4 permute(vec4 x){return mod289v4(((x*34.)+1.)*x);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}

  float snoise(vec3 v){
    const vec2 C=vec2(1./6.,1./3.);
    const vec4 D=vec4(0.,.5,1.,2.);
    vec3 i=floor(v+dot(v,C.yyy));
    vec3 x0=v-i+dot(i,C.xxx);
    vec3 g=step(x0.yzx,x0.xyz);
    vec3 l=1.-g;
    vec3 i1=min(g.xyz,l.zxy);
    vec3 i2=max(g.xyz,l.zxy);
    vec3 x1=x0-i1+C.xxx;
    vec3 x2=x0-i2+C.yyy;
    vec3 x3=x0-D.yyy;
    i=mod289v3(i);
    vec4 p=permute(permute(permute(
      i.z+vec4(0.,i1.z,i2.z,1.))
      +i.y+vec4(0.,i1.y,i2.y,1.))
      +i.x+vec4(0.,i1.x,i2.x,1.));
    float n_=.142857142857;
    vec3 ns=n_*D.wyz-D.xzx;
    vec4 j=p-49.*floor(p*ns.z*ns.z);
    vec4 x_=floor(j*ns.z);
    vec4 y_=floor(j-7.*x_);
    vec4 x=x_*ns.x+ns.yyyy;
    vec4 y=y_*ns.x+ns.yyyy;
    vec4 h=1.-abs(x)-abs(y);
    vec4 b0=vec4(x.xy,y.xy);
    vec4 b1=vec4(x.zw,y.zw);
    vec4 s0=floor(b0)*2.+1.;
    vec4 s1=floor(b1)*2.+1.;
    vec4 sh=-step(h,vec4(0.));
    vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
    vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
    vec3 p0=vec3(a0.xy,h.x);
    vec3 p1=vec3(a0.zw,h.y);
    vec3 p2=vec3(a1.xy,h.z);
    vec3 p3=vec3(a1.zw,h.w);
    vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
    p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
    vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);
    m=m*m;
    return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
  }

  float hash2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}

  void main() {
    vec2 uv = vUv;
    float t = time * 0.08;

    // Domain warp — offset UV by noise before sampling colour fields
    vec2 q = vec2(
      snoise(vec3(uv * 1.8, t)),
      snoise(vec3(uv * 1.8 + vec2(5.2, 1.3), t))
    );
    vec2 w = uv + 0.35 * q;

    float nA = snoise(vec3(w * 1.4,       t + 0.0)) * 0.5 + 0.5;
    float nB = snoise(vec3(w * 1.1 + 3.4, t + 0.7)) * 0.5 + 0.5;
    float nC = snoise(vec3(w * 1.6 - 1.7, t + 1.4)) * 0.5 + 0.5;

    float mA = smoothstep(0.3, 0.85, nA * (1.0 - uv.y * 0.5));
    float mB = smoothstep(0.3, 0.85, nB * uv.y * 1.2);
    float mC = smoothstep(0.35, 0.80, nC * 0.9);

    vec3 col = cBg;
    col += cA * mA * 0.10;
    col += cB * mB * 0.08;
    col += cC * mC * 0.06;

    col += (hash2(uv * 1000.0 + time * 3.7) - 0.5) / 255.0;

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
