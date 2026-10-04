const { contextBridge } = require('electron');

const arg = process.argv.find((a) => a.startsWith('--evergreen-api='));

contextBridge.exposeInMainWorld('evergreen', { apiUrl: arg ? arg.slice('--evergreen-api='.length) : 'http://localhost:3000' });
