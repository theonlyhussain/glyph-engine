import { useEffect, useRef, useState } from 'react';
import { GlyphEngine } from '../engine/GlyphEngine';
import { BottomControlBar } from './BottomControlBar';
import { SettingsDrawer } from './SettingsDrawer';

interface MediaPlayerUIProps {
  engine: GlyphEngine;
}

export function MediaPlayerUI({ engine }: MediaPlayerUIProps) {
  const [isControlsVisible, setIsControlsVisible] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  const showControls = () => {
    setIsControlsVisible(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (!isSettingsOpen) {
      timeoutRef.current = window.setTimeout(() => setIsControlsVisible(false), 2500);
    }
  };

  useEffect(() => {
    showControls();
    const handleMouseMove = () => showControls();
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [isSettingsOpen]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (engine.isPlaying) engine.pause();
        else engine.play();
        showControls();
      }
      if (e.code === 'KeyF') {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen();
        else document.exitFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [engine]);

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' }}>
      <BottomControlBar 
        engine={engine} 
        isVisible={isControlsVisible || isSettingsOpen} 
        onOpenSettings={() => setIsSettingsOpen(true)} 
      />
      
      <div style={{ pointerEvents: isSettingsOpen ? 'auto' : 'none' }}>
        <SettingsDrawer 
          engine={engine} 
          isOpen={isSettingsOpen} 
          onClose={() => {
            setIsSettingsOpen(false);
            showControls();
          }} 
        />
      </div>
    </div>
  );
}
