import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({plugins:[react(),VitePWA({registerType:'autoUpdate',manifest:{name:'Adoce Club',short_name:'Adoce Club',description:'Clube de fidelidade da Adoce Brigaderia',theme_color:'#ef4b91',background_color:'#fff5f2',display:'standalone',start_url:'/',scope:'/',icons:[{src:'/assets/branding/logo-adoce-brigaderia.png',sizes:'512x512',type:'image/png',purpose:'any maskable'}]}})]});
