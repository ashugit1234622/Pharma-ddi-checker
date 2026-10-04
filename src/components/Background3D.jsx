import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Float, Sphere, Box } from '@react-three/drei';
import * as THREE from 'three';

const ParticleCross = ({ position, color, scale }) => {
  const mesh = useRef();
  useFrame((state) => {
    mesh.current.rotation.x = state.clock.getElapsedTime() * 0.1;
    mesh.current.rotation.y = state.clock.getElapsedTime() * 0.15;
  });

  return (
    <Float speed={1.5} rotationIntensity={0.5} floatIntensity={1} position={position}>
      <group ref={mesh} scale={scale}>
        <Box args={[1, 0.3, 0.3]}>
          <meshStandardMaterial color={color} roughness={0.1} metalness={0.8} />
        </Box>
        <Box args={[0.3, 1, 0.3]}>
          <meshStandardMaterial color={color} roughness={0.1} metalness={0.8} />
        </Box>
      </group>
    </Float>
  );
};

const Pill = ({ position, color1, color2, scale }) => {
  const mesh = useRef();
  useFrame((state) => {
    mesh.current.rotation.x = state.clock.getElapsedTime() * 0.2;
    mesh.current.rotation.z = state.clock.getElapsedTime() * 0.1;
  });

  return (
    <Float speed={1} rotationIntensity={1} floatIntensity={1} position={position}>
      <group ref={mesh} scale={scale}>
        <mesh position={[0, 0.5, 0]}>
          <cylinderGeometry args={[0.3, 0.3, 1, 16]} />
          <meshStandardMaterial color={color1} roughness={0.2} metalness={0.1} />
        </mesh>
        <mesh position={[0, 1, 0]}>
          <sphereGeometry args={[0.3, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={color1} roughness={0.2} metalness={0.1} />
        </mesh>
        <mesh position={[0, -0.5, 0]}>
          <cylinderGeometry args={[0.3, 0.3, 1, 16]} />
          <meshStandardMaterial color={color2} roughness={0.2} metalness={0.1} />
        </mesh>
        <mesh position={[0, -1, 0]} rotation={[Math.PI, 0, 0]}>
          <sphereGeometry args={[0.3, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={color2} roughness={0.2} metalness={0.1} />
        </mesh>
      </group>
    </Float>
  );
};

const DNAHelix = ({ position }) => {
  const group = useRef();
  useFrame((state) => {
    group.current.rotation.y = state.clock.getElapsedTime() * 0.15;
    group.current.position.y = Math.sin(state.clock.getElapsedTime() * 0.5) * 0.5;
  });

  const numPairs = 10;
  const pairs = useMemo(() => {
    return Array.from({ length: numPairs }).map((_, i) => {
      const y = (i - numPairs / 2) * 0.6;
      const angle = i * 0.5;
      const x1 = Math.cos(angle) * 1.5;
      const z1 = Math.sin(angle) * 1.5;
      const x2 = Math.cos(angle + Math.PI) * 1.5;
      const z2 = Math.sin(angle + Math.PI) * 1.5;
      return { y, x1, z1, x2, z2, angle };
    });
  }, []);

  return (
    <group ref={group} position={position} scale={[1.2, 1.2, 1.2]}>
      {pairs.map((p, i) => (
        <group key={i}>
          <Sphere args={[0.25, 12, 12]} position={[p.x1, p.y, p.z1]}>
            <meshStandardMaterial color="#4F46E5" emissive="#4F46E5" emissiveIntensity={0.5} roughness={0.2} metalness={0.8} />
          </Sphere>
          <Sphere args={[0.25, 12, 12]} position={[p.x2, p.y, p.z2]}>
            <meshStandardMaterial color="#10B981" emissive="#10B981" emissiveIntensity={0.5} roughness={0.2} metalness={0.8} />
          </Sphere>
          <mesh position={[0, p.y, 0]} rotation={[0, -p.angle, Math.PI / 2]}>
            <cylinderGeometry args={[0.05, 0.05, 3, 6]} />
            <meshStandardMaterial color="#94A3B8" transparent opacity={0.5} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

// Optimized Floating Bubbles using InstancedMesh
const FloatingBubbles = () => {
  const meshRef = useRef();
  const count = 40;

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const particles = useMemo(() => {
    const temp = [];
    for (let i = 0; i < count; i++) {
      const t = Math.random() * 100;
      const factor = 0.5 + Math.random() * 1.5;
      const speed = 0.01 + Math.random() / 200;
      const xFactor = -20 + Math.random() * 40;
      const yFactor = -20 + Math.random() * 40;
      const zFactor = -15 + Math.random() * 10;
      temp.push({ t, factor, speed, xFactor, yFactor, zFactor, mx: 0, my: 0 });
    }
    return temp;
  }, []);

  useFrame((state) => {
    particles.forEach((particle, i) => {
      let { t, factor, speed, xFactor, yFactor, zFactor } = particle;
      t = particle.t += speed / 4; // Much slower motion
      const a = Math.cos(t) + Math.sin(t * 1) / 10;
      const b = Math.sin(t) + Math.cos(t * 2) / 10;
      const s = Math.cos(t);

      dummy.position.set(
        (particle.mx / 10) * a + xFactor + Math.cos((t / 10) * factor) + (Math.sin(t * 1) * factor) / 10,
        (particle.my / 10) * b + yFactor + Math.sin((t / 10) * factor) + (Math.cos(t * 2) * factor) / 10,
        (particle.my / 10) * b + zFactor + Math.cos((t / 10) * factor) + (Math.sin(t * 3) * factor) / 10
      );
      dummy.scale.set(s, s, s);
      dummy.rotation.set(s * 5, s * 5, s * 5);
      dummy.updateMatrix();
      
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[null, null, count]}>
      <sphereGeometry args={[0.2, 12, 12]} />
      <meshStandardMaterial 
        color="#10B981"
        transparent 
        opacity={0.2} 
        roughness={0} 
        metalness={1}
      />
    </instancedMesh>
  );
};

export default function Background3D() {
  const group = useRef();
  
  useFrame(() => {
    if (group.current) {
      // Calculate scroll progress directly in the render loop (fixes stutter)
      const scrollPx = window.scrollY || document.documentElement.scrollTop;
      const winHeightPx = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const progress = winHeightPx > 0 ? scrollPx / winHeightPx : 0;

      // Extremely smooth and slower scroll interpolation
      group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, progress * Math.PI, 0.05);
      group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, progress * 5, 0.05);
    }
  });

  return (
    <group ref={group}>
      <ambientLight intensity={0.2} />
      <directionalLight position={[10, 10, 5]} intensity={1.5} color="#ffffff" />
      <pointLight position={[-10, -10, -5]} intensity={1} color="#4F46E5" />
      <pointLight position={[0, 10, -10]} intensity={1} color="#10B981" />
      
      <DNAHelix position={[6, 0, -5]} />
      <DNAHelix position={[-8, -10, -8]} />
      
      <ParticleCross position={[-5, 2, -3]} color="#ef4444" scale={[0.8, 0.8, 0.8]} />
      <ParticleCross position={[7, -5, -4]} color="#3b82f6" scale={[1.2, 1.2, 1.2]} />
      <ParticleCross position={[-3, -15, -2]} color="#10B981" scale={[1, 1, 1]} />
      
      <Pill position={[4, -3, -2]} color1="#ffffff" color2="#4F46E5" scale={[0.8, 0.8, 0.8]} />
      <Pill position={[-6, -6, -6]} color1="#ffffff" color2="#f59e0b" scale={[1.2, 1.2, 1.2]} />
      <Pill position={[5, -12, -4]} color1="#ffffff" color2="#ef4444" scale={[0.9, 0.9, 0.9]} />
      <Pill position={[-4, -20, -5]} color1="#ffffff" color2="#10B981" scale={[1.5, 1.5, 1.5]} />

      <FloatingBubbles />
    </group>
  );
}
