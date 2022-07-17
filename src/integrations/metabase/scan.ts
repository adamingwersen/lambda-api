import { APIGatewayProxyHandler, APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { formatResponse } from '../../libs/utils';
import { UserAccess, Cookie, User, Organisation, Integration } from '../../libs/schema';
import { Puppeteer, Browser, Page } from 'puppeteer-core';

const chromium = require('@sparticuz/chrome-aws-lambda');

const integrationName = 'Metabase';
// const entry = 'https://[workspace].metabase.app';

export const handler: APIGatewayProxyHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const payload: UserAccess = JSON.parse(event.body || '');
    const cookies: Cookie[] = payload?.cookies;

    const domainCookie = cookies.find(obj => {
      return obj.name === 'metabase.SESSION';
    });
    const domain = domainCookie?.domain;
    if (!domain) {
      return formatResponse(300, 'Could not identify domain cookie');
    }

    const entry = 'https://'.concat(domain);

    const browser: Browser = await chromium.puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
      headless: true,
      ignoreHTTPSErrors: true,
    });

    const page: Page = await browser.newPage();
    await page.setRequestInterception(true);
    await page.setCookie(...cookies);
    await page.setViewport({ width: 1200, height: 800 });

    let current = null;
    let properties = null;

    page.on('request', request => {
      request.continue();
    });

    page.on('response', async response => {
      if (response.url().includes('current') && response.status() === 200) {
        current = await response.json();
      }
      if (response.url().includes('properties') && response.status() === 200) {
        properties = await response.json();
      }
    });

    await page.goto(entry, { waitUntil: 'networkidle0' });

    if (!current || !properties) {
      return formatResponse(300, 'Payload not intercepted');
    }

    browser.close();

    // const jsonThing: RETURN_TYPE = {
    //   userId: '1',
    //   users: ['1', '2', '3'],
    //   workspaces: ['Hada'],
    //   userRole: 'admin',
    //   blob: {
    //     current: JSON.stringify(current),
    //     properties: JSON.stringify(properties),
    //   },
    // };

    return formatResponse(200, JSON.stringify(current).concat(JSON.stringify(properties)));
  } catch (err) {
    return formatResponse(500, '', err);
  }
};
