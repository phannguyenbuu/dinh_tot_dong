// https://discourse.threejs.org/t/threejs-gltf-meshes-rendering-position-issue/59997/1

import * as THREE from 'three'
import { Canvas, useFrame } from '@react-three/fiber'
import { Center, Html, OrbitControls, useGLTF, useProgress } from '@react-three/drei'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'

function PagodaModel(props) {
  const glb = useGLTF(`${process.env.PUBLIC_URL}/general.glb`)
  const waterMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        time: { value: 0 },
        colorDeep: { value: new THREE.Color('#000') },
        colorShallow: { value: new THREE.Color('#49b6d6') },
        colorFoam: { value: new THREE.Color('#dff6ff') },
        colorBack: { value: new THREE.Color('#0a3f52') },
        opacity: { value: 0.9 },
        waveAmp: { value: 0.1 },
        waveFreq: { value: 0.01 },
        waveSpeed: { value: 1 },
      },
      vertexShader: `
        uniform float time;
        uniform float waveAmp;
        uniform float waveFreq;
        uniform float waveSpeed;

        varying vec3 vWorldPos;
        varying vec3 vNormal;

        void main() {
          vec3 pos = position;
          float t = time * waveSpeed;
          float wave1 = sin((pos.x + t) * waveFreq) * 0.5;
          float wave2 = cos((pos.z - t) * waveFreq * 1.3) * 0.5;
          float wave3 = sin((pos.x + pos.z + t) * waveFreq * 0.7) * 0.5;
          float height = (wave1 + wave2 + wave3) * waveAmp;
          pos.y += height;

          vec4 worldPos = modelMatrix * vec4(pos, 1.0);
          vWorldPos = worldPos.xyz;
          vNormal = normalize(mat3(modelMatrix) * normal);

          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform vec3 colorDeep;
        uniform vec3 colorShallow;
        uniform vec3 colorFoam;
        uniform vec3 colorBack;
        uniform float opacity;

        varying vec3 vWorldPos;
        varying vec3 vNormal;

        void main() {
          vec3 viewDir = normalize(cameraPosition - vWorldPos);
          float fresnel = pow(1.0 - max(dot(normalize(vNormal), viewDir), 0.0), 3.0);
          float foam = smoothstep(0.65, 0.95, fresnel);
          vec3 baseColor = mix(colorDeep, colorShallow, fresnel + 0.2);
          vec3 color = mix(baseColor, colorFoam, foam);
          if (!gl_FrontFacing) {
            color = mix(colorBack, baseColor, 0.3);
          }
          gl_FragColor = vec4(color, opacity);
        }
      `,
    })
  }, [])

  useFrame((state) => {
    if (waterMaterial?.uniforms?.time) {
      waterMaterial.uniforms.time.value = state.clock.getElapsedTime()
    }
  })

  useEffect(() => {
    if (!glb?.scene) return
    glb.scene.traverse((child) => {
      if (!child.isMesh || !child.material) return
      const materials = Array.isArray(child.material) ? child.material : [child.material]
      for (const mat of materials) {
        if (mat.reflectivity !== undefined) mat.reflectivity = 0
        if (mat.refractionRatio !== undefined) mat.refractionRatio = 0
        if (mat.transmission !== undefined) mat.transmission = 0
      }

      if (typeof child.name === 'string' && child.name.startsWith('Water')) {
        child.material = waterMaterial
      }
    })
  }, [glb, waterMaterial])

  return <primitive object={glb.scene} {...props} />
}

function Loader() {
  const { active } = useProgress()
  const [value, setValue] = useState(0)
  const rafRef = useRef(0)
  const startRef = useRef(0)

  useEffect(() => {
    if (!active) {
      setValue(100)
      return () => {}
    }

    startRef.current = performance.now()
    const duration = 60000
    const tick = (t) => {
      const elapsed = t - startRef.current
      const pct = Math.min(95, (elapsed / duration) * 95)
      setValue(pct)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [active])

  if (!active && value >= 100) return null

  return (
    <Html fullscreen>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(242,239,233,0.9)',
          transition: 'opacity 200ms ease',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            width: 320,
            height: 8,
            borderRadius: 999,
            background: 'rgba(0,0,0,0.12)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${Math.min(100, value)}%`,
              height: '100%',
              background: '#2b6f85',
              transition: active ? 'width 80ms linear' : 'width 120ms ease',
            }}
          />
        </div>
      </div>
    </Html>
  )
}

export default function App() {
  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      gl={{ antialias: false, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1 }}
      camera={{ position: [8, 6, 14], fov: 35 }}
    >
      <color attach="background" args={['#f2efe9']} />
      <hemisphereLight intensity={1} color="#ffffff" groundColor="#d9d2c7" />
      <directionalLight position={[10, 12, 6]} intensity={1.1} castShadow />
      <directionalLight position={[-8, 6, -4]} intensity={0.6} />
      <Suspense fallback={null}>
        <Center position={[0, 1, 0]}>
          <PagodaModel scale={0.1} position={[0, 1, 0]} />
        </Center>
      </Suspense>
      <Loader />
      <OrbitControls enablePan enableDamping minPolarAngle={0} maxPolarAngle={Math.PI / 2.1} />
    </Canvas>
  )
}
