/**
 * SCRIPT DE SINCRONIZACIÓN GOOGLE DRIVE (OAUTH2) - FUNDETEC ACADEMY
 * Este script sube automáticamente los archivos usando tu cuenta personal.
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// CONFIGURACIÓN
const FOLDER_ID = '1JUDNe1kwNNvxdOWTbEOZOTMy1nxwW175'; 
const CREDENTIALS_PATH = path.join(__dirname, '../oauth_credentials.json');
const TOKEN_PATH = path.join(__dirname, '../token.json');
const BACKUPS_DIR = path.join(__dirname, '../backups');

async function syncDrive() {
  console.log('☁️  Iniciando Sincronización Personal (OAuth2)...');

  if (!fs.existsSync(CREDENTIALS_PATH) || !fs.existsSync(TOKEN_PATH)) {
    console.error('❌ Error: Faltan credenciales (oauth_credentials.json o token.json).');
    console.error('👉 Ejecuta primero "node scripts/get_refresh_token.js"');
    return;
  }

  const content = fs.readFileSync(CREDENTIALS_PATH);
  const credentials = JSON.parse(content);
  const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
  
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris ? redirect_uris[0] : 'http://localhost');
  const token = fs.readFileSync(TOKEN_PATH);
  oAuth2Client.setCredentials(JSON.parse(token));

  const drive = google.drive({ version: 'v3', auth: oAuth2Client });

  try {
    const existingFilesResponse = await drive.files.list({
      q: `'${FOLDER_ID}' in parents and trashed = false`,
      fields: 'files(name)',
    });
    const existingFileNames = existingFilesResponse.data.files.map(f => f.name);

    const localFolders = fs.readdirSync(BACKUPS_DIR, { withFileTypes: true });

    for (const item of localFolders) {
      const fullPath = path.join(BACKUPS_DIR, item.name);
      
      if (item.isDirectory()) {
        const subFiles = fs.readdirSync(fullPath);
        for (const subFile of subFiles) {
          const subFilePath = path.join(fullPath, subFile);
          const fileNameOnDrive = `${item.name}/${subFile}`;
          if (!existingFileNames.includes(fileNameOnDrive)) {
             await uploadFile(drive, subFilePath, fileNameOnDrive, FOLDER_ID);
          }
        }
      } else if (item.isFile() && item.name.endsWith('.zip')) {
        if (!existingFileNames.includes(item.name)) {
          await uploadFile(drive, fullPath, item.name, FOLDER_ID);
        } else {
          console.log(`⏩ Saltando ${item.name} (ya existe en Drive)`);
        }
      }
    }

    console.log('✅ Sincronización Personal finalizada con éxito.');
  } catch (error) {
    console.error('❌ Error en la sincronización:', error.message);
  }
}

async function uploadFile(drive, filePath, fileName, parentId) {
  console.log(`📤 Subiendo a tu espacio personal: ${fileName}...`);
  const fileMetadata = {
    name: fileName,
    parents: [parentId],
  };
  const media = {
    body: fs.createReadStream(filePath),
  };

  try {
    await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id',
    });
    console.log(`✔️  ${fileName} subido a tu cuota correctamente.`);
  } catch (err) {
    console.error(`❌ Fallo al subir ${fileName}:`, err.message);
  }
}

if (require.main === module) {
  syncDrive();
}

module.exports = { syncDrive };
