import '@fontsource/nunito/latin-400.css';
import '@fontsource/nunito/latin-700.css';
import '@fontsource/nunito/latin-800.css';
import './styles.css';
import { startApp } from './app';
import { startAutoSync } from './sync/sync';
import { startReminders } from './notify/reminders';
import { startPwa } from './pwa';

startApp(document.getElementById('app')!);
startAutoSync();
startReminders();
startPwa();
