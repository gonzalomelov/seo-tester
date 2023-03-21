# SEO Tester

SEO Tester is a script that checks the Open Graph and Twitter Card meta tags for a list of URLs provided in a CSV file. It uses Puppeteer with the StealthPlugin to scrape the meta tags and compare them with the expected values from the CSV.

## Installation

1. Make sure you have Node.js installed on your machine. If not, download and install it from the [official website](https://nodejs.org/).

2. Clone or download this repository to your local machine.

3. Open a terminal or command prompt and navigate to the directory where the project is located.

4. Run the following command to install the required packages:

   ```bash
   npm install
   ```

## Usage
Create a CSV file named input.csv in the project directory. The CSV should have the following headers: url, og:image, og:description, og:url, og:title, twitter:image, twitter:description, and twitter:title. Add the URLs and their expected meta tag values as rows in the CSV.

Example:

csv
```
url,og:image,og:description,og:url,og:title,twitter:image,twitter:description,twitter:title
https://www.example.com/,https://www.example.com/image.jpg,Example description,https://www.example.com/,Example Title,https://www.example.com/twitter-image.jpg,Example Twitter description,Example Twitter Title
```

In the terminal or command prompt, navigate to the project directory and run the script using the following command:

```
node seo-tester.js
```

The script will process the URLs in the CSV file and output the results in the terminal, indicating whether the meta tags are valid or not.

License
This project is licensed under the MIT License. See the LICENSE file for details.