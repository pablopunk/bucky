import { NextResponse } from "next/server";
import { createStorageProvider, getStorageProvider, getDatabase } from "@/lib/db";
import type { StorageProvider, StorageProviderCredentials } from "@/lib/db";
import { StorageProviderManager } from "@/lib/storage";
import { z } from "zod";
import { prepare } from "@/lib/db";

const s3CredentialsSchema = z.object({
  type: z.literal("s3"),
  accessKeyId: z.string().min(1),
  secretAccessKey: z.string().min(1),
  bucket: z.string().min(1),
  region: z.string().optional(),
  endpoint: z.string().optional(),
});

const b2CredentialsSchema = z.object({
  type: z.literal("b2"),
  applicationKeyId: z.string().min(1),
  applicationKey: z.string().min(1),
  bucket: z.string().min(1),
});

const storjCredentialsSchema = z.object({
  type: z.literal("storj"),
  accessKey: z.string().min(1),
  secretKey: z.string().min(1),
  bucket: z.string().min(1),
  endpoint: z.string().optional().default("https://gateway.storjshare.io"),
});

const storageProviderSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["s3", "b2", "storj"]),
  credentials: z.discriminatedUnion("type", [
    s3CredentialsSchema,
    b2CredentialsSchema,
    storjCredentialsSchema,
  ]),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validatedData = storageProviderSchema.parse(body);

    // Validate credentials by attempting to create a provider
    const manager = new StorageProviderManager();
    manager.create(validatedData.credentials);

    // If validation succeeds, save to database
    const id = createStorageProvider({
      name: validatedData.name,
      type: validatedData.type,
      config: JSON.stringify(validatedData.credentials),
    });

    return NextResponse.json({ id });
  } catch (error) {
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

    // Validate credentials by attempting to create a provider
    const manager = new StorageProviderManager();
    manager.create(validatedData.credentials);

    // If validation succeeds, update in database
    const db = getDatabase();
    prepare(
      `UPDATE storage_providers 
       SET name = ?, type = ?, config = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).run(
      validatedData.name,
      validatedData.type,
      JSON.stringify(validatedData.credentials),
      id
    );

    return NextResponse.json({ success: true });
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

    const db = getDatabase();
    prepare(`DELETE FROM storage_providers WHERE id = ?`).run(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting storage provider:", error);
    return NextResponse.json(
      { error: "Failed to delete storage provider" },
      { status: 500 }
    );
  }
} 