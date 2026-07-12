@group(0) @binding(0) var videoSampler: sampler;
@group(0) @binding(1) var videoTexture: texture_external;

struct CellState {
  color: vec4<f32>,
  state: vec4<f32>, // x: charIdx, y: lum, z: variance, w: empty
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
  quality: u32,
  brightness: f32,
  contrast: f32,
  saturation: f32,
  padding1: f32,
  padding2: f32,
}
@group(0) @binding(3) var<uniform> uniforms: Uniforms;

fn sampleColor(uv: vec2<f32>) -> vec3<f32> {
  return textureSampleBaseClampToEdge(videoTexture, videoSampler, uv).rgb;
}

fn getLuminance(color: vec3<f32>) -> f32 {
  return dot(color, vec3<f32>(0.2126, 0.7152, 0.0722));
}

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let gx = gid.x;
  let gy = gid.y;
  if (f32(gx) >= uniforms.gridSize.x || f32(gy) >= uniforms.gridSize.y) { return; }
  
  let idx = gy * u32(uniforms.gridSize.x) + gx;
  
  let cellW = uniforms.cellSize / uniforms.sourceSize.x;
  let cellH = uniforms.cellSize / uniforms.sourceSize.y;
  let uvCenter = vec2<f32>(
    (f32(gx) + 0.5) * cellW,
    (f32(gy) + 0.5) * cellH
  );
  
  var avgColor = vec3<f32>(0.0);
  var variance = 0.0;
  
  if (uniforms.quality == 0u) {
    // 1-Tap (Performance)
    avgColor = sampleColor(uvCenter);
  } else if (uniforms.quality == 1u) {
    // 4-Tap (Balanced)
    let oX = cellW * 0.25;
    let oY = cellH * 0.25;
    let c1 = sampleColor(uvCenter + vec2<f32>(-oX, -oY));
    let c2 = sampleColor(uvCenter + vec2<f32>( oX, -oY));
    let c3 = sampleColor(uvCenter + vec2<f32>(-oX,  oY));
    let c4 = sampleColor(uvCenter + vec2<f32>( oX,  oY));
    avgColor = (c1 + c2 + c3 + c4) * 0.25;
    
    // Variance proxy
    let l1 = getLuminance(c1); let l2 = getLuminance(c2);
    let l3 = getLuminance(c3); let l4 = getLuminance(c4);
    let avgL = (l1 + l2 + l3 + l4) * 0.25;
    variance = abs(l1 - avgL) + abs(l2 - avgL) + abs(l3 - avgL) + abs(l4 - avgL);
  } else {
    // 9-Tap (Cinema)
    let oX = cellW * 0.33;
    let oY = cellH * 0.33;
    var sum = vec3<f32>(0.0);
    var lumSum = 0.0;
    var lums = array<f32, 9>();
    var i = 0;
    for(var y = -1; y <= 1; y++) {
      for(var x = -1; x <= 1; x++) {
        let c = sampleColor(uvCenter + vec2<f32>(f32(x) * oX, f32(y) * oY));
        sum += c;
        let l = getLuminance(c);
        lums[i] = l;
        lumSum += l;
        i++;
      }
    }
    avgColor = sum / 9.0;
    let avgL = lumSum / 9.0;
    for(var j = 0; j < 9; j++) {
      variance += abs(lums[j] - avgL);
    }
    variance = variance / 9.0;
  }
  
  var finalLum = getLuminance(avgColor);
  
  if (uniforms.renderMode == 1u) {
    // Basic Edge Detection (Sobel-ish)
    let texel = vec2<f32>(1.0 / uniforms.sourceSize.x, 1.0 / uniforms.sourceSize.y);
    let l = getLuminance(sampleColor(uvCenter + vec2<f32>(-texel.x, 0.0)));
    let r = getLuminance(sampleColor(uvCenter + vec2<f32>(texel.x, 0.0)));
    let u = getLuminance(sampleColor(uvCenter + vec2<f32>(0.0, -texel.y)));
    let d = getLuminance(sampleColor(uvCenter + vec2<f32>(0.0, texel.y)));
    
    let dx = r - l;
    let dy = d - u;
    finalLum = sqrt(dx * dx + dy * dy) * 2.0; 
    finalLum = clamp(finalLum, 0.0, 1.0);
  }
  
  let totalGlyphs = uniforms.atlasColumns * uniforms.atlasRows;
  
  // Biased char index based on variance (higher variance skips simple dots)
  // Just a simple heuristic for better glyph selection as requested
  var charIndex = floor(finalLum * (totalGlyphs - 1.0));
  if (variance > 0.1 && charIndex < totalGlyphs * 0.3) {
    charIndex = min(charIndex + floor(totalGlyphs * 0.2), totalGlyphs - 1.0);
  }
  
  cellData[idx] = CellState(
    vec4<f32>(avgColor, 1.0),
    vec4<f32>(charIndex, finalLum, variance, 0.0)
  );
}
