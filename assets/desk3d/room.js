// Keep the defocused office behind the desk in world space. The photo has
// enough overscan for the angled shots, with its window at the left of the set.
export function createOfficeBackdrop(THREE, daylight, night) {
  const uniforms = {
    daylight: { value: daylight },
    night: { value: night },
    nightMix: { value: 0 },
    dusk: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    toneMapped: false,
    vertexShader: `
      varying vec2 officeUv;

      void main() {
        officeUv = position.xy / vec2(338.0, 166.0) + vec2(0.29, 0.66);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D daylight;
      uniform sampler2D night;
      uniform float nightMix;
      uniform float dusk;
      varying vec2 officeUv;

      void main() {
        vec2 sampleUv = clamp(officeUv, 0.0, 1.0);
        vec3 dayColor = texture2D(daylight, sampleUv).rgb;
        dayColor *= mix(vec3(1.0), vec3(1.12, 0.79, 0.63), dusk);
        vec3 nightColor = texture2D(night, sampleUv).rgb;
        vec3 color = mix(dayColor, nightColor, nightMix);
        float edge = smoothstep(-0.14, 0.0, officeUv.x) *
          (1.0 - smoothstep(1.0, 1.15, officeUv.x));
        color = mix(color * 0.58, color, edge);
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(960, 570), material);
  backdrop.position.z = -76;
  return {
    backdrop,
    setLight(nightMix, dusk) {
      uniforms.nightMix.value = nightMix;
      uniforms.dusk.value = dusk;
    },
  };
}
