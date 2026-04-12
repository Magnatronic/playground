import { AppShell } from './app/AppShell.js';

const shell = new AppShell();
shell.init().catch((err) => {
  console.error('Failed to initialize Playground:', err);
});
