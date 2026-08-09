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
    if (!engine) return;

    const searchParams = new URLSearchParams(window.location.search);
    const srcUrl = searchParams.get('src');

    if (srcUrl) {
      (async () => {
        try {
          const res = await fetch(srcUrl);
          if (!res.ok) {
            throw new Error(`Failed to fetch remote pxl: HTTP ${res.status}`);
          }
          const blob = await res.blob();
          const urlPath = srcUrl.split('?')[0];
          const filename = urlPath.split('/').pop() || 'remote.pxl';
          const file = new File([blob], filename.endsWith('.pxl') ? filename : `${filename}.pxl`, {
            type: blob.type || 'application/octet-stream'
          });
          await engine.loadPxl(file);
          setHasVideo(true);
        } catch (err: any) {
          console.error('Failed to load PXL from URL parameter:', err);
          setError('Failed to load remote artwork: ' + err.message);
        }
      })();
    }
  }, [engine]);

  useEffect(() => {
    let animationFrameId: number;
    
    const updateCanvasSize = () => {
      if (!canvasRef.current) return;
      
      let targetW = window.innerWidth;
      let targetH = window.innerHeight;
      
      let sourceW = 0;
      let sourceH = 0;
      
      if (engine) {
        if ((engine.getRenderer() as any).isPxlMode) {
          const dim = (engine.getRenderer() as any).pxlDimensions;
          sourceW = dim?.width || 0;
          sourceH = dim?.height || 0;
        } else if (engine.videoElement && engine.videoElement.videoWidth > 0) {
          sourceW = engine.videoElement.videoWidth;
          sourceH = engine.videoElement.videoHeight;
        }
      }
      
      if (sourceW > 0 && sourceH > 0) {
        const videoRatio = sourceW / sourceH;
        const windowRatio = window.innerWidth / window.innerHeight;
        
        if (videoRatio > windowRatio) {
          targetW = window.innerWidth;
          targetH = window.innerWidth / videoRatio;
        } else {
          targetH = window.innerHeight;
          targetW = window.innerHeight * videoRatio;
        }
      }
      
      const pixelRatio = window.devicePixelRatio || 1;
      const finalW = Math.round(targetW * pixelRatio);
      const finalH = Math.round(targetH * pixelRatio);
      
      if (canvasRef.current.width !== finalW || canvasRef.current.height !== finalH) {
        canvasRef.current.width = finalW;
        canvasRef.current.height = finalH;
      }
      
      animationFrameId = requestAnimationFrame(updateCanvasSize);
    };
    
    animationFrameId = requestAnimationFrame(updateCanvasSize);
    return () => cancelAnimationFrame(animationFrameId);
  }, [engine]);

  const handleVideoSelected = async (file: File) => {
    if (!engine) return;
    try {
      if (file.name.endsWith('.pxl')) {
        await engine.loadPxl(file);
      } else {
        await engine.loadVideo(file);
      }
      setHasVideo(true);
    } catch (err: any) {
      setError('Failed to load file. ' + err.message);
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
      <DeveloperMode engine={engine} />
    </div>
  );
}
