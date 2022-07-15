import { APIGatewayProxyHandler, APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { formatResponse } from '../../libs/utils';
import { UserAccess, Cookie } from '../../libs/schema';
const chromium = require('@sparticuz/chrome-aws-lambda');

const integrationName = 'Asana';
const entry = 'https://app.asana.com/admin/members';

export const handler: APIGatewayProxyHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const payload: UserAccess = JSON.parse(event.body || '');
    const cookies: Cookie[] = payload?.cookies;

    const browser = await chromium.puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
      headless: true,
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();
    await page.setRequestInterception(true);
    await page.setCookie(...cookies);
    await page.setViewport({ width: 1200, height: 800 });

    page.on('request', request => {
      request.continue();
    });

    await page.goto(entry, { waitUntil: 'networkidle0' });

    const xpath = '//*[@class="AdminConsoleMembersListRow-userEmail"]';
    await page.waitForXPath(xpath);
    const members = await page.$x(xpath);
    const memberEmails = await page.evaluate((...members) => {
      return members.map(e => e.textContent);
    }, ...members);

    if (memberEmails.length < 1) {
      return formatResponse(300, 'Did not find any users');
    }
    return formatResponse(200, `...Found ${memberEmails.length} members: ${memberEmails}`);
  } catch (err) {
    return formatResponse(500, '', err);
  }
};
