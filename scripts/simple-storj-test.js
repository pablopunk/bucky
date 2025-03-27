#!/usr/bin/env node

// Simple script to test Storj connection directly
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';
import { fileURLToPath } from 'url';
import { Database } from 'bun:sqlite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execPromise = util.promisify(exec);

async function main() {
  try {
    console.log('Testing Storj connection directly...');
    
    // Hard-coded credentials from the database
    const credentials = {
      accessKey: "juqv354x4qpmjugjfzi33esvvvfq",
      secretKey: "jysohcxu3ysffumcnksx3ecgftlsbxty6vze746wcg57f6zoemq5s",
      bucket: "duplicati"
    };
    
    // Create test config file
    const configPath = path.join(process.cwd(), 'temp', 'simple_storj_test.conf');
    const rcloneConfig = `
[storj-test]
type = s3
provider = Storj
access_key_id = ${credentials.accessKey}
secret_access_key = ${credentials.secretKey}
endpoint = gateway.storjshare.io
acl = private
`;
    
    // Ensure temp directory exists
    if (!fs.existsSync(path.join(process.cwd(), 'temp'))) {
      fs.mkdirSync(path.join(process.cwd(), 'temp'), { recursive: true });
    }
    
    // Write config to file
    fs.writeFileSync(configPath, rcloneConfig);
    
    console.log('Testing connection to Storj...');
    
    // List buckets
    console.log('\n---- Listing buckets ----');
    const { stdout: bucketsOutput } = await execPromise(`rclone --config="${configPath}" lsjson storj-test:`);
    const buckets = JSON.parse(bucketsOutput);
    
    console.log(`Found ${buckets.length} buckets:`);
    for (const bucket of buckets) {
      console.log(`- ${bucket.Name}`);
    }
    
    // Try to list the duplicati bucket
    console.log('\n---- Listing duplicati bucket contents ----');
    try {
      const { stdout: bucketContents } = await execPromise(`rclone --config="${configPath}" lsjson storj-test:duplicati`);
      const contents = JSON.parse(bucketContents);
      
      if (contents.length === 0) {
        console.log('Bucket is empty.');
      } else {
        console.log(`Found ${contents.length} items in bucket:`);
        for (const item of contents) {
          console.log(`- ${item.Name} (${item.IsDir ? 'directory' : 'file'})`);
        }
      }
    } catch (error) {
      console.error('Error listing bucket contents:', error.message);
    }
    
    // Try to list the jpegs2 folder in the duplicati bucket
    console.log('\n---- Testing jpegs2 path ----');
    try {
      const { stdout: pathContents } = await execPromise(`rclone --config="${configPath}" lsjson storj-test:duplicati/jpegs2`);
      const contents = JSON.parse(pathContents);
      
      if (contents.length === 0) {
        console.log('Path is empty or does not exist.');
      } else {
        console.log(`Found ${contents.length} items in path:`);
        for (const item of contents) {
          console.log(`- ${item.Name} (${item.IsDir ? 'directory' : 'file'})`);
        }
      }
    } catch (error) {
      console.error('Error listing path contents:', error.message);
    }
    
    // Test permissions by trying to create a test directory
    console.log('\n---- Testing write permissions ----');
    try {
      const testDir = `storj-test:duplicati/test-${Date.now()}`;
      await execPromise(`rclone --config="${configPath}" mkdir ${testDir}`);
      console.log('Successfully created test directory. You have write access!');
      
      // Clean up
      await execPromise(`rclone --config="${configPath}" rmdir ${testDir}`);
    } catch (error) {
      console.error('Error creating test directory:', error.message);
      console.log('You might not have write permissions on this bucket.');
    }
    
    // Clean up
    fs.unlinkSync(configPath);
    console.log('\nTest completed.');
    
  } catch (error) {
    console.error('Error testing Storj connection:', error);
  }
}

main(); 