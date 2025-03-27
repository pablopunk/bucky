// Register required packages for Bree
// This file helps Bree properly initialize its dependencies
import nodeCron from 'node-cron';

// Expose cron to global scope for Bree
globalThis.cron = nodeCron;

// No operation - this file is referenced by the Bree scheduler
// to register worker environments. It can be extended later
// if specific registration is needed.
console.log('Bree worker environment registered'); 