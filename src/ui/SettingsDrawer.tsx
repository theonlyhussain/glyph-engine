import React, { useState, useEffect } from 'react';
import { GlyphEngine } from '../engine/GlyphEngine';
import { GlyphAtlas } from '../engine/GlyphAtlas';

interface SettingsDrawerProps {
  engine: GlyphEngine;
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsDrawer({ engine, isOpen, onClose }: SettingsDrawerProps) {
  const [density, setDensity] = useState(2);
  const [userSetDensity, setUserSetDensity] = useState(false);
  const [renderMode, setRenderMode] = useState(0);
  const [colorMode, setColorMode] = useState(0);
  const [quality, setQuality] = useState(1);
  const [brightness, setBrightness] = useState(1.0);
  const [contrast, setContrast] = useState(1.0);
  const [saturation, setSaturation] = useState(1.0);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('glyphEngineSettings');
      if (saved) {
        const s = JSON.parse(saved);
        if (s.density) setDensity(s.density);
        if (s.renderMode !== undefined) {
          setRenderMode(s.renderMode);
          if (s.renderMode === 2) engine.setAtlas(new GlyphAtlas(" ░▒▓█"));
        }
        if (s.colorMode !== undefined) setColorMode(s.colorMode);
        if (s.quality !== undefined) setQuality(s.quality);
        if (s.brightness !== undefined) setBrightness(s.brightness);
        if (s.contrast !== undefined) setContrast(s.contrast);
        if (s.saturation !== undefined) setSaturation(s.saturation);
        if (s.userSetDensity !== undefined) setUserSetDensity(s.userSetDensity);
        
        engine.updateSettings(s);
      }
    } catch (err) { console.error('Failed to parse settings'); }
  }, [engine]);

  // Sync UI sliders with auto-calibration results
  useEffect(() => {
    let raf: number;
    let lastCal: any = null;
    const checkCalibration = () => {
      if (engine.lastCalibration && engine.lastCalibration !== lastCal) {
        lastCal = engine.lastCalibration;
        const cal = engine.lastCalibration;
        setDensity(cal.density);
        setBrightness(cal.brightness);
        setContrast(cal.contrast);
        setSaturation(cal.saturation);
      }
      raf = requestAnimationFrame(checkCalibration);
    };
    raf = requestAnimationFrame(checkCalibration);
    return () => cancelAnimationFrame(raf);
  }, [engine]);

  const updateEngine = (updates: any) => {
    engine.updateSettings(updates);
    
    // Save to localStorage
    try {
      const current = { density, renderMode, colorMode, quality, brightness, contrast, saturation, userSetDensity, ...updates };
      localStorage.setItem('glyphEngineSettings', JSON.stringify(current));
    } catch(err) {}
  };

  const handleRenderModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = parseInt(e.target.value, 10);
    setRenderMode(val);
    updateEngine({ renderMode: val });
    
    if (val === 2) {
      engine.setAtlas(new GlyphAtlas(" ░▒▓█"));
    } else {
      engine.setAtlas(new GlyphAtlas());
    }
  };

  return (
    <div style={{
      position: 'absolute', top: 0, right: 0, bottom: 0, width: 320,
      background: '#0f172ae6', backdropFilter: 'blur(16px)',
      borderLeft: '1px solid #1e293b', padding: '24px',
      transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
      transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      fontFamily: 'system-ui, -apple-system, sans-serif', color: '#f1f5f9',
      display: 'flex', flexDirection: 'column', gap: 24, zIndex: 50,
      boxShadow: isOpen ? '-8px 0 32px rgba(0,0,0,0.5)' : 'none'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Settings</h2>
        <button 
          onClick={onClose}
          style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        </button>
      </div>

      <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 24, paddingRight: 8 }}>
        
        {/* Render Mode */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>Render Mode</label>
          <select value={renderMode} onChange={handleRenderModeChange} style={selectStyle}>
            <option value={0}>Brightness ASCII</option>
            <option value={1}>Edge Detection</option>
            <option value={2}>Unicode Blocks</option>
          </select>
        </div>

        {/* Color Mode */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>Color Mode</label>
          <select value={colorMode} onChange={e => {
            const v = parseInt(e.target.value, 10);
            setColorMode(v); 
            updateEngine({ colorMode: v });
          }} style={selectStyle}>
            <option value={0}>True Color</option>
            <option value={1}>Matrix</option>
            <option value={2}>Amber CRT</option>
            <option value={3}>Monochrome</option>
          </select>
        </div>

        {/* Quality */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>Quality</label>
          <select value={quality} onChange={e => {
            const v = parseInt(e.target.value, 10);
            setQuality(v); updateEngine({ quality: v });
          }} style={selectStyle}>
            <option value={0}>Performance (1-Tap)</option>
            <option value={1}>Balanced (4-Tap)</option>
            <option value={2}>Cinema (9-Tap)</option>
          </select>
        </div>

        {/* Density Slider */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>Glyph Density</label>
            <span style={{ fontSize: 12, color: '#60a5fa' }}>{density}px</span>
          </div>
          <input type="range" min="1" max="32" step="1" value={density} onChange={e => {
            const v = parseInt(e.target.value, 10);
            setDensity(v); 
            setUserSetDensity(true);
            updateEngine({ density: v, userSetDensity: true });
          }} style={{ width: '100%' }} />
        </div>

        {/* Brightness Slider */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>Brightness</label>
            <span style={{ fontSize: 12, color: '#60a5fa' }}>{brightness.toFixed(2)}</span>
          </div>
          <input type="range" min="0" max="3" step="0.05" value={brightness} onChange={e => {
            const v = parseFloat(e.target.value);
            setBrightness(v); updateEngine({ brightness: v });
          }} style={{ width: '100%' }} />
        </div>

        {/* Contrast Slider */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>Contrast</label>
            <span style={{ fontSize: 12, color: '#60a5fa' }}>{contrast.toFixed(2)}</span>
          </div>
          <input type="range" min="0" max="3" step="0.05" value={contrast} onChange={e => {
            const v = parseFloat(e.target.value);
            setContrast(v); updateEngine({ contrast: v });
          }} style={{ width: '100%' }} />
        </div>

        {/* Saturation Slider */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>Saturation</label>
            <span style={{ fontSize: 12, color: '#60a5fa' }}>{saturation.toFixed(2)}</span>
          </div>
          <input type="range" min="0" max="3" step="0.05" value={saturation} onChange={e => {
            const v = parseFloat(e.target.value);
            setSaturation(v); updateEngine({ saturation: v });
          }} style={{ width: '100%' }} />
        </div>

      </div>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  background: '#1e293b', color: '#f1f5f9', border: '1px solid #334155',
  padding: '8px 12px', borderRadius: 8, outline: 'none', fontSize: 14
};
