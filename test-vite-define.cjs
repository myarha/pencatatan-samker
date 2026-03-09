const { build } = require('vite');
const fs = require('fs');
async function run() {
  fs.writeFileSync('test-input.js', 'console.log(process.env.GEMINI_API_KEY);');
  await build({
    configFile: false,
    root: __dirname,
    build: {
      lib: { entry: 'test-input.js', formats: ['es'] },
      write: true,
    },
    define: {
      'process.env.GEMINI_API_KEY': undefined
    }
  });
  console.log(fs.readFileSync('dist/test-input.js', 'utf8'));
}
run();
