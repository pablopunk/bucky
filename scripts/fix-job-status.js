#!/usr/bin/env bun

import { Database } from 'bun:sqlite';
import path from 'path';

const db = new Database(path.join(process.cwd(), 'data', 'bucky.db'));

console.log('Checking for stuck jobs...');

// Find any jobs stuck in in_progress status
const stuckJobs = db.query(`
  SELECT id, name, status, updated_at
  FROM backup_jobs
  WHERE status = 'in_progress'
`).all();

if (stuckJobs.length === 0) {
  console.log('No stuck jobs found!');
  process.exit(0);
}

console.log(`Found ${stuckJobs.length} stuck jobs:`);
console.log(JSON.stringify(stuckJobs, null, 2));

// Update stuck jobs to active
db.query(`
  UPDATE backup_jobs
  SET status = 'active', updated_at = ?
  WHERE status = 'in_progress'
`).run(new Date().toISOString());

console.log('All stuck jobs have been reset to active status.');

// Verify the update
const verifyJobs = db.query(`
  SELECT id, name, status, updated_at
  FROM backup_jobs
  WHERE id IN (${stuckJobs.map(job => `'${job.id}'`).join(',')})
`).all();

console.log('Updated job status:');
console.log(JSON.stringify(verifyJobs, null, 2));

console.log('Script completed successfully.'); 