import './styles.css';
import { registerSW } from 'virtual:pwa-register';
import { startApp } from './ui/app';

startApp(document.getElementById('app')!);
registerSW({ immediate: true });
