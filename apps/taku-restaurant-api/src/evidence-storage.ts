import { v2 as cloudinary } from "cloudinary";
import { config } from "./config.js";
import { ApiError } from "./http.js";

export function isCloudinaryConfigured() {
  return Boolean(
    config.cloudinary.cloudName &&
      config.cloudinary.apiKey &&
      config.cloudinary.apiSecret,
  );
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function uploadCloseEvidenceImage(params: {
  dataUrl: string;
  restaurantSlug: string;
  date: string;
  kind: string;
  deviceId: string;
}) {
  if (!isCloudinaryConfigured()) {
    throw new ApiError({
      status: 503,
      code: "STORAGE_NOT_CONFIGURED",
      message: "Cloudinary no esta configurado en el API.",
    });
  }
  if (!params.dataUrl.startsWith("data:image/")) {
    throw new ApiError({
      status: 400,
      code: "VALIDATION_ERROR",
      message: "La evidencia debe ser una imagen.",
    });
  }

  cloudinary.config({
    cloud_name: config.cloudinary.cloudName,
    api_key: config.cloudinary.apiKey,
    api_secret: config.cloudinary.apiSecret,
  });

  const [year, month] = params.date.split("-");
  const restaurantSlug = slugify(params.restaurantSlug || "restaurant");
  const folder = `${config.cloudinary.folder}/taku-restaurant/closes/${restaurantSlug}/${year}/${month}/${params.date}`;
  const publicId = `${slugify(params.kind)}__${slugify(params.deviceId)}__${Date.now()}`;

  const uploaded = await cloudinary.uploader.upload(params.dataUrl, {
    folder,
    public_id: publicId,
    resource_type: "image",
    overwrite: false,
    unique_filename: false,
  });

  return {
    publicId: uploaded.public_id,
    url: uploaded.secure_url,
  };
}
