import './styles.css';
import { startApp } from './app';
import { startAutoSync } from './sync/sync';
import { startReminders } from './notify/reminders';
import { startPwa } from './pwa';

startApp(document.getElementById('app')!);
startAutoSync();
startReminders();
startPwa();
