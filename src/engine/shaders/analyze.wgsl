@group(0) @binding(0) var videoSampler: sampler;
@group(0) @binding(1) var videoTexture: texture_external;

struct CellState {
  color: vec4<f32>,
  state: vec4<f32>,
}
@group(0) @binding(2) var<storage, read_write> cellData: array<CellState>;

struct Uniforms {
  sourceSize: vec2<f32>,
  gridSize: vec2<f32>,
  cellSize: f32,
  time: f32,
  atlasColumns: f32,
  atlasRows: f32,
  colorMode: u32,
  renderMode: u32,
  padding2: vec2<f32>,
}
@group(0) @binding(3) var<uniform> uniforms: Uniforms;

fn sampleColor(uv: vec2<f32>) -> vec3<f32> {
  return textureSampleBaseClampToEdge(videoTexture, videoSampler, uv).rgb;
}

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let gx = gid.x;
  let gy = gid.y;
  if (f32(gx) >= uniforms.gridSize.x || f32(gy) >= uniforms.gridSize.y) { return; }
  
  let idx = gy * u32(uniforms.gridSize.x) + gx;
  
  let uvX = (f32(gx) + 0.5) * uniforms.cellSize / uniforms.sourceSize.x;
  let uvY = (f32(gy) + 0.5) * uniforms.cellSize / uniforms.sourceSize.y;
  let uv = vec2<f32>(uvX, uvY);
  
  let color = sampleColor(uv);
  let lum = dot(color, vec3<f32>(0.2126, 0.7152, 0.0722));
  var finalLum = lum;
  
  if (uniforms.renderMode == 1u) {
    // Basic Edge Detection (Sobel-ish)
    let texel = vec2<f32>(1.0 / uniforms.sourceSize.x, 1.0 / uniforms.sourceSize.y);
    let l = dot(sampleColor(uv + vec2<f32>(-texel.x, 0.0)), vec3<f32>(0.2126, 0.7152, 0.0722));
    let r = dot(sampleColor(uv + vec2<f32>(texel.x, 0.0)), vec3<f32>(0.2126, 0.7152, 0.0722));
    let u = dot(sampleColor(uv + vec2<f32>(0.0, -texel.y)), vec3<f32>(0.2126, 0.7152, 0.0722));
    let d = dot(sampleColor(uv + vec2<f32>(0.0, texel.y)), vec3<f32>(0.2126, 0.7152, 0.0722));
    
    let dx = r - l;
    let dy = d - u;
    finalLum = sqrt(dx * dx + dy * dy) * 2.0; // Boost edge visibility
    finalLum = clamp(finalLum, 0.0, 1.0);
  }
  
  let totalGlyphs = uniforms.atlasColumns * uniforms.atlasRows;
  let charIndex = floor(finalLum * (totalGlyphs - 1.0));
  
  cellData[idx] = CellState(
    vec4<f32>(color, 1.0),
    vec4<f32>(charIndex, finalLum, 0.0, 0.0)
  );
}
