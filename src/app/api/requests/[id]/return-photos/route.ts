import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/rbac";
import {
  apiSuccess,
  BadRequestError,
  handleApiError,
} from "@/lib/errors";
import { getStorageProvider, parseDataUrl } from "@/lib/storage/storage";
import {
  photoAngleSchema,
  uploadRequestPhotoJsonSchema,
} from "@/lib/validators/schemas";
import { uploadReturnPhoto } from "@/services/borrowing.service";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAuth();
    const { id: requestId } = await context.params;
    const contentType = request.headers.get("content-type") ?? "";
    const storage = getStorageProvider();

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");
      const requestItemId = String(formData.get("requestItemId") ?? "").trim();
      const angle = photoAngleSchema.parse(formData.get("angle"));

      if (!requestItemId) {
        throw new BadRequestError("Missing 'requestItemId' form field");
      }
      if (!(file instanceof File)) {
        throw new BadRequestError("Missing 'file' image in form data");
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const uploaded = await storage.uploadImage({
        buffer,
        mimeType: file.type || "image/jpeg",
        filename: file.name || `${angle.toLowerCase()}.jpg`,
        folder: `requests/${requestId}/return`,
      });

      const photo = await uploadReturnPhoto(actor, requestId, {
        requestItemId,
        angle,
        storageKey: uploaded.storageKey,
        url: uploaded.url,
      });
      return apiSuccess(photo, undefined, 201);
    }

    const body = await request.json();
    const parsed = uploadRequestPhotoJsonSchema.parse(body);

    let storageKey = parsed.storageKey ?? "";
    let url = parsed.url ?? "";

    if (parsed.dataUrl) {
      const { buffer, mimeType } = parseDataUrl(parsed.dataUrl);
      const uploaded = await storage.uploadImage({
        buffer,
        mimeType,
        filename: parsed.filename || `${parsed.angle.toLowerCase()}.jpg`,
        folder: `requests/${requestId}/return`,
      });
      storageKey = uploaded.storageKey;
      url = uploaded.url;
    } else if (!storageKey && url) {
      storageKey = url.replace(/^\/+/, "");
    }

    const photo = await uploadReturnPhoto(actor, requestId, {
      requestItemId: parsed.requestItemId,
      angle: parsed.angle,
      storageKey,
      url,
    });
    return apiSuccess(photo, undefined, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
