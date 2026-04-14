/**
 * SCRIPT DE AUTORIZACIÓN OAUTH2 - FUNDETEC ACADEMY
 * Este script genera el enlace para autorizar el acceso a tu Google Drive personal.
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const CREDENTIALS_PATH = path.join(__dirname, '../oauth_credentials.json');
const TOKEN_PATH = path.join(__dirname, '../token.json');

async function getAuthToken() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.error('❌ Error: El archivo "oauth_credentials.json" no existe en la raíz.');
    console.error('👉 Sigue la guía para descargarlo desde la consola de Google Cloud.');
    return;
  }

  const content = fs.readFileSync(CREDENTIALS_PATH);
  const credentials = JSON.parse(content);
  const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
  
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris ? redirect_uris[0] : 'http://localhost');

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/drive.file'],
    prompt: 'consent'
  });

  console.log('🚀 ¡PASO FINAL DE AUTORIZACIÓN!');
  console.log('1. Abre este enlace en tu navegador:\n');
  console.log(authUrl);
  console.log('\n2. Inicia sesión con tu cuenta de Gmail.');
  console.log('3. Haz clic en "Continuar" y luego en "Permitir".');
  console.log('4. Serás redirigido a una página que fallará o dirá "localhost".');
  console.log('5. COPIA el código que aparece en la URL después de "?code="');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question('\n👉 PEGA EL CÓDIGO AQUÍ: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('❌ Error al recuperar el token de acceso', err);
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
      console.log('\n✅ ¡ÉXITO! El token ha sido guardado en "token.json".');
      console.log('Ya puedes ejecutar "node scripts/backup_data.js" y los archivos se subirán a tu Drive.');
    });
  });
}

getAuthToken();
