const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs').promises;
const csvParser = require('csv-parser');
const async = require('async');
const createCsvWriter = require('csv-writer').createObjectCsvWriter; // Import the library

puppeteer.use(StealthPlugin());

const csvFile = 'urls.csv';
const outputCsvFile = 'output.csv';

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
      const concurrency = 1; // Adjust this value according to your system's capabilities
      const queue = async.queue(async (row, callback) => {
        // Your existing CSV processing code here

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

            // Compare with expected values
            const validationResult = { url };
            let allTagsValid = true;
            for (const key in row) {
              if (key !== 'url') {
                const expectedValue = row[key];
                const [prefix, property] = key.split(':');
                const tag = (prefix === 'og') ? ogTags.find(t => t.property === key) : twitterTags.find(t => t.name === key);

                if (tag && tag.content === expectedValue) {
                  console.log(`${key} is valid.`);
                  validationResult[key] = true;
                } else {
                  console.log(`${key} is invalid. Expected: ${expectedValue} | Found: ${tag ? tag.content : 'Not found'}`);
                  validationResult[key] = false;
                  allTagsValid = false;
                }
              }
            }

            validationResults.push(validationResult);
            console.log(`Validation result: ${allTagsValid ? 'All tags are valid.' : 'Some tags are invalid.'}`);

            console.log(`Validation result: ${allTagsValid ? 'All tags are valid.' : 'Some tags are invalid.'}`);
          } else {
            console.log('Error fetching the page. Skipping meta tags check.');
          }
        } catch (error) {
          console.error(`Error navigating to ${url}: ${error.message}`);
        }

        console.log('-------------------------------------');

        // Don't forget to call callback() at the end of your code to signal task completion
        callback();
      }, concurrency);

      rows.forEach((row) => {
        queue.push(row);
      });

      queue.drain(async () => {
        console.log('All tasks completed.');
        
        // Write the validation results to a new CSV file
        const csvWriter = createCsvWriter({
          path: outputCsvFile,
          header: Object.keys(rows[0]).map(key => ({ id: key, title: key })),
        });

        try {
          await csvWriter.writeRecords(validationResults);
          console.log(`Validation results saved to ${outputCsvFile}.`);
        } catch (error) {
          console.error(`Error writing to ${outputCsvFile}: ${error.message}`);
        }

        browser.close();
      });
    });

  parser.write(csvData);
  parser.end();

})();
