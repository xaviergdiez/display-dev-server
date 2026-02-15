const { OAuth2Client } = require('google-auth-library');
const http = require('http');
const url = require('url');
const open = require('open');
const fs = require('fs-extra');
const destroyer = require('server-destroy');
const inquirer = require('inquirer');
const Filenames = require('../data/Filenames');

module.exports = async function getOAuth2Client() {
  let data = {};
  const filepathRc = `./${Filenames.RC}`;
  const filepathGitIgnore = `./${Filenames.GITIGNORE}`;

  try {
    data = await fs.readJson(filepathRc);

    const oauthClient = new OAuth2Client({
      clientId: data.clientId,
      clientSecret: data.clientSecret,
    });

    oauthClient.credentials.access_token = data.credentials.access_token;
    oauthClient.credentials.refresh_token = data.credentials.refresh_token;
    oauthClient.credentials.expiry_date = data.credentials.expiry_date;

    return oauthClient;

  } catch (e) {

    const { clientId } = await inquirer.prompt({
      type: 'input',
      name: 'clientId',
      message: 'Client ID?',
      default: process.env.displayMonks_clientId,
    });

    const { clientSecret } = await inquirer.prompt({
      type: 'input',
      name: 'clientSecret',
      message: 'Client Secret?',
      default: process.env.displayMonks_clientSecret,
    });

    data = {
      clientId, clientSecret
    }

    return new Promise((resolve, reject) => {

      // create an oAuth client to authorize the API call.  Secrets are kept in a `keys.json` file,
      // which should be downloaded from the Google Developers Console.
      const oAuth2Client = new OAuth2Client(
        data.clientId,
        data.clientSecret,
        "http://localhost:3000/oauth2callback"
      );

      // Generate the url that will be used for the consent dialog.
      const authorizeUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
      });

      // Open an http server to accept the oauth callback. In this simple example, the
      // only request to our webserver is to /oauth2callback?code=<code>
      const server = http
        .createServer(async (req, res) => {
          try {
            if (req.url.indexOf('/oauth2callback') > -1) {
              // acquire the code from the querystring, and close the web server.
              const qs = new url.URL(req.url, 'http://localhost:3000')
                .searchParams;
              const code = qs.get('code');
              console.log(`Code is ${code}`);
              res.end('Authentication successful! Please return to the console.');
              server.destroy();

              // Now that we have the code, use that to acquire tokens.
              const r = await oAuth2Client.getToken(code);
              // Make sure to set the credentials on the OAuth2 client.
              oAuth2Client.setCredentials(r.tokens);
              console.info('Tokens acquired.');

              data.credentials = {};
              data.credentials.access_token = oAuth2Client.credentials.access_token;
              data.credentials.refresh_token = oAuth2Client.credentials.refresh_token;
              data.credentials.expiry_date = oAuth2Client.credentials.expiry_date;
              await fs.writeJson(filepathRc, data);

              // checking for a .oauthrc
              let hasGitIgnore = await fs.pathExists(filepathGitIgnore);

              // checking if .gitignore is exists
              if (!hasGitIgnore) {
                const { shouldCreateGitIgnore } = await inquirer.prompt({
                  type: 'confirm',
                  name: 'shouldCreateGitIgnore',
                  message: 'No .gitignore found should i create it?',
                });

                if (shouldCreateGitIgnore) {
                  hasGitIgnore = true;
                  await fs.outputFile(filepathGitIgnore, '');
                }
              }

              if (hasGitIgnore) {
                const gitIgnoreContent = await fs.readFile(filepathGitIgnore, 'utf8');

                const regEx = new RegExp(Filenames.RC, 'gm');

                if (!regEx.test(gitIgnoreContent)) {
                  const { shouldAddIt } = await inquirer.prompt({
                    type: 'confirm',
                    name: 'shouldAddIt',
                    message: `No ${Filenames.RC} was added to the ${Filenames.GITIGNORE}, should i add it?`,
                  });

                  if (shouldAddIt) {
                    fs.outputFile(filepathGitIgnore, gitIgnoreContent.replace(/\n$/, '') + `\n${Filenames.RC}`);
                  }
                }
              }

              resolve(oAuth2Client);
            }
          } catch (e) {
            reject(e);
          }
        })
        .listen(3000, () => {
          // open the browser to the authorize url to start the workflow
          open(authorizeUrl, {wait: false}).then(cp => cp.unref());
        });

      destroyer(server);
    });
  }
}
