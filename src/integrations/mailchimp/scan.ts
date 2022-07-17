import {
  APIGatewayProxyHandler,
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
} from "aws-lambda";
import { Browser, Page } from "puppeteer-core";
import { formatResponse } from "../../libs/utils";
import { UserAccess, Cookie } from "../../libs/schema";

const chromium = require("@sparticuz/chrome-aws-lambda");

const integrationName = "Mailchimp";
const entry = "https://admin.mailchimp.com/";

export const handler: APIGatewayProxyHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const payload: UserAccess = JSON.parse(event.body || "");
    const cookies: Cookie[] = payload?.cookies;

    const browser: Browser = await chromium.puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
      headless: false,
      ignoreHTTPSErrors: true,
    });

    const page: Page = await browser.newPage();
    await page.setRequestInterception(true);
    await page.setCookie(...cookies);
    await page.setViewport({ width: 1200, height: 800 });

    let info = null;
    let audienceData = null;

    page.on("request", (request) => {
      request.continue();
    });

    page.on("response", async (response) => {
      if (response.url().includes("get-info") && response.status() === 200) {
        info = await response.json();
      }
      if (
        response.url().includes("get-audience-data") &&
        response.status() === 200
      ) {
        audienceData = await response.json();
      }
    });

    await page.goto(entry, { waitUntil: "networkidle0" });

    if (!info || !audienceData) {
      return formatResponse(300, "Payload not intercepted");
    }

    browser.close();

    return formatResponse(
      200,
      JSON.stringify(info).concat(JSON.stringify(audienceData)),
    );
  } catch (err) {
    return formatResponse(500, "", err);
  }
};
