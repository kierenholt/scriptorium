const { GoogleAuth } = require('google-auth-library');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../functions/.env') });

const os = require('os');
const fs = require('fs');

const PROJECT_ID = process.env.GCP_PROJECT_ID || 'scriptorium-503507';
const REGION = 'EUROPE-WEST2'; // Strictly enforced europe-west2 (London)
const BUCKET_NAME = process.env.AI_UPLOADS_BUCKET || 'scriptorium-uploads-503507';

async function getAccessToken() {
  const credPath = path.join(os.homedir(), '.config/gcloud/application_default_credentials.json');
  if (fs.existsSync(credPath)) {
    try {
      const creds = JSON.parse(fs.readFileSync(credPath, 'utf8'));
      if (creds.client_id && creds.refresh_token) {
        const body = new URLSearchParams({
          client_id: creds.client_id,
          client_secret: creds.client_secret,
          refresh_token: creds.refresh_token,
          grant_type: 'refresh_token',
        });
        const res = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.access_token) {
            return data.access_token;
          }
        }
      }
    } catch {
      // Fall through
    }
  }

  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
  const client = await auth.getClient();
  const tokenRes = await client.getAccessToken();
  return tokenRes.token;
}

async function provisionBucket() {
  console.log(`[Storage Provisioning] Target GCP Project: ${PROJECT_ID}`);
  console.log(`[Storage Provisioning] Target Region: ${REGION} (europe-west2)`);
  console.log(`[Storage Provisioning] Target Bucket: ${BUCKET_NAME}`);

  const token = await getAccessToken();

  // 1. Check if bucket already exists
  const checkRes = await fetch(`https://storage.googleapis.com/storage/v1/b/${BUCKET_NAME}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (checkRes.ok) {
    const existing = await checkRes.json();
    console.log(`[Storage Provisioning] Bucket "${BUCKET_NAME}" already exists in location "${existing.location}".`);
    return existing;
  }

  if (checkRes.status !== 404) {
    const err = await checkRes.text();
    throw new Error(`Failed to check bucket existence (${checkRes.status}): ${err}`);
  }

  // 2. Create the bucket in europe-west2
  console.log(`[Storage Provisioning] Creating new bucket "${BUCKET_NAME}" in "${REGION}"...`);
  const createRes = await fetch(`https://storage.googleapis.com/storage/v1/b?project=${PROJECT_ID}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: BUCKET_NAME,
      location: REGION,
      storageClass: 'STANDARD',
      iamConfiguration: {
        uniformBucketLevelAccess: {
          enabled: true,
        },
      },
    }),
  });

  const data = await createRes.json();
  if (!createRes.ok) {
    throw new Error(`Failed to create bucket (${createRes.status}): ${JSON.stringify(data)}`);
  }

  console.log(`[Storage Provisioning] Successfully created bucket: ${data.name} in location: ${data.location}`);
  return data;
}

provisionBucket()
  .then((bucket) => {
    console.log(`SUCCESS: Bucket ready -> ${bucket.name}`);
    process.exit(0);
  })
  .catch((err) => {
    console.error(`ERROR: ${err.message}`);
    process.exit(1);
  });
