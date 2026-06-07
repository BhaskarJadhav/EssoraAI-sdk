export class VoiceActivityMeter {
  private currentLevel = 0;

  setLevel(level: number): void {
    this.currentLevel = Math.max(0, Math.min(1, level));
  }

  getLevel(): number {
    return this.currentLevel;
  }
}
