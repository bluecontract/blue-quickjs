import './styles.css';
import { PlaygroundApp } from './app/playground-app.js';

const root = document.getElementById('app');

if (!root) {
  throw new Error('Missing #app root for BlueQuickjs Playground');
}

const app = new PlaygroundApp(root);
void app.init();
