const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

// Use the shared worker instance directly from worker.js
const workerInstance = require('./worker');

// Note: Worker should be started manually on VPS
// Do not auto-start here

module.exports = workerInstance;
