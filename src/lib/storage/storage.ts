import crypto from "crypto";
import path from "path";
import { promises as fs } from "fs";
import { createClient } from "@supabase/supabase-js";
import { BadRequestError } from "@/lib/errors";

export interface UploadedObject {
  storageKey: string;
  url: string;
}

export interface StorageProvider {
  readonly name: string;
  uploadImage(params: {
    buffer: Buffer;
    mimeType: string;
    filename: string;
    folder?: string;
  }): Promise<UploadedObject>;
}

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/svg+xml": ".svg",
};

function sanitizeFolder(folder?: string): string {
  if (!folder) return "general";
  return folder.replace(/[^a-zA-Z0-9/_-]/g, "").replace(/^\/+|\/+$/g, "") || "general";
}

function validateImageBuffer(buffer: Buffer, mimeType: string): string {
  if (!buffer || buffer.length === 0) {
    throw new BadRequestError("Uploaded file is empty");
  }
  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new BadRequestError("Image exceeds maximum allowed size of 5MB");
  }
  const normalizedMime = mimeType.toLowerCase().split(";")[0].trim();
  const ext = ALLOWED_MIME_TYPES[normalizedMime];
  if (!ext) {
    throw new BadRequestError(
      `Unsupported image format '${mimeType}'. Allowed formats: JPEG, PNG, WEBP, GIF, SVG`
    );
  }
  return ext;
}

class SupabaseStorageProvider implements StorageProvider {
  public readonly name = "supabase";
  private readonly url: string;
  private readonly serviceKey: string;
  private readonly bucket: string;

  constructor(url: string, serviceKey: string, bucket: string) {
    this.url = url;
    this.serviceKey = serviceKey;
    this.bucket = bucket;
  }

  async uploadImage(params: {
    buffer: Buffer;
    mimeType: string;
    filename: string;
    folder?: string;
  }): Promise<UploadedObject> {
    const ext = validateImageBuffer(params.buffer, params.mimeType);
    const folder = sanitizeFolder(params.folder);
    const uniqueName = `${Date.now()}-${crypto.randomUUID()}${ext}`;
    const storageKey = `${folder}/${uniqueName}`;

    const supabase = createClient(this.url, this.serviceKey, {
      auth: { persistSession: false },
    });

    const { error } = await supabase.storage
      .from(this.bucket)
      .upload(storageKey, params.buffer, {
        contentType: params.mimeType,
        upsert: false,
      });

    if (error) {
      throw new BadRequestError(`Storage upload failed: ${error.message}`);
    }

    const { data: publicData } = supabase.storage
      .from(this.bucket)
      .getPublicUrl(storageKey);

    return {
      storageKey,
      url: publicData.publicUrl,
    };
  }
}

class LocalStorageProvider implements StorageProvider {
  public readonly name = "local";

  async uploadImage(params: {
    buffer: Buffer;
    mimeType: string;
    filename: string;
    folder?: string;
  }): Promise<UploadedObject> {
    const ext = validateImageBuffer(params.buffer, params.mimeType);
    const folder = sanitizeFolder(params.folder);
    const uniqueName = `${Date.now()}-${crypto.randomUUID()}${ext}`;
    const storageKey = `${folder}/${uniqueName}`;

    const uploadsRoot = path.join(process.cwd(), "public", "uploads");
    const targetPath = path.join(uploadsRoot, storageKey);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, params.buffer);

    return {
      storageKey,
      url: `/uploads/${storageKey.replace(/\\/g, "/")}`,
    };
  }
}

export function getStorageProvider(): StorageProvider {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim() || "lab-item-photos";

  if (supabaseUrl && serviceKey) {
    return new SupabaseStorageProvider(supabaseUrl, serviceKey, bucket);
  }
  return new LocalStorageProvider();
}

export function parseDataUrl(dataUrl: string): {
  buffer: Buffer;
  mimeType: string;
} {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new BadRequestError("Invalid base64 data URL format");
  }
  const mimeType = match[1];
  const base64Data = match[2];
  const buffer = Buffer.from(base64Data, "base64");
  return { buffer, mimeType };
}
