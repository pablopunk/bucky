// Register required packages for Bree
// This file helps Bree properly initialize its dependencies
const cron = require('node-cron');

// Expose cron to Bree
global.cron = cron; 