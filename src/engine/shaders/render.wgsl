struct Uniforms {
  sourceSize: vec2<f32>,
  gridSize: vec2<f32>,
  cellSize: f32,
  time: f32,
  atlasColumns: f32,
  atlasRows: f32,
  colorMode: u32,
  renderMode: u32,
  quality: u32,
  brightness: f32,
  contrast: f32,
  saturation: f32,
  dilation: f32,
  ditherStrength: f32,
}
@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct CellState {
  color: vec4<f32>,
  state: vec4<f32>, // x: charIdx, y: lum
}
@group(0) @binding(1) var<storage, read> cellData: array<CellState>;
@group(0) @binding(2) var atlasSampler: sampler;
@group(0) @binding(3) var atlasTexture: texture_2d<f32>;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
  @location(1) color: vec3<f32>,
  @location(2) lum: f32,
}

@vertex
fn vs_main(
  @builtin(vertex_index) vi: u32,
  @builtin(instance_index) ii: u32
) -> VertexOutput {
  var quad = array<vec2<f32>, 6>(
    vec2(0.0, 0.0), vec2(1.0, 0.0), vec2(0.0, 1.0),
    vec2(1.0, 1.0), vec2(0.0, 1.0), vec2(1.0, 0.0),
  );
  let q = quad[vi];
  
  let gx = ii % u32(uniforms.gridSize.x);
  let gy = ii / u32(uniforms.gridSize.x);
  
  let cellW = 2.0 / uniforms.gridSize.x;
  let cellH = 2.0 / uniforms.gridSize.y;
  
  // Expand the quad size by 40% so characters physically overlap their neighbors,
  // filling in the black empty spaces without background color bleeding.
  let overlap = 1.4;
  
  let cx = -1.0 + f32(gx) * cellW + cellW * 0.5;
  let cy =  1.0 - f32(gy) * cellH - cellH * 0.5;
  
  let x = cx + (q.x - 0.5) * (cellW * overlap);
  let y = cy - (q.y - 0.5) * (cellH * overlap);
  
  let data = cellData[ii];
  let charIdx = u32(data.state.x);
  let lum = data.state.y;
  let cols = max(1u, u32(uniforms.atlasColumns));
  
  let atlasX = f32(charIdx % cols);
  let atlasY = f32(charIdx / cols);
  let uvScale = vec2<f32>(1.0 / uniforms.atlasColumns, 1.0 / uniforms.atlasRows);
  let uv = q * uvScale + vec2<f32>(atlasX * uvScale.x, atlasY * uvScale.y);
  
  var out: VertexOutput;
  out.position = vec4<f32>(x, y, 0.0, 1.0);
  out.uv = uv;
  out.color = data.color.rgb;
  out.lum = lum;
  return out;
}

fn applyColorCorrection(color: vec3<f32>) -> vec3<f32> {
  var c = color;
  // Brightness
  c = c * uniforms.brightness;
  // Contrast
  c = (c - 0.5) * uniforms.contrast + 0.5;
  // Saturation
  let lum = dot(c, vec3<f32>(0.2126, 0.7152, 0.0722));
  c = mix(vec3<f32>(lum), c, uniforms.saturation);
  return clamp(c, vec3<f32>(0.0), vec3<f32>(1.0));
}

// 4x4 Bayer Dithering Matrix for smooth inter-character pixel blending
fn bayer4x4(pos: vec2<f32>) -> f32 {
  let x = u32(pos.x) % 4u;
  let y = u32(pos.y) % 4u;
  let index = y * 4u + x;
  var dither = array<f32, 16>(
     0.0 / 16.0,  8.0 / 16.0,  2.0 / 16.0, 10.0 / 16.0,
    12.0 / 16.0,  4.0 / 16.0, 14.0 / 16.0,  6.0 / 16.0,
     3.0 / 16.0, 11.0 / 16.0,  1.0 / 16.0,  9.0 / 16.0,
    15.0 / 16.0,  7.0 / 16.0, 13.0 / 16.0,  5.0 / 16.0
  );
  return dither[index];
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
  let glyph = textureSample(atlasTexture, atlasSampler, in.uv);
  let sdfVal = glyph.r;
  
  // Signed Distance Field (SDF) distance threshold shift: tau = 0.5 - dilation
  let dilation = select(0.15, uniforms.dilation, uniforms.dilation > 0.0);
  let baseThreshold = 0.5 - dilation;
  
  // Apply 4x4 Bayer Dithering matrix offset
  let ditherStrength = select(0.08, uniforms.ditherStrength, uniforms.ditherStrength > 0.0);
  let dither = (bayer4x4(in.position.xy) - 0.5) * ditherStrength;
  let tau = baseThreshold + dither;
  
  // Calculate character glyph stroke alpha with smooth transition edge
  let edgeSmoothing = 0.08;
  let alpha = smoothstep(tau - edgeSmoothing, tau + edgeSmoothing, sdfVal);
  
  // Non-inked fragments are completely transparent (alpha = 0.0, no solid background quads)
  if (alpha <= 0.001) {
    discard;
  }
  
  var finalColor = in.color;
  
  // Color Modes
  if (uniforms.colorMode == 0u) { // True Color
    finalColor = in.color;
  } else if (uniforms.colorMode == 1u) { // Matrix
    finalColor = vec3<f32>(0.0, in.lum, 0.2 * in.lum);
  } else if (uniforms.colorMode == 2u) { // Amber CRT
    finalColor = vec3<f32>(1.0 * in.lum, 0.7 * in.lum, 0.0);
  } else if (uniforms.colorMode == 3u) { // Monochrome
    let m = dot(in.color, vec3<f32>(0.2126, 0.7152, 0.0722));
    finalColor = vec3<f32>(m, m, m);
  }
  
  finalColor = applyColorCorrection(finalColor);
  
  // Pure alpha — the ONLY thing carrying color is the letter ink itself
  finalColor = finalColor * alpha;
  
  // Convert from Linear back to sRGB for the canvas
  finalColor = pow(finalColor, vec3<f32>(1.0 / 2.2));
  
  return vec4<f32>(finalColor, alpha);
}
