import { render } from 'preact';
import { App } from './app';
import './styles.css';
import { installHaptics } from './lib/haptics';

installHaptics();
render(<App />, document.getElementById('app')!);
