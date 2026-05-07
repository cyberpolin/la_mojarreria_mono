import { Context } from ".keystone/types";
import express, { Router, Request, Response } from "express";
import { uploadRestaurantLogo } from "../../../lib/restaurant-logo-storage";

type UploadRestaurantLogoRequest = {
  dataUrl?: string;
  restaurantName?: string;
};

export default (router: Router, _ctx: Context) => {
  router.use("/uploads/restaurant-logo", express.json({ limit: "15mb" }));

  router.post(
    "/uploads/restaurant-logo",
    async (
      req: Request<unknown, unknown, UploadRestaurantLogoRequest>,
      res: Response,
    ) => {
      try {
        const { dataUrl, restaurantName } = req.body ?? {};

        if (
          !dataUrl ||
          typeof dataUrl !== "string" ||
          !dataUrl.startsWith("data:image/")
        ) {
          return res
            .status(400)
            .json({ error: "Invalid image payload. Expected dataUrl image." });
        }

        if (!restaurantName || typeof restaurantName !== "string") {
          return res.status(400).json({ error: "restaurantName is required." });
        }

        const uploaded = await uploadRestaurantLogo({
          dataUrl,
          restaurantName,
        });

        return res.status(201).json({ image: uploaded });
      } catch (error) {
        return res.status(500).json({
          error:
            error instanceof Error
              ? error.message
              : "Failed to upload restaurant logo.",
        });
      }
    },
  );
};
