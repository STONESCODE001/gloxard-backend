import crypto from "crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../config/env.js";

const ALLOWED_FOLDERS = ["avatars", "courses", "certifications", "resources"];

/**
 * Generate AWS S3 PUT presigned URL or dev fallback URL
 * @param {Object} params
 * @param {string} params.filename Original filename
 * @param {string} params.fileType File MIME type
 * @param {string} [params.folder] Target storage folder
 * @returns {Promise<{ uploadUrl: string, fileUrl: string, key: string, expiresIn: number }>}
 */
export const generatePresignedPutUrl = async ({ filename, fileType, folder }) => {
  const targetFolder = ALLOWED_FOLDERS.includes(folder) ? folder : "resources";
  
  const sanitizedFilename = (filename || "file")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .toLowerCase();
  
  const timestamp = Date.now();
  const randomUuid = crypto.randomBytes(4).toString("hex");
  const key = `${targetFolder}/${timestamp}-${randomUuid}_${sanitizedFilename}`;
  const expiresIn = 900; // 15 minutes in seconds

  const hasCredentials =
    Boolean(env.AWS_ACCESS_KEY_ID) && Boolean(env.AWS_SECRET_ACCESS_KEY);

  if (!hasCredentials) {
    console.warn(
      "[S3 DEV NOTICE] AWS credentials missing. Operating in mock presigned mode."
    );
    const mockHost = `http://localhost:${env.PORT || 3001}`;
    const uploadUrl = `${mockHost}/api/upload/mock-put/${key}`;
    const fileUrl = `https://${env.AWS_S3_BUCKET}.s3.amazonaws.com/${key}`;

    return {
      uploadUrl,
      fileUrl,
      key,
      expiresIn,
    };
  }

  const s3Client = new S3Client({
    region: env.AWS_REGION || "us-east-1",
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    },
  });

  const command = new PutObjectCommand({
    Bucket: env.AWS_S3_BUCKET,
    Key: key,
    ContentType: fileType,
  });

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn });
  const fileUrl = `https://${env.AWS_S3_BUCKET}.s3.${env.AWS_REGION || "us-east-1"}.amazonaws.com/${key}`;

  return {
    uploadUrl,
    fileUrl,
    key,
    expiresIn,
  };
};

export default { generatePresignedPutUrl };
