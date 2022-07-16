import { APIGatewayProxyHandler, APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Puppeteer, Browser, Page } from 'puppeteer-core';
import { formatResponse } from '../../libs/utils';
import { UserAccess, Cookie } from '../../libs/schema';
const chromium = require('@sparticuz/chrome-aws-lambda');

const integrationName = 'Figma';
const entry = 'https://www.figma.com/files';

export const handler: APIGatewayProxyHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const payload: UserAccess = JSON.parse(event.body || '');
    const cookies: Cookie[] = payload?.cookies;

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

    let sessionState = null;
    let userState = null;

    page.on('request', request => {
      request.continue();
    });

    page.on('response', async response => {
      if (response.url().includes('session/state') && response.status() === 200) {
        sessionState = await response.json();
      }
      if (response.url().includes('user/state') && response.status() === 200) {
        userState = await response.json();
      }
    });

    await page.goto(entry, { waitUntil: 'networkidle0' });

    if (!sessionState || !userState) {
      return formatResponse(300, 'Payload not intercepted');
    }

    browser.close();

    return formatResponse(200, JSON.stringify(sessionState).concat(JSON.stringify(userState)));
  } catch (err) {
    return formatResponse(500, '', err);
  }
};
