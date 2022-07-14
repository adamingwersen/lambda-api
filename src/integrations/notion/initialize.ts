import { APIGatewayProxyHandler, APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { formatResponse } from '../../libs/utils';
import { UserAccess } from '../../libs/schema';

const chromium = require('@sparticuz/chrome-aws-lambda');

export const handler: APIGatewayProxyHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const parsedBody: UserAccess = JSON.parse(event.body || '');
    const browser = await chromium.puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
      headless: true,
      ignoreHTTPSErrors: true,
    });
    const page = await browser.newPage();
    await page.goto('https://www.typescriptlang.org/', { waitUntil: 'networkidle0' });
    const xpath = '//*[@class=" col1"]/h1';
    const textField = await page.waitForXPath(xpath);
    const textContent = await textField.evaluate(element => element.textContent);

    await browser.close();

    return formatResponse(200, JSON.stringify(textContent));
  } catch (err) {
    return formatResponse(500, '', err);
  }
};
