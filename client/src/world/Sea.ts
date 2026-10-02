import { BEACH_HALF } from '@restaurant/shared';
import { BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, MeshLambertMaterial, PlaneGeometry } from 'three';

/** The sea's surface height: a hand's breadth below the beach. */
export const SEA_LEVEL = -0.1;

/** The sea's grid: cells this big out to NEAR, then one frame of quads out to OUTER. */
const CELL = 30;
const NEAR = 1500;
const OUTER = 3000;

const clock = { value: 0 };

/**
 * THE SEA: a bright, toy-blue ocean with the pale rippling cell lines of
 * Roblox water drifting across it, drawn in the shader from world position
 * and one clock. Opaque enough to read as deep water, with a sandy shelf and
 * a darker seabed under it.
 *
 * It is a GRID with the land cut out - every cell well inside the coastline or
 * the Forgotten Isle is skipped - so it never lies under the island's own
 * ground or its lake, only under the beach's outer edge.
 */
export class Sea {
  readonly root = new Group();
  private readonly material: MeshBasicMaterial;
  private readonly bedMaterial: MeshLambertMaterial;

  constructor() {
    this.material = new MeshBasicMaterial({ color: 0x3fb2ee, transparent: true, opacity: 0.9, depthWrite: false });
    this.material.onBeforeCompile = (shader) => {
      shader.uniforms.uSeaTime = clock;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vSeaPos;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSeaPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
varying vec3 vSeaPos;
uniform float uSeaTime;
vec2 seaHash(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}
float seaCells(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float d1 = 8.0;
  float d2 = 8.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 o = seaHash(i + g);
      o = 0.5 + 0.42 * sin(uSeaTime * 0.6 + 6.2831 * o);
      float d = length(g + o - f);
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
    }
  }
  return d2 - d1;
}`,
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
{
  vec2 p = vSeaPos.xz * 0.075 + vec2(uSeaTime * 0.03, uSeaTime * 0.018);
  float edge = seaCells(p);
  float line = 1.0 - smoothstep(0.03, 0.12, edge);
  float far = smoothstep(260.0, 700.0, length(vSeaPos.xz - cameraPosition.xz));
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.97, 1.0), line * 0.55 * (1.0 - far));
  diffuseColor.rgb *= 0.96 + 0.06 * sin(vSeaPos.x * 0.05 + vSeaPos.z * 0.04 + uSeaTime);
}`,
        );
    };
    this.material.customProgramCacheKey = () => 'restaurant-sea';

    const surface = new Mesh(seaGeometry(SEA_LEVEL), this.material);
    surface.renderOrder = 1;
    surface.frustumCulled = false;
    this.root.add(surface);

    // The seabed, well below: what shows through the deep water.
    this.bedMaterial = new MeshLambertMaterial({ color: 0x2a86b8 });
    const bed = new Mesh(new PlaneGeometry(OUTER * 2, OUTER * 2), this.bedMaterial);
    bed.rotation.x = -Math.PI / 2;
    bed.position.y = -3.4;
    bed.frustumCulled = false;
    this.root.add(bed);
  }

  update(delta: number): void {
    clock.value = (clock.value + delta) % 10_000;
  }

  dispose(): void {
    this.material.dispose();
    this.bedMaterial.dispose();
    this.root.removeFromParent();
  }
}

/** True when a sea cell lies wholly under land (so it is skipped). */
const underLand = (x0: number, z0: number, x1: number, z1: number): boolean => {
  const corners = [
    [x0, z0],
    [x1, z0],
    [x0, z1],
    [x1, z1],
    [(x0 + x1) / 2, (z0 + z1) / 2],
  ];
  const inner = BEACH_HALF - 8;
  return corners.every(([x, z]) => Math.abs(x!) < inner && Math.abs(z!) < inner);
};

/** The sea: a grid of cells round the land, and a frame of four big quads beyond it. */
const seaGeometry = (y: number): BufferGeometry => {
  const positions: number[] = [];
  const quad = (x0: number, z0: number, x1: number, z1: number): void => {
    positions.push(x0, y, z0, x0, y, z1, x1, y, z1, x0, y, z0, x1, y, z1, x1, y, z0);
  };
  for (let x = -NEAR; x < NEAR; x += CELL) {
    // Runs of open cells in a column merge into one quad.
    let start: number | null = null;
    for (let z = -NEAR; z <= NEAR; z += CELL) {
      const open = z < NEAR && !underLand(x, z, x + CELL, z + CELL);
      if (open && start === null) start = z;
      if (!open && start !== null) {
        quad(x, start, x + CELL, z);
        start = null;
      }
    }
  }
  quad(-OUTER, -OUTER, OUTER, -NEAR);
  quad(-OUTER, NEAR, OUTER, OUTER);
  quad(-OUTER, -NEAR, -NEAR, NEAR);
  quad(NEAR, -NEAR, OUTER, NEAR);
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  const normals = new Float32Array(positions.length);
  for (let i = 1; i < normals.length; i += 3) normals[i] = 1;
  g.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  return g;
};
