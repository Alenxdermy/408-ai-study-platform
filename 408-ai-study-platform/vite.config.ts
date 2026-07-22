import { createRequire } from 'node:module';
import { defineConfig } from 'vite';

const require = createRequire(import.meta.url);
const uni = require('@dcloudio/vite-plugin-uni').default;

export default defineConfig({
  plugins: uni().filter((plugin: { name?: string }) => plugin?.name),
  css: {
    preprocessorOptions: {
      scss: {
        quietDeps: true,
        silenceDeprecations: ['import', 'legacy-js-api']
      }
    }
  }
});
