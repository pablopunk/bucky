import { BackupScheduler } from './scheduler';
import { BreeScheduler } from './bree-scheduler';
import { NodeScheduler } from './node-scheduler';
import { StorageProviderManager } from '../storage';

// Export other backup-related functionality
export * from './scheduler';
export * from './engine';
export * from './service';
export * from './bree-scheduler';
export * from './node-scheduler';

// Singleton instances
let legacySchedulerInstance: BackupScheduler | null = null;
let breeSchedulerInstance: BreeScheduler | null = null;
let nodeSchedulerInstance: NodeScheduler | null = null;

/**
 * Get the legacy scheduler instance (setTimeout-based)
 * @deprecated Use getNodeScheduler() instead
 */
export function getLegacyScheduler(): BackupScheduler {
  if (!legacySchedulerInstance) {
    console.log('Initializing legacy backup scheduler singleton...');
    legacySchedulerInstance = new BackupScheduler(new StorageProviderManager());
    
    // Load and schedule all active jobs
    legacySchedulerInstance.loadJobs().catch(err => {
      console.error('Error loading jobs during initialization:', err);
    });
  }
  
  return legacySchedulerInstance;
}

/**
 * Get the Bree-based scheduler instance (worker thread based)
 * @deprecated Use getNodeScheduler instead
 */
export function getBreeScheduler(): BreeScheduler {
  if (!breeSchedulerInstance) {
    console.log('Initializing Bree backup scheduler singleton...');
    breeSchedulerInstance = new BreeScheduler();
  }
  return breeSchedulerInstance;
}

/**
 * Get the Node-schedule based scheduler (recommended)
 */
export function getNodeScheduler(): NodeScheduler {
  if (!nodeSchedulerInstance) {
    console.log('Initializing Node scheduler singleton...');
    nodeSchedulerInstance = new NodeScheduler();
  }
  return nodeSchedulerInstance;
}

/**
 * Initialize the scheduler
 */
export async function initializeScheduler(): Promise<void> {
  const scheduler = getNodeScheduler();
  await scheduler.start();
  console.log('Node scheduler initialized');
}

/**
 * Shutdown the scheduler
 */
export async function shutdownScheduler(): Promise<void> {
  if (nodeSchedulerInstance) {
    await nodeSchedulerInstance.stop();
    nodeSchedulerInstance = null;
    console.log('Node scheduler shutdown complete');
  }
}

/**
 * For backward compatibility
 * @deprecated Use getNodeScheduler instead
 */
export const getScheduler = getLegacyScheduler; 