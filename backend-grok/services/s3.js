// services/s3.js — S3 PDF Storage
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const config = require('../config');

let s3 = null;

function getS3() {
  if (s3) return s3;
  if (!config.s3.bucket || !config.s3.accessKeyId) {
    console.warn('[S3] Not configured — PDFs will not be uploaded. Set S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY in .env');
    return null;
  }
  s3 = new S3Client({
    region: config.s3.region,
    credentials: {
      accessKeyId: config.s3.accessKeyId,
      secretAccessKey: config.s3.secretAccessKey,
    },
  });
  console.log(`[S3] Connected to bucket: ${config.s3.bucket} (${config.s3.region})`);
  return s3;
}

async function uploadPdf(reportId, pdfBuffer) {
  const client = getS3();
  if (!client) return null;

  const key = `reports/${reportId}.pdf`;

  await client.send(new PutObjectCommand({
    Bucket: config.s3.bucket,
    Key: key,
    Body: pdfBuffer,
    ContentType: 'application/pdf',
    ContentDisposition: `attachment; filename="Skin_Report_${reportId}.pdf"`,
  }));

  const url = `https://${config.s3.bucket}.s3.${config.s3.region}.amazonaws.com/${key}`;
  console.log(`[S3] Uploaded ${key} (${(pdfBuffer.length / 1024).toFixed(1)}KB)`);
  return { key, url };
}

async function getPdf(reportId) {
  const client = getS3();
  if (!client) return null;

  const key = `reports/${reportId}.pdf`;
  const resp = await client.send(new GetObjectCommand({
    Bucket: config.s3.bucket,
    Key: key,
  }));

  const chunks = [];
  for await (const chunk of resp.Body) chunks.push(chunk);
  return Buffer.concat(chunks);
}

module.exports = { uploadPdf, getPdf };
