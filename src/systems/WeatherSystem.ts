import { WeatherType } from '../types/enums';
import { WaterArea } from '../types/interfaces';

export class WeatherSystem {
  private areaWeathers: Map<string, WeatherType> = new Map();
  private changeInterval: number = 30 * 60 * 1000;
  private lastChangeTime: Map<string, number> = new Map();

  constructor() {
    this.initializeWeathers();
  }

  private initializeWeathers() {
    const weathers = Object.values(WeatherType);
    this.areaWeathers.set('green_lake', WeatherType.SUNNY);
    this.areaWeathers.set('silver_river', WeatherType.CLOUDY);
    this.areaWeathers.set('deep_ocean', WeatherType.STORMY);
    this.areaWeathers.set('misty_river', WeatherType.FOGGY);
  }

  getWeather(areaId: string): WeatherType {
    this.checkAndUpdateWeather(areaId);
    return this.areaWeathers.get(areaId) || WeatherType.SUNNY;
  }

  private checkAndUpdateWeather(areaId: string) {
    const now = Date.now();
    const lastChange = this.lastChangeTime.get(areaId) || 0;

    if (now - lastChange >= this.changeInterval) {
      this.updateWeather(areaId);
      this.lastChangeTime.set(areaId, now);
    }
  }

  private updateWeather(areaId: string) {
    const weathers = Object.values(WeatherType);
    const weights = this.getWeatherWeights(areaId);

    let totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
    let random = Math.random() * totalWeight;

    for (const weather of weathers) {
      random -= weights[weather] || 0;
      if (random <= 0) {
        this.areaWeathers.set(areaId, weather);
        return;
      }
    }

    this.areaWeathers.set(areaId, WeatherType.SUNNY);
  }

  private getWeatherWeights(areaId: string): Partial<Record<WeatherType, number>> {
    if (areaId === 'green_lake') {
      return {
        [WeatherType.SUNNY]: 50,
        [WeatherType.CLOUDY]: 30,
        [WeatherType.RAINY]: 15,
        [WeatherType.FOGGY]: 5,
      };
    }
    if (areaId === 'silver_river') {
      return {
        [WeatherType.SUNNY]: 30,
        [WeatherType.CLOUDY]: 35,
        [WeatherType.RAINY]: 25,
        [WeatherType.FOGGY]: 10,
      };
    }
    if (areaId === 'deep_ocean') {
      return {
        [WeatherType.SUNNY]: 15,
        [WeatherType.CLOUDY]: 25,
        [WeatherType.RAINY]: 20,
        [WeatherType.STORMY]: 40,
      };
    }
    if (areaId === 'misty_river') {
      return {
        [WeatherType.FOGGY]: 55,
        [WeatherType.CLOUDY]: 25,
        [WeatherType.RAINY]: 15,
        [WeatherType.SUNNY]: 5,
      };
    }
    return { [WeatherType.SUNNY]: 100 };
  }

  getWeatherModifier(weather: WeatherType): number {
    const modifiers: Record<WeatherType, number> = {
      [WeatherType.SUNNY]: 1.0,
      [WeatherType.CLOUDY]: 1.1,
      [WeatherType.RAINY]: 1.25,
      [WeatherType.STORMY]: 0.7,
      [WeatherType.FOGGY]: 1.15,
      [WeatherType.SNOWY]: 0.5,
    };
    return modifiers[weather];
  }

  getRarityModifier(weather: WeatherType): number {
    const modifiers: Record<WeatherType, number> = {
      [WeatherType.SUNNY]: 0,
      [WeatherType.CLOUDY]: 0.02,
      [WeatherType.RAINY]: 0.05,
      [WeatherType.STORMY]: 0.15,
      [WeatherType.FOGGY]: 0.08,
      [WeatherType.SNOWY]: 0.1,
    };
    return modifiers[weather];
  }

  getWeatherLabel(weather: WeatherType): string {
    const labels: Record<WeatherType, string> = {
      [WeatherType.SUNNY]: '晴天',
      [WeatherType.CLOUDY]: '多云',
      [WeatherType.RAINY]: '雨天',
      [WeatherType.STORMY]: '暴风雨',
      [WeatherType.FOGGY]: '雾天',
      [WeatherType.SNOWY]: '雪天',
    };
    return labels[weather];
  }
}
