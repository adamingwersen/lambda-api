import { APIGatewayProxyHandler, APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { formatResponse } from '../../libs/utils';
import { UserAccess, Cookie } from '../../libs/schema';
const chromium = require('@sparticuz/chrome-aws-lambda');

const integrationName = 'Notion';
const entry = 'https://notion.so/';

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

    // page.on('request', request => {
    //   if (request.isInterceptResolutionHandled()) return;
    //   request.continue();
    // });

    let publicPageDataBody = null;
    let subscriptionDataBody = null;

    page.on('request', request => {
      // console.log('>>', request.method(), request.url());
      request.continue();
    });

    page.on('response', async response => {
      if (response.url().includes('getPublicPageData')) {
        publicPageDataBody = await response.json();
      }
      if (response.url().includes('getSubscriptionData')) {
        subscriptionDataBody = await response.json();
      }
    });

    // let responseBody;
    // page.on('request', async request => {
    //   const response = await request.response();

    //   if (request.url().includes('getPublicPageData')) {
    //     responseBody = await response.buffer();
    //     return;
    //   }
    //   request.continue();
    // });

    await page.goto(entry, { waitUntil: 'networkidle0' });

    // const getPublicPageData = await page.waitForResponse(async response => {
    //   if (response.request().url().toString().includes('getPublicPageData')) {
    //     const shit = await response.json();
    //     return shit;
    //   }
    //   return 'Nope';
    // });

    // let publicPageDataPayload = null;

    // await page.on('response', async response => {
    //   const request = response.request();
    //   if (request.url().includes('getPublicPageData')) {
    //     publicPageDataPayload = await response.json();
    //   }
    // });

    // const getPublicPageData = await page.waitForResponse(response => {
    //   return response.url().toString().includes('getPublicPageData') && response.status() === 200;
    // });
    // if (typeof responseBody === 'undefined') {
    //   return formatResponse(200, JSON.stringify(responseBody));
    // }

    await browser.close();

    if (publicPageDataBody == null) return formatResponse(200, "Couldn't find data");

    return formatResponse(200, (JSON.stringify(publicPageDataBody), JSON.stringify(subscriptionDataBody)));

    // const xpath = '//*[@class=" col1"]/h1';
    // const textField = await page.waitForXPath(xpath);
    // const textContent = await textField.evaluate(element => element.textContent);
  } catch (err) {
    return formatResponse(500, '', err);
  }
};
