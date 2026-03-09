import { loadEnv } from 'vite';
process.env.MY_VAR = 'hello';
const env = loadEnv('production', '.', '');
console.log(env.MY_VAR);
