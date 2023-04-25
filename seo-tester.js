const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs').promises;
const csvParser = require('csv-parser');
const async = require('async');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

puppeteer.use(StealthPlugin());

const inputFilename = process.argv[2];
if (!inputFilename) {
  console.error('Please provide a CSV file as an argument.');
  process.exit(1);
}

const csvFile = inputFilename;

(async () => {
  const validationResults = [];
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.82 Safari/537.36');

  const csvData = await fs.readFile(csvFile, 'utf8');
  const rows = [];
  const parser = csvParser();

  parser
    .on('data', (row) => {
      rows.push(row);
    })
    .on('end', async () => {
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
              if (key !== 'url' && !key.endsWith(' status')) {
                const expectedValue = row[key];
                const [prefix, property] = key.split(':');
                const tag = (prefix === 'og') ? ogTags.find(t => t.property === key) : twitterTags.find(t => t.name === key);

                const statusKey = `${key} status`;
                if (tag && tag.content === expectedValue) {
                  console.log(`${key} is valid.`);
                  validationResult[statusKey] = 'correct';
                } else {
                  console.log(`${key} is invalid. Expected: ${expectedValue} | Found: ${tag ? tag.content : 'Not found'}`);
                  validationResult[statusKey] = 'incorrect';
                }
                validationResult[key] = row[key]; // Copy the value from the input row
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

        // Write the validation results to a new CSV file
        const csvWriter = createCsvWriter({
          path: csvFile,
          header: Object.keys(rows[0]).map(key => ({ id: key, title: key })),
        });

        try {
          await csvWriter.writeRecords(validationResults);
          console.log(`Validation results saved to ${csvFile}.`);
        } catch (error) {
          console.error(`Error writing to ${csvFile}: ${error.message}`);
        }

        browser.close();
      });
    });

  parser.write(csvData);
  parser.end();

})();
