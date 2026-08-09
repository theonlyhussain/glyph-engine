import React, { useRef, useState } from 'react';

interface WelcomeScreenProps {
  onVideoSelected: (file: File) => void;
}

export function WelcomeScreen({ onVideoSelected }: WelcomeScreenProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type.startsWith('video/') || file.name.endsWith('.pxl'))) {
      onVideoSelected(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onVideoSelected(file);
    }
  };

  return (
    <div 
      style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: '#0f172a', color: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif'
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div 
        style={{
          width: '100%', maxWidth: 500, padding: 48,
          background: isDragging ? '#1e293b' : '#1e293b88',
          border: `2px dashed ${isDragging ? '#3b82f6' : '#334155'}`,
          borderRadius: 24, textAlign: 'center',
          transition: 'all 0.2s', backdropFilter: 'blur(10px)'
        }}
      >
        <h1 style={{ margin: '0 0 8px 0', fontSize: 32, fontWeight: 800, background: 'linear-gradient(to right, #60a5fa, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          GlyphEngine
        </h1>
        <p style={{ margin: '0 0 32px 0', color: '#94a3b8', fontSize: 16 }}>
          GPU Typography Renderer
        </p>

        <button 
          onClick={() => fileInputRef.current?.click()}
          style={{
            background: '#3b82f6', color: '#fff', border: 'none', padding: '12px 24px',
            borderRadius: 8, fontSize: 16, fontWeight: 600, cursor: 'pointer',
            boxShadow: '0 4px 14px 0 rgba(59, 130, 246, 0.39)', transition: 'transform 0.1s'
          }}
          onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
          onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          Choose Video
        </button>
        
        <p style={{ margin: '16px 0 0 0', color: '#64748b', fontSize: 14 }}>
          or drag & drop anywhere
        </p>
        
        <div style={{ marginTop: 32, fontSize: 12, color: '#475569', display: 'flex', justifyContent: 'center', gap: 12 }}>
          <span>MP4</span><span>•</span>
          <span>MOV</span><span>•</span>
          <span>WEBM</span><span>•</span>
          <span>.PXL</span>
        </div>
      </div>
      <input 
        ref={fileInputRef} 
        type="file" 
        accept="video/*,.pxl" 
        style={{ display: 'none' }} 
        onChange={handleFileChange} 
      />
    </div>
  );
}
