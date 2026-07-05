import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: './', // GitHub Pages(project pages)でも相対参照で動くように
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        editor: resolve(__dirname, 'editor.html'),
      },
    },
  },
});
