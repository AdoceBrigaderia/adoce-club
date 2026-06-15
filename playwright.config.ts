import {defineConfig,devices} from '@playwright/test';
export default defineConfig({testDir:'./tests',use:{baseURL:'http://127.0.0.1:4175',trace:'on-first-retry'},webServer:{command:'npm run preview -- --port 4175',port:4175,reuseExistingServer:true},projects:[{name:'mobile-chromium',use:{...devices['Pixel 7']}}]});
