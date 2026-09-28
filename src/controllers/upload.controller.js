import { generatePresignedPutUrl } from "../utils/s3.js";

/**
 * POST /api/upload/presigned-url
 * Generate AWS S3 PUT presigned URL for direct client-side upload
 */
export const getPresignedUrl = async (req, res, next) => {
  try {
    const { filename, fileType, folder } = req.body;

    if (!filename || typeof filename !== "string" || !filename.trim() ||
        !fileType || typeof fileType !== "string" || !fileType.trim()) {
      return res.status(400).json({
        error: "Filename and fileType are required",
      });
    }

    const presignedData = await generatePresignedPutUrl({
      filename: filename.trim(),
      fileType: fileType.trim(),
      folder: folder ? String(folder).trim() : undefined,
    });

    return res.status(200).json(presignedData);
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/upload/mock-put/*
 * Developer fallback endpoint for testing direct uploads without live AWS S3 credentials
 */
export const mockUpload = async (req, res) => {
  return res.status(200).json({
    message: "Mock S3 PUT upload successful",
  });
};

export default {
  getPresignedUrl,
  mockUpload,
};
