const path = require('path');
const { setupServer } = require('../electron/server.cjs');

const dataDir = path.join(__dirname, '..', 'data');
const distDir = path.join(__dirname, '..', 'dist');

setupServer(dataDir, distDir);
