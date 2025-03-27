#!/usr/bin/env bun

import { Database } from 'bun:sqlite';
import path from 'path';

const db = new Database(path.join(process.cwd(), 'data', 'bucky.db'));

// Query backup history
console.log('Recent backup history:');
const historyResults = db.query(`
  SELECT id, job_id, status, start_time, end_time, message 
  FROM backup_history 
  ORDER BY start_time DESC 
  LIMIT 10
`).all();

console.log(JSON.stringify(historyResults, null, 2));

// Query job details
console.log('\nBackup job details:');
const jobResults = db.query(`
  SELECT id, name, source_path, storage_provider_id, remote_path, status
  FROM backup_jobs
`).all();

console.log(JSON.stringify(jobResults, null, 2));

// Query storage provider details
console.log('\nStorage provider details:');
const providerResults = db.query(`
  SELECT id, name, type, config
  FROM storage_providers
`).all();

console.log(JSON.stringify(providerResults, null, 2)); 