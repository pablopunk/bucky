// Export job runner functionality
// The main runBackup worker script for executing backup jobs
export * from './runBackup.js';

// This is a module that bundles all job-related functionality
// It's referenced by Bree scheduler when setting up worker processes
console.log('Jobs module loaded');

// This file serves as the entry point for the jobs module
// It's referenced by Bree scheduler when setting up worker processes

console.log('Jobs index.js module loaded successfully');

// Import from JavaScript files directly
import runBackup from './runBackup.js';

// Named exports
export { runBackup };

// Default export for convenience
export default {
  runBackup
}; 