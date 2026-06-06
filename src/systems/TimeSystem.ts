import { TimeOfDay } from '../types/enums';

export class TimeSystem {
  private gameTimeMultiplier: number = 60;
  private epoch: number = Date.now();
  private realEpoch: number = Date.now();

  constructor(multiplier: number = 60) {
    this.gameTimeMultiplier = multiplier;
  }

  getCurrentGameTime(): number {
    const realElapsed = Date.now() - this.realEpoch;
    return this.epoch + realElapsed * this.gameTimeMultiplier;
  }

  getTimeOfDay(): TimeOfDay {
    const gameTime = this.getCurrentGameTime();
    const hours = new Date(gameTime).getHours();

    if (hours >= 5 && hours < 7) return TimeOfDay.DAWN;
    if (hours >= 7 && hours < 12) return TimeOfDay.MORNING;
    if (hours >= 12 && hours < 14) return TimeOfDay.NOON;
    if (hours >= 14 && hours < 18) return TimeOfDay.AFTERNOON;
    if (hours >= 18 && hours < 20) return TimeOfDay.DUSK;
    return TimeOfDay.NIGHT;
  }

  formatGameTime(): string {
    const date = new Date(this.getCurrentGameTime());
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate()
    ).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(
      date.getMinutes()
    ).padStart(2, '0')}`;
  }

  getTimeOfDayLabel(time: TimeOfDay): string {
    const labels: Record<TimeOfDay, string> = {
      [TimeOfDay.DAWN]: '黎明',
      [TimeOfDay.MORNING]: '上午',
      [TimeOfDay.NOON]: '正午',
      [TimeOfDay.AFTERNOON]: '下午',
      [TimeOfDay.DUSK]: '黄昏',
      [TimeOfDay.NIGHT]: '夜晚',
    };
    return labels[time];
  }
}
