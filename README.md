# navigate

[![License: Unlicense](https://img.shields.io/badge/license-Unlicense-blue.svg)](http://unlicense.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=fff)](https://typescriptlang.org)
[![Drizzle](https://img.shields.io/badge/Drizzle-C5F74F?logo=drizzle&logoColor=000)](https://orm.drizzle.team)

A respectful, collaborative search engine

## Purpose

Navigate takes a more fundamental approach to the rules of the Internet to bring an "as good as it gets" experience, but for very good reason. While big search engines tend to bend, ignore, and (re)define rules to suit their businesses, we aim to provide a *similar* experience, while having little impact on the precious hours of webmasters!

## Scraping

Web scraping is a critical component of Navigate which fetches the data which makes up a result. However, most search engines or web scraping projects do *not* work like Navigate does.

Our scraping is done in a thoughtful way:

- Minimum of 30 second delay between requests
- Official scrapers do not utilize proxies
- Fully respectful of robots.txt
- No faked user agents; all official scrapers identify as `NavigateBot`

Navigate is focused on returning power to webmasters by upholding these principles. While many large companies may think they have free rein on scraping and using your website for profit, we absolutely do not.

## Credits

Without the following projects and people, Navigate would not be possible:

- [Axios](https://axios-http.com) and it's contributors
- [Drizzle Team](https://drizzle.team) and contributors *for* [Drizzle ORM](https://orm.drizzle.team)
- CheerioJS and contributors *for* [Cheerio](https://cheerio.js.org)
- [samclarke](https://github.com/samclarke) *for* [robots-parser](https://www.npmjs.com/package/robots-parser)
- [html-to-text contributors](https://github.com/html-to-text/node-html-to-text/graphs/contributors) *for* [html-to-text](https://www.npmjs.com/package/html-to-text)
- [The JShttp Team](https://jshttp.github.io) and contributors *for* [mime-types](https://www.npmjs.com/package/mime-types)
