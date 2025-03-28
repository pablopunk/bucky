import { NextResponse } from "next/server";
import { createStorageProvider, getStorageProvider, getDatabase } from "@/lib/db";
import { StorageProviderManager } from "@/lib/storage";
import { z } from "zod";
import { prepare } from "@/lib/db";

const storjCredentialsSchema = z.object({
  type: z.literal("storj"),
  bucket: z.string().min(1),
  accessKey: z.string().min(1),
  secretKey: z.string().min(1),
  endpoint: z.string().optional().default("https://gateway.storjshare.io"),
});

const storageProviderSchema = z.object({
  name: z.string().min(1),
  type: z.literal("storj"),
  credentials: storjCredentialsSchema,
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validatedData = storageProviderSchema.parse(body);

    // Validate credentials by attempting to create a provider and test connection
    const manager = new StorageProviderManager();
    
    try {
      // Use createStorageProvider which validates the connection
      const id = await manager.createStorageProvider(
        validatedData.name,
        validatedData.type,
        validatedData.credentials
      );
      
      return NextResponse.json({ id });
    } catch (error) {
      console.error("Storage provider validation error:", error);
      if (error instanceof Error) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }
      throw error;
    }
  } catch (error) {
    console.error("Storage provider creation error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Failed to create storage provider" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (id) {
      const provider = getStorageProvider(id);
      if (!provider) {
        return NextResponse.json(
          { error: "Storage provider not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(provider);
    }

    const db = getDatabase();
    const providers = prepare(
      `SELECT id, name, type, created_at, updated_at FROM storage_providers`
    ).all();

    return NextResponse.json(providers);
  } catch (error) {
    console.error("Error fetching storage providers:", error);
    return NextResponse.json(
      { error: "Failed to fetch storage providers" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Provider ID is required" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validatedData = storageProviderSchema.parse(body);

    // Update the provider using the manager
    const manager = new StorageProviderManager();
    
    try {
      await manager.updateStorageProvider(id, {
        name: validatedData.name,
        config: validatedData.credentials
      });
      
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error("Storage provider update error:", error);
      if (error instanceof Error) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Error updating storage provider:", error);
    return NextResponse.json(
      { error: "Failed to update storage provider" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Provider ID is required" },
        { status: 400 }
      );
    }

    const manager = new StorageProviderManager();
    await manager.deleteStorageProvider(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting storage provider:", error);
    return NextResponse.json(
      { error: "Failed to delete storage provider" },
      { status: 500 }
    );
  }
} 