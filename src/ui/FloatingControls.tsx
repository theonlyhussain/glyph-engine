import React from 'react';
import { GlyphEngine } from '../engine/GlyphEngine';
import { GlyphAtlas } from '../engine/GlyphAtlas';

interface FloatingControlsProps {
  engine: GlyphEngine;
}

export function FloatingControls({ engine }: FloatingControlsProps) {
  const [isPlaying, setIsPlaying] = React.useState(engine.isPlaying);
  
  // Use generic settings state to force re-render when we change things
  const [density, setDensity] = React.useState(8);
  const [colorMode, setColorMode] = React.useState(0);
  const [renderMode, setRenderMode] = React.useState(0);

  const togglePlay = () => {
    if (isPlaying) {
      engine.pause();
      setIsPlaying(false);
    } else {
      engine.play();
      setIsPlaying(true);
    }
  };

  const handleDensityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setDensity(val);
    engine.updateSettings({ density: val });
  };

  const handleColorModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = parseInt(e.target.value, 10);
    setColorMode(val);
    engine.updateSettings({ colorMode: val });
  };

  const handleRenderModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = parseInt(e.target.value, 10);
    setRenderMode(val);
    engine.updateSettings({ renderMode: val });
    
    // Update Atlas for Unicode Blocks
    if (val === 2) {
      engine.setAtlas(new GlyphAtlas(" ░▒▓█"));
    } else {
      engine.setAtlas(new GlyphAtlas());
    }
  };

  return (
    <div style={{
      position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)',
      display: 'flex', gap: 16, alignItems: 'center',
      background: '#0f172aee', padding: '16px 24px', borderRadius: 16,
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
      border: '1px solid #1e293b',
      fontFamily: 'system-ui', color: '#fff', backdropFilter: 'blur(12px)'
    }}>
      
      <button 
        onClick={togglePlay}
        style={{
          background: '#3b82f6', color: '#fff', border: 'none', 
          width: 48, height: 48, borderRadius: 24, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}
      >
        {isPlaying ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zm8 0h4v16h-4z"/></svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        )}
      </button>

      <div style={{ width: 1, height: 32, background: '#334155', margin: '0 8px' }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Render Mode</label>
        <select 
          value={renderMode} onChange={handleRenderModeChange}
          style={{ background: '#1e293b', color: '#fff', border: '1px solid #334155', padding: '6px 12px', borderRadius: 6, outline: 'none' }}
        >
          <option value={0}>Brightness ASCII</option>
          <option value={1}>Edge Detection</option>
          <option value={2}>Unicode Blocks</option>
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Color Mode</label>
        <select 
          value={colorMode} onChange={handleColorModeChange}
          style={{ background: '#1e293b', color: '#fff', border: '1px solid #334155', padding: '6px 12px', borderRadius: 6, outline: 'none' }}
        >
          <option value={0}>Original</option>
          <option value={1}>White</option>
          <option value={2}>Matrix</option>
          <option value={3}>Amber</option>
          <option value={4}>Terminal Green</option>
          <option value={5}>Monochrome</option>
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 140 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <label style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Density</label>
          <span style={{ fontSize: 11, color: '#60a5fa' }}>{density}px</span>
        </div>
        <input 
          type="range" min="4" max="32" step="1" 
          value={density} onChange={handleDensityChange} 
          style={{ width: '100%' }}
        />
      </div>

    </div>
  );
}
