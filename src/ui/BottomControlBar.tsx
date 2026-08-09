import React, { useEffect, useRef, useState } from 'react';
import { GlyphEngine } from '../engine/GlyphEngine';
import { EmbedModal } from './EmbedModal';

interface BottomControlBarProps {
  engine: GlyphEngine;
  onOpenSettings: () => void;
  isVisible: boolean;
}

function formatTime(secs: number) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function BottomControlBar({ engine, onOpenSettings, isVisible }: BottomControlBarProps) {
  const [isPlaying, setIsPlaying] = useState(engine.isPlaying);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isEmbedModalOpen, setIsEmbedModalOpen] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    let raf: number;
    const updateTime = () => {
      if (!isDraggingRef.current) {
        setCurrentTime(engine.currentTime);
      }
      setDuration(engine.duration || 0);
      setIsPlaying(engine.isPlaying);
      if (engine.exportProgress > 0 && engine.exportProgress < 100) {
        setExportProgress(engine.exportProgress);
      }
      raf = requestAnimationFrame(updateTime);
    };
    raf = requestAnimationFrame(updateTime);
    return () => cancelAnimationFrame(raf);
  }, [engine]);

  const handlePlayPause = () => {
    if (isPlaying) { engine.pause(); setIsPlaying(false); }
    else { engine.play(); setIsPlaying(true); }
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    engine.currentTime = time;
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    engine.volume = vol;
    if (vol > 0 && muted) {
      engine.muted = false;
      setMuted(false);
    }
  };

  const toggleMute = () => {
    engine.muted = !muted;
    setMuted(!muted);
  };

  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const blob = await engine.exportPxl();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Attempt to get filename from source, defaulting to 'project.pxl'
      const basename = (engine as any).source?.filename || 'project';
      a.download = `${basename}.pxl`;
      
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      padding: '24px 32px 32px 32px',
      background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%)',
      opacity: isVisible ? 1 : 0,
      transition: 'opacity 0.3s ease',
      display: 'flex', flexDirection: 'column', gap: 12,
      fontFamily: 'system-ui, -apple-system, sans-serif', color: '#fff',
      pointerEvents: isVisible ? 'auto' : 'none', zIndex: 40
    }}>
      {/* Modals */}
      <EmbedModal isOpen={isEmbedModalOpen} onClose={() => setIsEmbedModalOpen(false)} />
      
      {/* Export Overlay */}
      {isExporting && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: '#0f172a', zIndex: 9999, display: 'flex',
          flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          color: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <h2 style={{ marginBottom: 16 }}>Exporting Project...</h2>
          <div style={{ width: 300, height: 8, background: '#1e293b', borderRadius: 4, overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ width: `${exportProgress}%`, height: '100%', background: '#3b82f6', transition: 'width 0.1s linear' }} />
          </div>
          <div style={{ fontSize: 14, color: '#94a3b8' }}>
            {exportProgress > 99 ? 'Extracting audio...' : `${Math.round(exportProgress)}%`}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ fontSize: 13, width: 40, textAlign: 'right', color: '#cbd5e1' }}>{formatTime(currentTime)}</span>
        <input 
          type="range" min="0" max={duration || 100} step="0.01" value={currentTime}
          onMouseDown={() => isDraggingRef.current = true}
          onMouseUp={() => isDraggingRef.current = false}
          onChange={handleSeekChange}
          style={{ flex: 1, cursor: 'pointer', accentColor: '#3b82f6' }}
        />
        <span style={{ fontSize: 13, width: 40, color: '#94a3b8' }}>{formatTime(duration)}</span>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <button onClick={handlePlayPause} style={btnStyle}>
            {isPlaying ? (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zm8 0h4v16h-4z"/></svg>
            ) : (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            )}
          </button>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={toggleMute} style={btnStyle}>
              {muted || volume === 0 ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
              )}
            </button>
            <input 
              type="range" min="0" max="1" step="0.01" value={muted ? 0 : volume} 
              onChange={handleVolumeChange} 
              style={{ width: 80, cursor: 'pointer', accentColor: '#cbd5e1' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={() => setIsEmbedModalOpen(true)} style={btnStyle} title="Get Embed Code">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/></svg>
          </button>
          <button onClick={handleExport} style={{ ...btnStyle, opacity: isExporting ? 0.7 : 1, fontSize: 12, fontWeight: 'bold' }} title="Export .pxl">
            {isExporting ? (
              <span>EXPORTING...</span>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
            )}
          </button>
          <button onClick={onOpenSettings} style={btnStyle} title="Settings">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.06-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.73,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.06,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.43-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.49-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: 'transparent', border: 'none', color: '#fff',
  cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center'
};
