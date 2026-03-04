import { Context } from ".keystone/types";
import express, { Router, Request, Response } from "express";
import { uploadProductImage } from "../../../lib/product-image-storage";

type UploadProductImageRequest = {
  dataUrl?: string;
  productName?: string;
  productKey?: string;
  imageIndex?: number;
};

export default (router: Router, _ctx: Context) => {
  router.use("/uploads/product-image", express.json({ limit: "15mb" }));

  router.post(
    "/uploads/product-image",
    async (
      req: Request<unknown, unknown, UploadProductImageRequest>,
      res: Response,
    ) => {
      try {
        const { dataUrl, productName, productKey, imageIndex } = req.body ?? {};

        if (
          !dataUrl ||
          typeof dataUrl !== "string" ||
          !dataUrl.startsWith("data:image/")
        ) {
          return res
            .status(400)
            .json({ error: "Invalid image payload. Expected dataUrl image." });
        }

        if (!productName || typeof productName !== "string") {
          return res.status(400).json({ error: "productName is required." });
        }

        const uploaded = await uploadProductImage({
          dataUrl,
          productName,
          productKey: productKey ?? `${Date.now()}`,
          imageIndex: Number.isFinite(imageIndex) ? Number(imageIndex) : 0,
        });

        return res.status(201).json({ image: uploaded });
      } catch (error) {
        return res.status(500).json({
          error:
            error instanceof Error
              ? error.message
              : "Failed to upload product image.",
        });
      }
    },
  );
};
