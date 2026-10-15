import QRCode from "qrcode";
import PDFDocument from "pdfkit";
import { uploadBuffer } from "./s3.js";
import { env } from "../config/env.js";

/**
 * Generate Sheybi-branded certificate PDF vector buffer
 * @param {Object} params
 * @param {string} params.certificateId
 * @param {string} params.studentName
 * @param {string} params.courseTitle
 * @param {string} [params.cohortName]
 * @param {Date|string} [params.issuedAt]
 * @param {string} [params.badge]
 * @returns {Promise<Buffer>}
 */
export const generateCertificatePdfBuffer = async ({
  certificateId,
  studentName,
  courseTitle,
  cohortName = "",
  issuedAt = new Date(),
  badge = "Gloxad Certified",
}) => {
  const frontendUrl = env.FRONTEND_ORIGIN || "http://localhost:3000";
  const verificationUrl = `${frontendUrl}/verify-certificate/${certificateId}`;

  // Generate QR code buffer (PNG)
  const qrBuffer = await QRCode.toBuffer(verificationUrl, {
    width: 140,
    margin: 1,
    color: {
      dark: "#111827",
      light: "#FFFFFF",
    },
  });

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        layout: "landscape",
        size: "A4", // 841.89 x 595.28
        margins: { top: 40, bottom: 40, left: 50, right: 50 },
      });

      const buffers = [];
      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", (err) => reject(err));

      const width = doc.page.width;
      const height = doc.page.height;

      // Draw background & decorative Sheybi border
      doc.rect(0, 0, width, height).fill("#FCF8FF");

      // Outer border
      doc.lineWidth(3).strokeColor("#4F46E5").rect(30, 30, width - 60, height - 60).stroke();

      // Inner thin border
      doc.lineWidth(1).strokeColor("#D9DDE8").rect(38, 38, width - 76, height - 76).stroke();

      // Header logo / title
      doc.fillColor("#4F46E5").fontSize(26).font("Helvetica-Bold").text("GLOXAD ACADEMY", 50, 70, {
        align: "center",
      });

      // Subtitle / Certificate type
      doc.fillColor("#6B7280").fontSize(13).font("Helvetica").text("CERTIFICATE OF COMPLETION", {
        align: "center",
      });

      doc.moveDown(1.5);

      // Presentation line
      doc.fillColor("#4B5563").fontSize(12).font("Helvetica").text("This is proudly presented to", {
        align: "center",
      });

      doc.moveDown(0.8);

      // Student Name
      doc.fillColor("#111827").fontSize(28).font("Helvetica-Bold").text(studentName, {
        align: "center",
      });

      doc.moveDown(0.8);

      // Text
      doc.fillColor("#4B5563").fontSize(12).font("Helvetica").text(
        "for successfully completing all coursework, projects, and assessments for",
        { align: "center" }
      );

      doc.moveDown(0.6);

      // Course Title
      doc.fillColor("#3525CD").fontSize(20).font("Helvetica-Bold").text(courseTitle, {
        align: "center",
      });

      if (cohortName) {
        doc.moveDown(0.3);
        doc.fillColor("#6B7280").fontSize(11).font("Helvetica").text(`Cohort: ${cohortName}`, {
          align: "center",
        });
      }

      // Bottom Section: Date & Signature on Left, QR Code on Right
      const dateStr = new Date(issuedAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      const bottomY = height - 160;

      // Left Column: Issue Date & Signee
      doc.fillColor("#111827").fontSize(10).font("Helvetica-Bold").text("DATE OF ISSUANCE", 70, bottomY);
      doc.fillColor("#4B5563").fontSize(10).font("Helvetica").text(dateStr, 70, bottomY + 15);

      doc.fillColor("#111827").fontSize(10).font("Helvetica-Bold").text("ACADEMIC DIRECTOR", 220, bottomY);
      doc.fillColor("#4B5563").fontSize(10).font("Helvetica").text("Dr. Samuel E. Stone", 220, bottomY + 15);
      doc.fillColor("#9CA3AF").fontSize(8).font("Helvetica").text("Gloxad Academy Board of Studies", 220, bottomY + 28);

      // Center Badge
      doc.rect(width / 2 - 60, bottomY, 120, 30).fillAndStroke("#F5F2FF", "#4F46E5");
      doc.fillColor("#3525CD").fontSize(9).font("Helvetica-Bold").text(badge, width / 2 - 55, bottomY + 10, {
        width: 110,
        align: "center",
      });

      // Right Column: QR Code + Certificate ID
      const qrSize = 80;
      const qrX = width - 180;
      const qrY = bottomY - 15;
      doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });

      doc.fillColor("#111827").fontSize(8).font("Helvetica-Bold").text(certificateId, qrX - 20, qrY + qrSize + 5, {
        width: qrSize + 40,
        align: "center",
      });
      doc.fillColor("#6B7280").fontSize(7).font("Helvetica").text("Scan to verify credential", qrX - 20, qrY + qrSize + 16, {
        width: qrSize + 40,
        align: "center",
      });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

/**
 * Generate PDF buffer and upload directly to S3 private bucket under `certificates/`
 * @param {Object} params
 * @returns {Promise<string>} S3 pdfKey
 */
export const generateAndUploadCertificatePdf = async ({
  certificateId,
  studentName,
  courseTitle,
  cohortName = "",
  issuedAt = new Date(),
  badge = "Gloxad Certified",
}) => {
  const pdfBuffer = await generateCertificatePdfBuffer({
    certificateId,
    studentName,
    courseTitle,
    cohortName,
    issuedAt,
    badge,
  });

  const pdfKey = `certificates/${certificateId}.pdf`;
  await uploadBuffer({
    key: pdfKey,
    buffer: pdfBuffer,
    contentType: "application/pdf",
  });

  return pdfKey;
};

export default {
  generateCertificatePdfBuffer,
  generateAndUploadCertificatePdf,
};
