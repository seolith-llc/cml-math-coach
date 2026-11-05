import './styles.css';
import { registerSW } from 'virtual:pwa-register';
import { startApp } from './app';
import { startAutoSync } from './sync/sync';
import { startReminders } from './notify/reminders';

startApp(document.getElementById('app')!);
startAutoSync();
startReminders();
registerSW({ immediate: true });
