const { google } = require('googleapis');
const http = require('http');
const fs = require('fs');
const path = require('path');
const config = require('../config');

const SCOPES = ['https://www.googleapis.com/auth/webmasters.readonly'];
const TOKEN_PATH = path.join(config.CREDENTIALS_DIR, 'gsc-token.json');

function getClientCredentials() {
  // Try environment variables first
  if (process.env.GSC_CLIENT_ID && process.env.GSC_CLIENT_SECRET) {
    return {
      clientId: process.env.GSC_CLIENT_ID,
      clientSecret: process.env.GSC_CLIENT_SECRET,
    };
  }

  // Fall back to client_secret.json
  const secretPath = path.join(config.CREDENTIALS_DIR, 'client_secret.json');
  if (!fs.existsSync(secretPath)) {
    console.error('\nNo GSC credentials found. You need either:');
    console.error('  1. Set GSC_CLIENT_ID and GSC_CLIENT_SECRET in a .env file');
    console.error('  2. Place client_secret.json in the credentials/ directory');
    console.error('\nGet credentials from: https://console.cloud.google.com/apis/credentials');
    console.error('Enable the "Google Search Console API" and create an OAuth 2.0 Client ID (Desktop app).\n');
    process.exit(1);
  }

  const content = JSON.parse(fs.readFileSync(secretPath, 'utf8'));
  const creds = content.installed || content.web;
  return { clientId: creds.client_id, clientSecret: creds.client_secret };
}

async function getAuthenticatedClient() {
  // Load .env if present
  try { require('dotenv').config(); } catch {}

  const { clientId, clientSecret } = getClientCredentials();

  // Check for saved token
  if (fs.existsSync(TOKEN_PATH)) {
    const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials(tokens);

    try {
      await oauth2Client.getAccessToken();
      return oauth2Client;
    } catch {
      console.log('Saved token is invalid, re-authorizing...');
      fs.unlinkSync(TOKEN_PATH);
    }
  }

  // Start OAuth flow with local callback server
  return new Promise((resolve, reject) => {
    const server = http.createServer();

    server.listen(0, async () => {
      const port = server.address().port;
      const redirectUri = process.env.GSC_REDIRECT_URI || `http://localhost:${port}/oauth/callback`;
      const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

      const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent',
      });

      console.log('\nOpening browser for Google authorization...');
      console.log(`If it doesn't open, visit:\n${authUrl}\n`);

      // Dynamic import for ESM-only 'open' package
      try {
        const open = (await import('open')).default;
        open(authUrl);
      } catch {
        console.log('(Could not open browser automatically. Please visit the URL above.)');
      }

      server.on('request', async (req, res) => {
        const parsedUrl = new URL(req.url, `http://localhost:${port}`);

        if (parsedUrl.pathname === '/oauth/callback') {
          const code = parsedUrl.searchParams.get('code');
          const error = parsedUrl.searchParams.get('error');

          if (error) {
            res.end('Authorization denied. You can close this tab.');
            server.close();
            reject(new Error(`OAuth error: ${error}`));
            return;
          }

          try {
            const { tokens } = await oauth2Client.getToken(code);
            oauth2Client.setCredentials(tokens);

            // Save token
            config.ensureDir(config.CREDENTIALS_DIR);
            fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));

            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end('<h1>Authorized!</h1><p>You can close this tab and return to the terminal.</p>');
            server.close();
            resolve(oauth2Client);
          } catch (err) {
            res.end('Authorization failed. Check the terminal.');
            server.close();
            reject(err);
          }
        }
      });
    });
  });
}

module.exports = { getAuthenticatedClient };
