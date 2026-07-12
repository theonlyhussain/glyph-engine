import { useRef, useState, useEffect } from 'react';
import { GlyphEngine } from './engine/GlyphEngine';
import { WelcomeScreen } from './ui/WelcomeScreen';
import { MediaPlayerUI } from './ui/MediaPlayerUI';
import { DeveloperMode } from './ui/DeveloperMode';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [engine, setEngine] = useState<GlyphEngine | null>(null);
  const [hasVideo, setHasVideo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    
    const ge = new GlyphEngine(canvasRef.current);
    ge.init().then(() => {
      setEngine(ge);
    }).catch(err => {
      console.error(err);
      setError(err.message);
    });

    return () => {
      ge.destroy();
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleVideoSelected = async (file: File) => {
    if (!engine) return;
    try {
      await engine.loadVideo(file);
      setHasVideo(true);
    } catch (err: any) {
      setError('Failed to decode video. Please try a different file.');
    }
  };

  if (error) {
    return (
      <div style={{ padding: 40, color: '#f87171', background: '#0f172a', height: '100vh', fontFamily: 'system-ui' }}>
        <h2>Initialization Error</h2>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#000', position: 'relative' }}>
      <canvas 
        ref={canvasRef} 
        style={{ 
          width: '100%', height: '100%', display: 'block',
          objectFit: 'contain'
        }} 
      />
      
      {!hasVideo && (
        <WelcomeScreen onVideoSelected={handleVideoSelected} />
      )}
      
      {hasVideo && engine && (
        <MediaPlayerUI engine={engine} />
      )}
      <DeveloperMode />
    </div>
  );
}
