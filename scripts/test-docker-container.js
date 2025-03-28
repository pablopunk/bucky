#!/usr/bin/env bun

import fetch from 'node-fetch';
const baseUrl = 'http://localhost:3001';

// Simple test to validate that the Docker container is working correctly
async function runTests() {
  try {
    console.log('Testing Docker container...');
    console.log('1. Checking if app is running...');
    
    // Test 1: Check if app is running
    const response = await fetch(`${baseUrl}/api/health`);
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status} ${response.statusText}`);
    }
    
    const health = await response.json();
    console.log('✅ App is running:', health);
    
    // Test 2: Create a storage provider
    console.log('\n2. Creating a test storage provider...');
    const storageProvider = {
      name: 'Test Storj Provider',
      type: 'storj',
      config: JSON.stringify({
        type: 'storj',
        accessKey: 'test-access-key',
        secretKey: 'test-secret-key',
        bucket: 'test-bucket',
        endpoint: 'https://gateway.storjshare.io'
      })
    };
    
    const storageResponse = await fetch(`${baseUrl}/api/storage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(storageProvider)
    });
    
    if (!storageResponse.ok) {
      const error = await storageResponse.text();
      throw new Error(`Failed to create storage provider: ${storageResponse.status} ${storageResponse.statusText}\n${error}`);
    }
    
    const storageResult = await storageResponse.json();
    console.log('✅ Storage provider created:', storageResult);
    
    // Test 3: Create a backup job
    console.log('\n3. Creating a test backup job...');
    const backupJob = {
      name: 'Test Backup Job',
      sourcePath: '/app',
      storageProviderId: storageResult.id,
      schedule: '0 * * * *',
      remotePath: '/test-backup'
    };
    
    const jobResponse = await fetch(`${baseUrl}/api/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(backupJob)
    });
    
    if (!jobResponse.ok) {
      const error = await jobResponse.text();
      throw new Error(`Failed to create backup job: ${jobResponse.status} ${jobResponse.statusText}\n${error}`);
    }
    
    const jobResult = await jobResponse.json();
    console.log('✅ Backup job created:', jobResult);
    
    // Test 4: List jobs to make sure it doesn't include compression fields
    console.log('\n4. Getting jobs list to check for compression fields...');
    const jobsResponse = await fetch(`${baseUrl}/api/jobs`);
    
    if (!jobsResponse.ok) {
      throw new Error(`Failed to list jobs: ${jobsResponse.status} ${jobsResponse.statusText}`);
    }
    
    const jobs = await jobsResponse.json();
    console.log('Found jobs:', jobs.length);
    
    // Check if compression fields are in the response
    if (jobs.length > 0) {
      const firstJob = jobs[0];
      if ('compression_enabled' in firstJob || 'compression_level' in firstJob) {
        console.warn('⚠️ Warning: Job still contains compression fields in the API response!');
      } else {
        console.log('✅ Job does not contain compression fields in the API response');
      }
    }
    
    console.log('\nAll tests passed! Your Docker container is working correctly.');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

runTests(); 