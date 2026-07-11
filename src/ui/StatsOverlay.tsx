import { useEffect, useState } from 'react';
import type { EngineStats } from '../engine/types';
import { GlyphEngine } from '../engine/GlyphEngine';

export function StatsOverlay({ engine }: { engine: GlyphEngine | null }) {
  const [stats, setStats] = useState<EngineStats | null>(null);

  useEffect(() => {
    if (!engine) return;
    
    // Poll stats every 200ms
    const interval = setInterval(() => {
      // Assuming engine.getStats() exists
      if ((engine as any).getStats) {
        setStats((engine as any).getStats());
      }
    }, 200);
    
    return () => clearInterval(interval);
  }, [engine]);

  if (!stats) return null;

  return (
    <div className="stats-overlay" style={{
      position: 'absolute',
      bottom: '24px',
      left: '24px',
      background: 'rgba(10, 10, 10, 0.85)',
      backdropFilter: 'blur(4px)',
      border: '1px solid #333',
      color: '#00ffcc',
      padding: '16px',
      borderRadius: '8px',
      fontFamily: '"SF Mono", Consolas, monospace',
      fontSize: '11px',
      pointerEvents: 'none',
      display: 'grid',
      gridTemplateColumns: '150px 100px',
      gap: '6px 12px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
      zIndex: 100
    }}>
      <div style={{ color: '#fff', fontWeight: 'bold', gridColumn: '1 / -1', marginBottom: '4px' }}>GPU DIAGNOSTICS</div>
      
      <div style={{ color: '#888' }}>Render FPS</div><div>{stats.renderFps.toFixed(1)}</div>
      <div style={{ color: '#888' }}>Frame Time</div><div>{stats.frameTime.toFixed(2)} ms</div>
      <div style={{ color: '#888' }}>Source FPS</div><div>{stats.videoFps.toFixed(1)}</div>
      
      <div style={{ color: '#fff', fontWeight: 'bold', gridColumn: '1 / -1', marginTop: '8px', marginBottom: '4px' }}>PIPELINE</div>
      <div style={{ color: '#888' }}>Render Res</div><div>{stats.renderResolution.width}x{stats.renderResolution.height}</div>
      <div style={{ color: '#888' }}>Max Instances</div><div>{stats.glyphCount.toLocaleString()}</div>
      <div style={{ color: '#888' }}>VRAM Estimate</div><div>{stats.vramUsageMB.toFixed(1)} MB</div>
      <div style={{ color: '#888' }}>Temporal Hysteresis</div><div style={{ color: '#00ff00' }}>Enabled</div>
      <div style={{ color: '#888' }}>Adaptive Density</div><div style={{ color: '#00ff00' }}>Enabled</div>
    </div>
  );
}
