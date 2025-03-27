import { NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/db"
import { StorageProviderManager } from "@/lib/storage/manager"
import logger from "@/lib/logger"

/**
 * Test connections for all storage providers
 * 
 * @returns Array of storage provider connection test results
 */
export async function GET(request: NextRequest) {
  logger.info("Testing all storage provider connections");
  
  try {
    // Get all storage providers from database
    const db = getDatabase();
    const providers = db.prepare(`SELECT * FROM storage_providers ORDER BY name`).all();
    
    // Test connection for each provider
    const manager = new StorageProviderManager();
    const results = await Promise.allSettled(
      providers.map(async (provider: any) => {
        try {
          // Get provider instance
          const providerInstance = await manager.getProvider(provider.id);
          
          // Test connection by listing root directory
          await providerInstance.list('/');
          
          // Connection successful
          return {
            id: provider.id,
            connected: true
          };
        } catch (error) {
          logger.error(`Failed to connect to storage provider ${provider.id} (${provider.name}):`, error);
          return {
            id: provider.id,
            connected: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      })
    );
    
    // Process results
    const processedResults = results.map((result) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          id: 'unknown',
          connected: false,
          error: result.reason || 'Failed to test connection'
        };
      }
    });
    
    return NextResponse.json({
      success: true,
      results: processedResults
    });
  } catch (error) {
    logger.error("Error testing storage provider connections:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "An unexpected error occurred" 
      },
      { status: 500 }
    );
  }
} 