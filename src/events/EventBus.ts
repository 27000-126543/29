import EventEmitter from 'eventemitter3';

export type EventCallback = (...args: any[]) => void;

export class EventBus {
  private static instance: EventBus;
  private emitter: EventEmitter;

  private constructor() {
    this.emitter = new EventEmitter();
  }

  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  on(event: string, callback: EventCallback) {
    this.emitter.on(event, callback);
  }

  off(event: string, callback: EventCallback) {
    this.emitter.off(event, callback);
  }

  emit(event: string, ...args: any[]) {
    this.emitter.emit(event, ...args);
  }

  once(event: string, callback: EventCallback) {
    this.emitter.once(event, callback);
  }

  listenerCount(event: string): number {
    return this.emitter.listenerCount(event);
  }
}
