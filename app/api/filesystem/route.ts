import { NextResponse } from "next/server"
import path from "path"
import fs from "fs"
import { exec } from "child_process"
import util from "util"
import { Database } from "bun:sqlite"

const execPromise = util.promisify(exec)

// Helper to check if path traversal attempt
function isPathTraversal(targetPath: string): boolean {
  const normalizedPath = path.normalize(targetPath)
  return normalizedPath.includes("..")
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type") // "local" or "remote"
    const currentPath = searchParams.get("path") || "/"
    const jobId = searchParams.get("jobId")
    const debug = searchParams.get("debug") === "true"
    
    // Validate required parameters
    if (!type || !jobId) {
      return NextResponse.json(
        { error: "Missing required parameters: type, jobId" },
        { status: 400 }
      )
    }

    // Check for path traversal attempt
    if (isPathTraversal(currentPath)) {
      return NextResponse.json(
        { error: "Invalid path" },
        { status: 400 }
      )
    }
    
    // Connect to the database using Bun's SQLite
    const db = new Database(path.join(process.cwd(), "data", "bucky.db"))
    
    // Get the job details to access its source and remote paths
    const job = db.query("SELECT * FROM backup_jobs WHERE id = ?").get(jobId) as any
    
    if (!job) {
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404 }
      )
    }

    if (type === "local") {
      // For local filesystem
      let basePath = job.source_path
      let fullPath = path.resolve(basePath, currentPath === "/" ? "" : currentPath)
      
      // Ensure we're still within the source path directory
      if (!fullPath.startsWith(basePath)) {
        return NextResponse.json(
          { error: "Path outside of source directory" },
          { status: 400 }
        )
      }

      try {
        const stats = await fs.promises.stat(fullPath)
        
        if (stats.isFile()) {
          return NextResponse.json({
            type: "file",
            name: path.basename(fullPath),
            path: path.relative(basePath, fullPath) || "/",
            size: stats.size,
            modified: stats.mtime
          })
        }
        
        const files = await fs.promises.readdir(fullPath, { withFileTypes: true })
        
        const contents = await Promise.all(
          files.map(async (dirent) => {
            const filePath = path.join(fullPath, dirent.name)
            const stats = await fs.promises.stat(filePath)
            
            return {
              name: dirent.name,
              type: dirent.isDirectory() ? "directory" : "file",
              path: path.relative(basePath, filePath),
              size: stats.size,
              modified: stats.mtime
            }
          })
        )
        
        return NextResponse.json({
          type: "directory",
          path: path.relative(basePath, fullPath) || "/",
          parent: path.dirname(path.relative(basePath, fullPath) || "/") || "/",
          contents
        })
      } catch (err) {
        console.error("Error accessing local filesystem:", err)
        return NextResponse.json(
          { error: "Failed to access local filesystem" },
          { status: 500 }
        )
      }
    } else if (type === "remote") {
      // For remote filesystem
      // First check if we have storage provider for this job
      const storage = db.query(
        "SELECT * FROM storage_providers WHERE id = ?"
      ).get(job.storage_provider_id) as any
      
      if (!storage) {
        return NextResponse.json(
          { error: "Storage provider not found" },
          { status: 404 }
        )
      }

      try {
        // Use rclone to list remote files
        // Generate a temporary rclone config
        const configPath = path.join(process.cwd(), "temp", `rclone_${jobId}.conf`)
        
        // Create config based on provider type
        let rcloneConfig = ""
        let remotePath = job.remote_path || "/"
        let bucket = ""
        
        // Parse storage provider config (stored as JSON string in config column)
        const config = storage.config ? JSON.parse(storage.config) : {}
        
        if (debug) {
          // Sanitize sensitive data before logging
          const sanitizedConfig = { ...config }
          if (sanitizedConfig.secretKey) sanitizedConfig.secretKey = "***MASKED***"
          if (sanitizedConfig.secret_key) sanitizedConfig.secret_key = "***MASKED***"
          console.log(`Remote filesystem debug - Provider type: ${storage.type}, Config:`, sanitizedConfig, `Job remote path: ${remotePath}`)
        }
        
        if (storage.type === "s3") {
          bucket = config.bucket || ""
          rcloneConfig = `
[temp-remote]
type = s3
provider = ${config.provider || "AWS"}
access_key_id = ${config.access_key || ""}
secret_access_key = ${config.secret_key || ""}
endpoint = ${config.endpoint || ""}
region = ${config.region || ""}
`
        } else if (storage.type === "b2") {
          bucket = config.bucket || ""
          rcloneConfig = `
[temp-remote]
type = b2
account = ${config.account_id || ""}
key = ${config.application_key || ""}
`
        } else if (storage.type === "storj") {
          bucket = config.bucket || ""
          rcloneConfig = `
[temp-remote]
type = s3
provider = Storj
access_key_id = ${config.accessKey || ""}
secret_access_key = ${config.secretKey || ""}
endpoint = gateway.storjshare.io
location_constraint = 
acl = private
`
        }
        
        // Validation check - if we don't have a bucket, return an error
        if (!bucket) {
          return NextResponse.json(
            { error: "Storage provider bucket not configured", debug: { config } },
            { status: 400 }
          )
        }
        
        // Ensure temp directory exists
        await fs.promises.mkdir(path.join(process.cwd(), "temp"), { recursive: true })
        
        // Write config to file
        await fs.promises.writeFile(configPath, rcloneConfig)
        
        // Determine the remote path, ensure it starts with a slash
        const cleanRemotePath = (
          path.join(
            remotePath.startsWith("/") ? remotePath : `/${remotePath}`,
            currentPath === "/" ? "" : currentPath
          ).replace(/\\/g, "/")
        )
        
        console.log(`Remote filesystem debug - Executing rclone: temp-remote:${bucket}${cleanRemotePath}`)
        
        // First try listing with debug enabled to get more info
        if (debug) {
          try {
            const debugCmd = `rclone lsjson --config=${configPath} --dump headers --dump bodies --dump auth --verbose temp-remote:${bucket}${cleanRemotePath}`
            const debugOutput = await execPromise(debugCmd).catch(e => ({ stderr: e.message || "Command failed" }))
            console.log("Remote filesystem debug output:", debugOutput.stderr || "No debug output")
          } catch (debugErr) {
            console.error("Error during debug run:", debugErr)
          }
        }
        
        // Now run the actual command for retrieving files
        const rcloneCmd = `rclone lsjson --config=${configPath} temp-remote:${bucket}${cleanRemotePath}`
        console.log(`Executing rclone command: ${rcloneCmd}`)
        
        const { stdout } = await execPromise(rcloneCmd)
        
        // Clean up temp config file
        await fs.promises.unlink(configPath)
        
        if (debug) {
          // Return connection diagnostic info in debug mode
          return NextResponse.json({
            success: true,
            diagnostic: {
              providerType: storage.type,
              bucket: bucket,
              configuredEndpoint: config.endpoint || "gateway.storjshare.io",
              remotePath: cleanRemotePath,
              hasAccess: true
            }
          })
        }
        
        // Parse the output
        const files = JSON.parse(stdout)
        
        const contents = files.map((file: any) => ({
          name: file.Name,
          type: file.IsDir ? "directory" : "file",
          path: path.join(currentPath, file.Name).replace(/\\/g, "/"),
          size: file.Size,
          modified: file.ModTime
        }))
        
        return NextResponse.json({
          type: "directory",
          path: currentPath,
          parent: path.dirname(currentPath) === "." ? "/" : path.dirname(currentPath),
          contents
        })
      } catch (err) {
        console.error("Error accessing remote filesystem:", err)
        
        // Parse the error message for common issues
        const errorMessage = err instanceof Error ? err.message : String(err)
        const errorDetail = {
          message: "Failed to access remote filesystem",
          cause: errorMessage,
          config: {}
        }
        
        // Mask sensitive data
        if (storage.config) {
          try {
            const parsedConfig = JSON.parse(storage.config)
            errorDetail.config = {
              bucket: parsedConfig.bucket || "not_set",
              provider: parsedConfig.provider || "not_set",
              endpoint: parsedConfig.endpoint || "not_set",
              hasAccessKey: Boolean(parsedConfig.accessKey || parsedConfig.access_key),
              hasSecretKey: Boolean(parsedConfig.secretKey || parsedConfig.secret_key),
              region: parsedConfig.region || "not_set"
            }
          } catch (e) {
            errorDetail.config = { parseError: "Could not parse config" }
          }
        }
        
        if (errorMessage.includes("AccessDenied") || errorMessage.includes("403")) {
          return NextResponse.json(
            { 
              error: "Access denied to remote storage. Your credentials don't have permission to access this bucket or path.",
              details: errorDetail
            },
            { status: 403 }
          )
        } else if (errorMessage.includes("InvalidAccessKeyId")) {
          return NextResponse.json(
            { 
              error: "Invalid access credentials. The access key ID you provided does not exist in our records.",
              details: errorDetail
            },
            { status: 401 }
          )
        } else if (errorMessage.includes("NoSuchBucket")) {
          return NextResponse.json(
            { 
              error: `Bucket '${errorDetail.config.bucket}' not found. Please verify the bucket name.`,
              details: errorDetail
            },
            { status: 404 }
          )
        }
        
        return NextResponse.json(
          { 
            error: "Failed to access remote filesystem. See server logs for details.",
            details: errorDetail
          },
          { status: 500 }
        )
      }
    } else {
      return NextResponse.json(
        { error: "Invalid type parameter. Must be 'local' or 'remote'" },
        { status: 400 }
      )
    }
  } catch (err) {
    console.error("Error in filesystem API:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
} 