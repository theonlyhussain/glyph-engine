import type { FrameData } from '../types';

export type FrameCallback = (frame: FrameData) => void;

export interface FrameSource {
  /**
   * Starts providing frames
   */
  play(): Promise<void>;
  
  /**
   * Pauses frame generation
   */
  pause(): void;

  /**
   * Seeks to a specific time (if applicable)
   */
  seek(time: number): void;

  /**
   * Registers a callback to receive frames
   */
  onFrame(callback: FrameCallback): void;

  /**
   * Returns current source dimensions
   */
  getResolution(): { width: number, height: number };

  /**
   * Cleans up resources
   */
  dispose(): void;
}
