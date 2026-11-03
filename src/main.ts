import './styles.css';
import { registerSW } from 'virtual:pwa-register';
import { startApp } from './app';
import { startAutoSync } from './sync/sync';

startApp(document.getElementById('app')!);
startAutoSync();
registerSW({ immediate: true });
