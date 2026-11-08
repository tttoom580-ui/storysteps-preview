import {defineConfig} from 'vite';
export default defineConfig({base:'./',server:{allowedHosts:['terminal.local']},esbuild:{jsx:'automatic'},build:{outDir:'docs'}});
