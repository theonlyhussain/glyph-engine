import type { FrameCallback, FrameSource } from './FrameSource';
import type { FrameData } from '../types';

export class VideoFrameSource implements FrameSource {
  private video: HTMLVideoElement;
  private callbacks: Set<FrameCallback> = new Set();
  private isPlaying: boolean = false;
  private rvfcHandle: number = 0;
  private frameCount: number = 0;

  constructor(videoInput: string | File | HTMLVideoElement) {
    if (videoInput instanceof HTMLVideoElement) {
      this.video = videoInput;
    } else {
      this.video = document.createElement('video');
      this.video.crossOrigin = 'anonymous';
      this.video.playsInline = true;
      this.video.muted = true;
      this.video.loop = true;

      if (typeof videoInput === 'string') {
        this.video.src = videoInput;
      } else {
        this.video.src = URL.createObjectURL(videoInput);
      }
    }
  }

  public async play(): Promise<void> {
    this.isPlaying = true;
    await this.video.play();
    this.requestNextFrame();
  }

  public pause(): void {
    this.isPlaying = false;
    this.video.pause();
    if (this.rvfcHandle && 'cancelVideoFrameCallback' in this.video) {
      (this.video as any).cancelVideoFrameCallback(this.rvfcHandle);
      this.rvfcHandle = 0;
    }
  }

  public seek(time: number): void {
    this.video.currentTime = time;
    // Dispatch a single frame for the seeked position
    if (!this.isPlaying) {
      // Small timeout to allow video to seek
      setTimeout(() => this.dispatchFrame(performance.now()), 50);
    }
  }

  public onFrame(callback: FrameCallback): void {
    this.callbacks.add(callback);
  }

  public getResolution(): { width: number; height: number } {
    return {
      width: this.video.videoWidth || 1920, // default if not yet loaded
      height: this.video.videoHeight || 1080
    };
  }

  public dispose(): void {
    this.pause();
    this.callbacks.clear();
    this.video.src = '';
    this.video.remove();
  }

  private requestNextFrame = () => {
    if (!this.isPlaying) return;

    if ('requestVideoFrameCallback' in this.video) {
      this.rvfcHandle = (this.video as any).requestVideoFrameCallback(this.handleVideoFrame);
    } else {
      // Fallback for older browsers (though WebGPU target usually implies modern browsers)
      this.rvfcHandle = requestAnimationFrame((time) => {
        this.dispatchFrame(time);
        this.requestNextFrame();
      });
    }
  };

  private handleVideoFrame = (now: number) => {
    this.dispatchFrame(now);
    this.requestNextFrame();
  };

  private dispatchFrame(timestamp: number) {
    if (this.video.videoWidth === 0 || this.video.videoHeight === 0) return;
    
    this.frameCount++;
    const frameData: FrameData = {
      videoFrame: this.video,
      width: this.video.videoWidth,
      height: this.video.videoHeight,
      timestamp: timestamp
    };

    for (const callback of this.callbacks) {
      callback(frameData);
    }
  }
}
