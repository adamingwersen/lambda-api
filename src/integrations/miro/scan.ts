import { APIGatewayProxyHandler, APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { formatResponse } from '../../libs/utils';
import { UserAccess, Cookie } from '../../libs/schema';
import { Puppeteer, Browser, Page } from 'puppeteer-core';

const chromium = require('@sparticuz/chrome-aws-lambda');

const integrationName = 'Miro';
const entry = 'https://miro.com';
const queryString =
  'accounts/?fields=id%2Ctitle%2Ctype%2Crole%2Climits%2Ctrial%2Cexpired%2CexpirationDate%2CcreatedAt%2CcurrentUserPermission%2CcurrentUserConnection%7Bid%2CisAccountCreator%2ClastActivityDate%2Cpermissions%2CorganizationConnection%7Blicense%7D%2Crole%2CselfLink%2CsharedBoardsNumber%2Cuser%7Bemail%7D%7D%2Cfeatures%2CinvitationLink%2Corganization%7Bid%2CbillingData%2CcurrentUserPermission%2CidleTimeout%2Ctitle%2Cfeatures%2Ctype%2Cnotifications%2CdataClassification%7D%2Cpicture%2Cprojects%7Bid%2Ctitle%2CisStarred%7D%2Cintegrations%2CintercomEnabled%2CwhoCanInvite%2CinviteExternalUsersEnabled%2Ccredits%2CsharingPolicy%7BmoveBoardToAccountEnabled%7D%2CdomainJoinPolicy%2CdomainProps%2CjoinPolicyForExternal%2CparticipantPostInvitationPaymentTest%2Cnotifications%2CorganizationExtension%7BaccountDiscovery%7D%2CcollaborationSettings%2CusersNumber';

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

    let accountFields = null;

    page.on('request', request => {
      request.continue();
    });

    page.on('response', async response => {
      if (response.url().includes(queryString) && response.status() === 200) {
        accountFields = await response.json();
      }
    });

    await page.goto(entry, { waitUntil: 'networkidle0' });

    if (!accountFields) {
      return formatResponse(300, 'Payload not intercepted');
    }

    browser.close();

    return formatResponse(200, JSON.stringify(accountFields));
  } catch (err) {
    return formatResponse(500, '', err);
  }
};
