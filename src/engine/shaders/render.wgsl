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
  padding1: f32,
  padding2: f32,
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
  
  let x = -1.0 + f32(gx) * cellW + q.x * cellW;
  let y = 1.0 - f32(gy) * cellH - q.y * cellH;
  
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

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
  let glyph = textureSample(atlasTexture, atlasSampler, in.uv);
  let alpha = glyph.r;
  
  var finalColor = in.color;
  
  // Color Modes
  if (uniforms.colorMode == 1u) { // White
    finalColor = vec3<f32>(in.lum, in.lum, in.lum);
  } else if (uniforms.colorMode == 2u) { // Matrix
    finalColor = vec3<f32>(0.0, in.lum, 0.2 * in.lum);
  } else if (uniforms.colorMode == 3u) { // Amber
    finalColor = vec3<f32>(1.0 * in.lum, 0.7 * in.lum, 0.0);
  } else if (uniforms.colorMode == 4u) { // Terminal Green
    finalColor = vec3<f32>(0.2 * in.lum, 1.0 * in.lum, 0.2 * in.lum);
  } else if (uniforms.colorMode == 5u) { // Monochrome
    let m = dot(in.color, vec3<f32>(0.2126, 0.7152, 0.0722));
    finalColor = vec3<f32>(m, m, m);
  }
  
  finalColor = applyColorCorrection(finalColor);
  
  finalColor = finalColor * alpha;
  return vec4<f32>(finalColor, alpha);
}
