import { APIGatewayProxyResult } from "aws-lambda";
import { Browser, Page } from "puppeteer-core";
import { Cookie } from "./schema";

const chromium = require("@sparticuz/chrome-aws-lambda");

export const formatResponse = (
  code: number,
  text?: string,
  error?,
): APIGatewayProxyResult => {
  if (code > 200) {
    return {
      statusCode: code,
      body: `Request failed: ${error}`,
    };
  }
  return {
    statusCode: code,
    body: `Request succeeded: ${text}`,
  };
};

export const instantiatePuppeteer = async (
  cookies: Cookie[],
  headless: Boolean = true,
): Promise<[Browser, Page, Error]> => {
  try {
    const browser: Browser = await chromium.puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
      headless,
      ignoreHTTPSErrors: true,
    });

    const page: Page = await browser.newPage();
    await Promise.all([
      page.setRequestInterception(true),
      page.setCookie(...cookies),
      page.setViewport({ width: 1200, height: 800 }),
    ]);
    return [browser, page, null];
  } catch (error: unknown) {
    if (error instanceof Error) return [null, null, error];

    const newError = new Error("something went wrong setting up browser");
    return [null, null, newError];
  }
};
