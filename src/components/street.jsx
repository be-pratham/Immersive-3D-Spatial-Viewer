import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

// This shader handles blending two textures with a horizontal motion blur
const transitionShader = {
  uniforms: {
    uTex1: { value: null },     // The old image
    uTex2: { value: null },     // The new image
    uProgress: { value: 1.0 },  // 0.0 = Old Image, 1.0 = New Image
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D uTex1;
    uniform sampler2D uTex2;
    uniform float uProgress;
    varying vec2 vUv;

    void main() {
      // Create a blur curve: 0 -> MaxBlur -> 0
      float blurStrength = sin(uProgress * 3.14159) * 0.005; 

      // Sample Old Image (blurry)
      vec4 c1 = texture2D(uTex1, vUv);
      vec4 c1Blur = texture2D(uTex1, vUv + vec2(blurStrength, 0.0));
      vec4 oldLayer = mix(c1, c1Blur, 0.5);

      // Sample New Image (blurry)
      vec4 c2 = texture2D(uTex2, vUv);
      vec4 c2Blur = texture2D(uTex2, vUv + vec2(blurStrength, 0.0));
      vec4 newLayer = mix(c2, c2Blur, 0.5);

      // Mix based on progress
      gl_FragColor = mix(oldLayer, newLayer, uProgress);
    }
  `
};

// --- UPDATED SCENE COMPONENT ---
const StreetScene = ({ currentImage }) => {
  const materialRef = useRef();
  
  // Stable uniforms object
  const uniforms = useMemo(() => ({
    uTex1: { value: null },
    uTex2: { value: null },
    uProgress: { value: 0 }
  }), []);

  // Animation progress state (starts at 1 = finished)
  const progressRef = useRef(1); 

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    
    loader.load(`img/${currentImage}`, (newTex) => {
      newTex.minFilter = THREE.LinearFilter;
      newTex.generateMipmaps = false;

      // 1. Initial Load
      if (!uniforms.uTex1.value) {
        uniforms.uTex1.value = newTex;
        uniforms.uTex2.value = newTex;
        uniforms.uProgress.value = 1;
      } 
      // 2. Transition
      else {
        // Swap textures: Current -> Old
        uniforms.uTex1.value = uniforms.uTex2.value;
        // New Load -> Current
        uniforms.uTex2.value = newTex;
        // Reset animation
        progressRef.current = 0;
      }
    });
  }, [currentImage, uniforms]);

  // Animation Loop
  useFrame((state, delta) => {
    if (progressRef.current < 1) {
      progressRef.current += delta * 2.0; // Adjust speed here (2.0 = 0.5s duration)
      if (progressRef.current > 1) progressRef.current = 1;
      
      if (materialRef.current) {
        materialRef.current.uniforms.uProgress.value = progressRef.current;
      }
    }
  });

  return (
    <mesh rotation={[0, -Math.PI / 2, 0]}>
      <cylinderGeometry args={[10, 10, 25, 60, 1, true, -Math.PI / 2, Math.PI]} />
      <shaderMaterial
        ref={materialRef}
        side={THREE.BackSide}
        uniforms={uniforms}
        vertexShader={transitionShader.vertexShader}
        fragmentShader={transitionShader.fragmentShader}
        transparent={true}
      />
    </mesh>
  );
};

const CameraZoom = ({ targetFOV }) => {
  useFrame((state) => {
    state.camera.fov = THREE.MathUtils.lerp(state.camera.fov, targetFOV, 0.1);
    state.camera.updateProjectionMatrix();
  });
  return null;
};

const StreetViewer = () => {
  const [index, setIndex] = useState(0);
  const [targetFOV, setTargetFOV] = useState(85);
  const clickStartRef = useRef({ x: 0, y: 0 }); 
  const orbitRef = useRef(null);

  const imageSequence = useMemo(() => [
    //ADD  YOUR IMAGES HERE
  ], []);

  // --- ACTIONS ---
  const moveNext = () => {
    if (index < imageSequence.length - 1) setIndex(prev => prev + 1);
  };

  const moveBack = () => {
    if (index > 0) setIndex(prev => prev - 1);
  };

  const zoomIn = () => setTargetFOV(prev => Math.max(prev - 10, 30));
  const zoomOut = () => setTargetFOV(prev => Math.min(prev + 10, 100));

  // --- MOUSE HANDLERS ---
  const handleMouseDown = (e) => {
    clickStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = (e) => {
    const deltaX = Math.abs(e.clientX - clickStartRef.current.x);
    const deltaY = Math.abs(e.clientY - clickStartRef.current.y);

    if (deltaX > 5 || deltaY > 5) return; // Drag detected

    const screenHeight = window.innerHeight;
    if (e.clientY < screenHeight / 2) {
      moveNext();
    } else {
      moveBack();
    }
  };

  const handleDoubleClick = (e) => {
    e.stopPropagation();
    moveNext();
  };

  // --- KEYBOARD CONTROLS ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'd') moveNext();
      if (e.key === 'ArrowLeft' || e.key === 'a') moveBack();
      if (e.key === 'ArrowUp' || e.key === 'w') zoomIn();
      if (e.key === 'ArrowDown' || e.key === 's') zoomOut();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [index]); 

  return (
    <div 
      style={{ width: '100vw', height: '100vh', backgroundColor: '#000', position: 'relative' }}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onDoubleClick={handleDoubleClick}
    >
      
      <Canvas>
        <PerspectiveCamera makeDefault position={[0, 0, 0.1]} fov={85} />
        <CameraZoom targetFOV={targetFOV} />

        {/* Removed nextImage prop, transition is now internal */}
        <StreetScene currentImage={imageSequence[index]} />

        <OrbitControls 
          ref={orbitRef}
          enableZoom={true} 
          enablePan={false}
          enableRotate={true}
          rotateSpeed={-0.5}
          minPolarAngle={Math.PI / 2} 
          maxPolarAngle={Math.PI / 2} 
          enableDamping={true} 
          dampingFactor={0.1}
        />
      </Canvas>

      <div style={helperText}>
        Click Top/Bottom to Move • Double Click for Next
      </div>
    </div>
  );
};

// --- STYLES ---

const helperText = {
  position: 'absolute',
  bottom: '30px',
  left: '50%',
  transform: 'translateX(-50%)',
  color: 'rgba(255,255,255,0.5)', 
  fontSize: '0.8rem',
  fontFamily: 'sans-serif',
  pointerEvents: 'none',
  zIndex: 10
};

export default StreetViewer;