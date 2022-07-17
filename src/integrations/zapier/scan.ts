import {
  APIGatewayProxyHandler,
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
} from "aws-lambda";
import { formatResponse, instantiatePuppeteer } from "../../libs/utils";
import { UserAccess, Cookie } from "../../libs/schema";

const integrationName = "Zapier";
const entry = "https://zapier.com/app/dashboard";

export const handler: APIGatewayProxyHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    // Parse post data
    const payload: UserAccess = JSON.parse(event?.body ?? "");
    const cookies: Cookie[] = payload?.cookies;

    // Start puppeteer / chrome-aws-lambda
    const [browser, page, error] = await instantiatePuppeteer(cookies);
    if (error) return formatResponse(500, "", error);

    // Intercept requests
    page.on("request", (request) => {
      // Might be able to do something with request.postData here instead?
      request.continue();
    });

    // Intercept responses
    let accounts = null;
    page.on("response", async (response) => {
      if (response.url().includes("accounts") && response.status() === 200) {
        accounts = await response.json();
      }
    });

    // Visit page
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
