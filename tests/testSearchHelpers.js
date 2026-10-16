const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const dotenv = require('dotenv');
const { GoogleAuth } = require('google-auth-library');

dotenv.config({ path: path.join(__dirname, '../functions/.env') });

const MINIMAL_PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000102 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n182\n%%EOF\n',
  'binary'
);

const BUCKET_NAME = process.env.AI_SEARCHABLE_BUCKET || 'scriptorium-searchable';
const PROJECT_ID = process.env.GCP_PROJECT_ID || 'scriptorium-503507';
const PROJECT_NUMBER = process.env.VERTEX_SEARCH_PROJECT_NUMBER || '559751767113';
const DATASTORE_ID = process.env.VERTEX_SEARCH_DATASTORE_ID || 'talent-search-connector_1785766300992_gcs_store';
const LOCATION = process.env.VERTEX_SEARCH_LOCATION || 'eu';

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
          grant_type: 'refresh_token'
        });
        const res = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString()
        });
        if (res.ok) {
          const data = await res.json();
          if (data.access_token) {
            return data.access_token;
          }
        }
      }
    } catch {
      // Fall through to GoogleAuth
    }
  }

  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform']
  });
  const client = await auth.getClient();
  const tokenRes = await client.getAccessToken();
  return tokenRes.token;
}

/**
 * Creates and uploads a test document with a unique random ID to GCS and registers it in metadata.jsonl.
 */
async function uploadTestDocument({ testDocId, name, role, skills, location = 'London', years_experience = 5 }) {
  const token = await getAccessToken();

  // 1. Upload dummy PDF to GCS
  const pdfStoragePath = `cvs/${testDocId}.pdf`;
  const pdfUploadUrl = `https://storage.googleapis.com/upload/storage/v1/b/${BUCKET_NAME}/o?uploadType=media&name=${encodeURIComponent(pdfStoragePath)}`;
  const pdfRes = await fetch(pdfUploadUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/pdf'
    },
    body: MINIMAL_PDF
  });

  if (!pdfRes.ok) {
    throw new Error(`Failed to upload test PDF to GCS: ${pdfRes.statusText}`);
  }

  // 2. Read existing metadata.jsonl
  const readUrl = `https://storage.googleapis.com/storage/v1/b/${BUCKET_NAME}/o/metadata.jsonl?alt=media`;
  const getRes = await fetch(readUrl, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const currentContent = await getRes.text();

  // 3. Append new test document entry
  const newEntry = {
    id: testDocId,
    content: {
      mimeType: 'application/pdf',
      uri: `gs://${BUCKET_NAME}/${pdfStoragePath}`
    },
    jsonData: JSON.stringify({
      name,
      role,
      skills,
      location,
      years_experience,
      searchable: true,
      vetted: true
    })
  };

  const updatedContent = currentContent.trim() + '\n' + JSON.stringify(newEntry) + '\n';

  // 4. Save updated metadata.jsonl
  const uploadUrl = `https://storage.googleapis.com/upload/storage/v1/b/${BUCKET_NAME}/o?uploadType=media&name=metadata.jsonl`;
  const metaRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: updatedContent
  });

  if (!metaRes.ok) {
    throw new Error(`Failed to update metadata.jsonl: ${metaRes.statusText}`);
  }

  return { originalMetadataContent: currentContent };
}

/**
 * Triggers Discovery Engine import and polls until the operation completes.
 */
async function triggerDiscoveryEngineImport({ maxWaitMs = 120000 } = {}) {
  const token = await getAccessToken();

  const importUrl = `https://${LOCATION}-discoveryengine.googleapis.com/v1/projects/${PROJECT_NUMBER}/locations/${LOCATION}/collections/default_collection/dataStores/${DATASTORE_ID}/branches/0/documents:import`;
  const importPayload = {
    gcsSource: {
      inputUris: [`gs://${BUCKET_NAME}/metadata.jsonl`],
      dataSchema: 'document'
    },
    reconciliationMode: 'INCREMENTAL'
  };

  console.log(`[Discovery Engine] Initiating document import on datastore: ${DATASTORE_ID}`);
  const importRes = await fetch(importUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'x-goog-user-project': PROJECT_ID
    },
    body: JSON.stringify(importPayload)
  });

  const importData = await importRes.json();
  if (!importRes.ok) {
    throw new Error(`Import API error (${importRes.status}): ${JSON.stringify(importData)}`);
  }

  if (importData.name) {
    const opUrl = `https://${LOCATION}-discoveryengine.googleapis.com/v1/${importData.name}`;
    console.log(`[Discovery Engine] Import operation started: ${importData.name}. Polling for completion...`);
    const startTime = Date.now();
    let pollCount = 0;
    while (Date.now() - startTime < maxWaitMs) {
      await new Promise(r => setTimeout(r, 3000));
      pollCount++;
      const opRes = await fetch(opUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-goog-user-project': PROJECT_ID
        }
      });
      const opData = await opRes.json();
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      if (pollCount % 4 === 0 || opData.done) {
        console.log(`[Discovery Engine] Poll #${pollCount} (${elapsed}s elapsed): done=${Boolean(opData.done)}`);
      }

      if (opData.done) {
        if (opData.error) {
          throw new Error(`[Discovery Engine Import Failed] ${JSON.stringify(opData.error)}`);
        }
        if (opData.response?.errorSamples && opData.response.errorSamples.length > 0) {
          console.warn('[Discovery Engine Import Warning] Some documents had errors:', opData.response.errorSamples);
        }
        console.log(`[Discovery Engine] Import operation finished in ${elapsed}s. Waiting 6s for index propagation...`);
        await new Promise(r => setTimeout(r, 6000));
        return opData;
      }
    }
    throw new Error(`Timeout waiting for Discovery Engine import operation ${importData.name}`);
  }

  return importData;
}

/**
 * Cleans up test artifacts: deletes test PDF and restores metadata.jsonl.
 */
async function cleanupTestDocument({ testDocId, originalMetadataContent }) {
  const token = await getAccessToken();

  // Delete test PDF
  try {
    const pdfStoragePath = `cvs/${testDocId}.pdf`;
    const deletePdfUrl = `https://storage.googleapis.com/storage/v1/b/${BUCKET_NAME}/o/${encodeURIComponent(pdfStoragePath)}`;
    await fetch(deletePdfUrl, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
  } catch (err) {
    console.warn(`Failed to delete test PDF ${testDocId}:`, err.message);
  }

  // Restore metadata.jsonl
  if (originalMetadataContent !== undefined) {
    try {
      const uploadUrl = `https://storage.googleapis.com/upload/storage/v1/b/${BUCKET_NAME}/o?uploadType=media&name=metadata.jsonl`;
      await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: originalMetadataContent
      });
    } catch (err) {
      console.warn(`Failed to restore metadata.jsonl:`, err.message);
    }
  }
}

module.exports = {
  uploadTestDocument,
  triggerDiscoveryEngineImport,
  cleanupTestDocument
};
