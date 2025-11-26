#!/usr/bin/env node

// Start worker for VPS deployment
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const worker = require('./worker');

console.log('🚀 Starting Sovry Worker on VPS...');
console.log('📋 Worker Configuration:');
console.log('   - StoryScan API: https://aeneid.storyscan.io/api/v2/stats');
console.log('   - Update Interval: Every 1 minute');
console.log('   - Cache: In-memory');

// Start the worker
worker.start().catch(error => {
  console.error('❌ Failed to start worker:', error);
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT, shutting down worker gracefully...');
  await worker.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, shutting down worker gracefully...');
  await worker.stop();
  process.exit(0);
});

console.log('✅ Worker started successfully on VPS');
