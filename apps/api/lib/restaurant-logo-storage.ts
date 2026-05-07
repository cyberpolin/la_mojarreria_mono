import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

export const uploadRestaurantLogo = async ({
  dataUrl,
  restaurantName,
}: {
  dataUrl: string;
  restaurantName: string;
}) => {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const baseFolder = process.env.CLOUDINARY_API_FOLDER || "mojarreria";
  const restaurantSlug = slugify(restaurantName || "restaurant");
  const folder = `${baseFolder}/mojarreria/restaurant/${yyyy}/${mm}/${restaurantSlug}`;
  const publicId = `${restaurantSlug}__logo__${Date.now()}`;

  const uploaded = await cloudinary.uploader.upload(dataUrl, {
    folder,
    public_id: publicId,
    resource_type: "image",
    overwrite: true,
    unique_filename: false,
  });

  return {
    publicId: uploaded.public_id,
    secureUrl: uploaded.secure_url,
    width: uploaded.width,
    height: uploaded.height,
    bytes: uploaded.bytes,
    format: uploaded.format,
  };
};
