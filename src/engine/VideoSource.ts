export class VideoSource {
  public element: HTMLVideoElement;
  private currentBlobUrl: string | null = null;
  public onMeta: ((width: number, height: number) => void) | null = null;

  constructor() {
    this.element = document.createElement('video');
    this.element.crossOrigin = 'anonymous';
    this.element.muted = true;
    this.element.loop = true;
    this.element.playsInline = true;
    // Essential for texture_external: video must be playing and ready
    this.element.addEventListener('loadedmetadata', () => {
      if (this.onMeta) {
        this.onMeta(this.element.videoWidth, this.element.videoHeight);
      }
    });
  }

  public async load(file: File | Blob): Promise<void> {
    if (this.currentBlobUrl) {
      URL.revokeObjectURL(this.currentBlobUrl);
      this.currentBlobUrl = null;
    }
    
    return new Promise((resolve, reject) => {
      this.currentBlobUrl = URL.createObjectURL(file);
      
      const onCanPlay = () => {
        this.element.removeEventListener('canplay', onCanPlay);
        this.element.removeEventListener('error', onError);
        resolve();
      };
      
      const onError = () => {
        this.element.removeEventListener('canplay', onCanPlay);
        this.element.removeEventListener('error', onError);
        reject(new Error('Failed to load video'));
      };
      
      this.element.addEventListener('canplay', onCanPlay);
      this.element.addEventListener('error', onError);
      
      this.element.src = this.currentBlobUrl;
      this.element.load();
    });
  }

  public play() {
    return this.element.play();
  }

  public pause() {
    this.element.pause();
  }

  public get width() { return this.element.videoWidth; }
  public get height() { return this.element.videoHeight; }
  public get isReady() { return this.element.readyState >= 3; } // HAVE_FUTURE_DATA
  public get isPlaying() { return !this.element.paused; }

  public destroy() {
    this.pause();
    this.element.removeAttribute('src');
    this.element.load();
    if (this.currentBlobUrl) {
      URL.revokeObjectURL(this.currentBlobUrl);
      this.currentBlobUrl = null;
    }
  }
}
