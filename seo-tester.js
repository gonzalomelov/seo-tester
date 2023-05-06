const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs').promises;
const csvParser = require('csv-parser');
const async = require('async');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const { google } = require('googleapis');
const { GoogleAuth, JWT } = require('google-auth-library');

// Replace 'your_csv_file_id' with the file ID of your CSV file in Google Drive
const fileId = '1oEbwJ9AwoqVQA5mg-fjtO8bQEwPDKvB1';

puppeteer.use(StealthPlugin());

// Load client secrets from a local file.
fs.readFile('seo-checker-385902-ebc0523c0a7e.json', (err, content) => {
  if (err) return console.log('Error loading client secret file:', err);
  // Authorize a client with credentials, then call the Google Drive API.
  authorize(JSON.parse(content), processCSVFileFromGoogleDrive);
});

async function getServiceAccountClient(credentials) {
  const client = new JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  await client.authorize();

  return client;
}

async function processCSVFileFromGoogleDrive(auth) {
  const drive = google.drive({ version: 'v3', auth });

  // Download the CSV file as a string
  const response = await drive.files.get({
    fileId: fileId,
    alt: 'media',
  }, { responseType: 'text' });

  return response.data;
}

async function processCSVData(csvData, auth) {
  const validationResults = [];
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.82 Safari/537.36');

  const rows = [];
  const parser = csvParser();

  parser
    .on('data', (row) => {
      rows.push(row);
    }).on('end', async () => {
      const concurrency = 1;
      const queue = async.queue(async (row, callback) => {
        const url = row.url;
    
        console.log(`Checking SEO meta tags for ${url}`);
    
        try {
          const response = await page.goto(url, { waitUntil: 'networkidle2' });
          const status = response.status();
          console.log(`Page fetched with status code: ${status}`);
    
          if (status >= 200 && status < 300) {
            const ogTags = await page.$$eval("head > meta[property^='og:']", elements => {
              return elements.map(el => ({ property: el.getAttribute('property'), content: el.getAttribute('content') }));
            });
    
            const twitterTags = await page.$$eval("head > meta[name^='twitter:']", elements => {
              return elements.map(el => ({ name: el.getAttribute('name'), content: el.getAttribute('content') }));
            });
    
            console.log('Open Graph tags:', ogTags);
            console.log('Twitter Card tags:', twitterTags);
    
            const validationResult = { url };
            for (const key in row) {
              if (key.endsWith(' expected')) {
                const expectedValue = row[key];
                const prefixAndProperty = key.split(' ')[0];
                const [prefix, property] = prefixAndProperty.split(':');
                const tag = (prefix === 'og') ? ogTags.find(t => t.property === prefixAndProperty) : twitterTags.find(t => t.name === prefixAndProperty);
    
                const statusKey = `${prefixAndProperty} status`;
                const currentKey = `${prefixAndProperty} current`;
    
                if (tag && tag.content === expectedValue) {
                  validationResult[statusKey] = 'correct';
                } else {
                  validationResult[statusKey] = 'incorrect';
                }
                validationResult[key] = row[key]; // Copy the value from the input row
                validationResult[currentKey] = tag ? tag.content : 'Not found';
              }
            }
            validationResults.push(validationResult);
    
          } else {
            console.log('Error fetching the page. Skipping meta tags check.');
          }
        } catch (error) {
          console.error(`Error navigating to ${url}: ${error.message}`);
        }
    
        console.log('-------------------------------------');
        callback();
      }, concurrency);
    
      rows.forEach((row) => {
        queue.push(row);
      });
    
      queue.drain(async () => {
        console.log('All tasks completed.');
      
        // Write the validation results to a temporary local CSV file
        const tempFilePath = 'temp.csv';
        const csvWriter = createCsvWriter({
          path: tempFilePath,
          header: Object.keys(rows[0]).map(key => ({ id: key, title: key })),
        });
      
        try {
          await csvWriter.writeRecords(validationResults);
          console.log(`Validation results saved to ${tempFilePath}.`);
        } catch (error) {
          console.error(`Error writing to ${tempFilePath}: ${error.message}`);
        }
      
        // Read the contents of the temporary local file
        const csvDataToUpload = await fs.readFile(tempFilePath, 'utf-8');
      
        // Upload the CSV data to Google Drive and replace the original file
        const buffer = Buffer.from(csvDataToUpload);
        const media = {
          mimeType: 'text/csv',
          body: buffer,
        };
      
        const drive = google.drive({ version: 'v3', auth });

        try {
          await drive.files.update({
            fileId: fileId,
            media: media,
          });
      
          console.log(`Validation results saved and replaced the file in Google Drive.`);
        } catch (error) {
          console.error(`Error updating the file in Google Drive: ${error.message}`);
        }
      
        // Remove the temporary local file
        await fs.unlink(tempFilePath);
      
        browser.close();
      });
    });
    
  parser.write(csvData);
  parser.end();
}

async function main() {
  // Load client secrets from a local file.
  const content = await fs.readFile('seo-checker-385902-ebc0523c0a7e.json');
  const credentials = JSON.parse(content);
  const auth = await getServiceAccountClient(credentials);
  const fileContent = await processCSVFileFromGoogleDrive(auth);
  const validationResults = await processCSVData(fileContent, auth);

  return validationResults;
}

main()
  .then(validationResults => {
    console.log('Validation results:', validationResults);
  })
  .catch(error => {
    console.error('Error:', error);
  });