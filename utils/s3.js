const { S3Client } = require("@aws-sdk/client-s3");
const { Upload } = require("@aws-sdk/lib-storage");
const sharp = require("sharp");
const crypto = require("crypto");
const path = require("path");
const sanitize = require("sanitize-filename");
const { promisify } = require("util");
const multer = require("multer");

const randomBytes = promisify(crypto.randomBytes);

const s3Client = new S3Client({
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  region: process.env.AWS_BUCKET_REGION,
});

// Upload image
exports.uploadImageToS3 = async (file, user) => {
  // Generate random file name
  const rawBytes = await randomBytes(16);
  const fileName = rawBytes.toString("hex");

  // File size limit (10MB)
  const maxImageSize = 10 * 1024 * 1024;
  if (file.size > maxImageSize) {
    throw new Error("Image file size exceeds the limit of 5MB");
  }

  // Optimize image to .webp
  const webpImageBuffer = await sharp(file.buffer).webp({ quality: 80 });

  // Upload image
  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: `uploads/${user}/images/${fileName}.webp`,
      Body: webpImageBuffer, // Buffer or stream
      ContentType: "image/webp",
      ServerSideEncryption: "AES256",
    },
  });

  // Perform the upload and return the url key
  return await upload.done();
};

// Upload document
exports.uploadDocumentToS3 = async (file, user) => {
  // Generate random file name
  const rawBytes = await randomBytes(16);
  const fileName = rawBytes.toString("hex");

  // Sanitize file name
  const sanitizedFileName = sanitize(file.originalname);

  // File size limit (5MB)
  const maxDocSize = 5 * 1024 * 1024;
  if (file.size > maxDocSize) {
    throw new Error("Document file size exceeds the limit of 2MB");
  }

  const extension = path.extname(sanitizedFileName) || ".pdf";

  // Create the Upload instance for document
  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: `uploads/${user}/documents/${fileName}${extension}`,
      Body: file.buffer, // Buffer of the document
      ContentType: file.mimetype, // MIME type of the document
      ServerSideEncryption: "AES256", // Encryption for security
    },
  });

  // Perform the upload and return the url key
  return await upload.done();
};

// Allowed file types
const allowedMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "video/mp4",
  "video/mkv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "text/plain", // .txt
];

// Memory storage
const storage = multer.memoryStorage();

// File filter function
const fileFilter = (req, file, cb) => {
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true); // Accept the file
  } else {
    cb(new Error("Unsupported file type"), false); // Reject the file
  }
};

// Configure multer
exports.upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 1024 * 1024 * 20000, files: 4 },
});
