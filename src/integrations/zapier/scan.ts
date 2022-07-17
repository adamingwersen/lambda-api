import {
  APIGatewayProxyHandler,
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
} from "aws-lambda";
import { formatResponse } from "../../libs/utils";
import { UserAccess, Cookie } from "../../libs/schema";
import { Puppeteer, Browser, Page } from "puppeteer-core";

const chromium = require("@sparticuz/chrome-aws-lambda");

const integrationName = "Zapier";
const entry = "https://zapier.com/app/dashboard";

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
      headless: true,
      ignoreHTTPSErrors: true,
    });

    const page: Page = await browser.newPage();
    await page.setRequestInterception(true);
    await page.setCookie(...cookies);
    await page.setViewport({ width: 1200, height: 800 });

    let accounts = null;

    page.on("request", (request) => {
      // Might be able to do something with request.postData here instead?
      request.continue();
    });

    page.on("response", async (response) => {
      if (response.url().includes("accounts") && response.status() === 200) {
        accounts = await response.json();
      }
    });

    await page.goto(entry, { waitUntil: "networkidle0" });

    if (!accounts) {
      return formatResponse(300, "Payload not intercepted");
    }

    browser.close();

    return formatResponse(200, JSON.stringify(accounts));
  } catch (err) {
    return formatResponse(500, "", err);
  }
};
