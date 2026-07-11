import { useEffect, useState } from 'react';

export function DeveloperMode() {
  const [isVisible, setIsVisible] = useState(false);
  const [fps, setFps] = useState(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') {
        setIsVisible(v => !v);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    
    let frames = 0;
    let lastTime = performance.now();
    let raf: number;
    
    const loop = () => {
      frames++;
      const now = performance.now();
      if (now - lastTime >= 1000) {
        setFps(frames);
        frames = 0;
        lastTime = now;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div style={{
      position: 'absolute', top: 16, left: 16,
      background: '#1e293bdd', padding: '16px', borderRadius: 8,
      border: '1px solid #334155', color: '#cbd5e1',
      fontFamily: 'monospace', fontSize: 12, backdropFilter: 'blur(8px)',
      pointerEvents: 'none', zIndex: 9999
    }}>
      <h3 style={{ margin: '0 0 12px 0', color: '#f8fafc', fontSize: 14 }}>Developer Mode</h3>
      
      <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 8 }}>
        <div>Render FPS:</div><div style={{ color: '#60a5fa', fontWeight: 'bold' }}>{fps}</div>
        <div>VRAM Est:</div><div>~16 MB</div>
        <div>Draw Calls:</div><div>1</div>
        <div>Compute Passes:</div><div>1</div>
      </div>
      
      <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #334155', color: '#94a3b8' }}>
        Press Ctrl+Shift+D to hide
      </div>
    </div>
  );
}
