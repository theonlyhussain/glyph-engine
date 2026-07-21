import { useState } from 'react';

interface EmbedModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function EmbedModal({ isOpen, onClose }: EmbedModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const embedCode = `<script type="module" src="https://glyph-engine.vercel.app/embed.js"></script>
<glyph-player 
  src="./project.gef" 
  style="width: 100%; height: 100%; display: block;"
></glyph-player>`;

  const handleCopy = () => {
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        background: '#0f172a', border: '1px solid #334155',
        borderRadius: 16, padding: 32, width: '100%', maxWidth: 600,
        color: '#f8fafc', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Embed Player</h2>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
        </div>

        <p style={{ margin: '0 0 16px 0', color: '#cbd5e1', fontSize: 14, lineHeight: 1.5 }}>
          Copy this code and paste it into your website's HTML. 
          Make sure to replace the <strong>src</strong> URL with the link to your actual hosted `.gef` file!
        </p>

        <div style={{ position: 'relative', marginBottom: 24 }}>
          <pre style={{
            background: '#000', padding: 16, borderRadius: 8,
            overflowX: 'auto', fontSize: 13, color: '#38bdf8',
            border: '1px solid #1e293b', margin: 0
          }}>
            <code>{embedCode}</code>
          </pre>
          <button 
            onClick={handleCopy}
            style={{
              position: 'absolute', top: 12, right: 12,
              background: copied ? '#22c55e' : '#3b82f6',
              color: '#fff', border: 'none', borderRadius: 4,
              padding: '6px 12px', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', transition: 'background 0.2s'
            }}
          >
            {copied ? 'COPIED!' : 'COPY'}
          </button>
        </div>

        <div style={{ fontSize: 12, color: '#64748b', background: '#1e293b', padding: 12, borderRadius: 8 }}>
          <strong>Note:</strong> On older devices or browsers without WebGPU support, the player will automatically fallback to displaying a high-quality static thumbnail of your artwork.
        </div>
      </div>
    </div>
  );
}
