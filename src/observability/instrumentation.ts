import { EventEmitter } from 'node:events';
import { initializeTracing } from './tracing';

EventEmitter.defaultMaxListeners = 30;

initializeTracing({
  get: (key: string) => process.env[key],
});
