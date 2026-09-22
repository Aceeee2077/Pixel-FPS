import {defineConfig} from 'vite';
export default defineConfig({server:{host:'0.0.0.0',port:5173,strictPort:true},build:{rollupOptions:{output:{manualChunks:{three:['three']}}}}});
