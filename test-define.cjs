const { defineConfig } = require('vite');
const config = defineConfig({
  define: {
    'process.env.GEMINI_API_KEY': JSON.stringify(undefined),
  }
});
console.log(config);
