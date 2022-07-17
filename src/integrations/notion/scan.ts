import {
  APIGatewayProxyHandler,
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
} from "aws-lambda";
import { formatResponse, instantiatePuppeteer } from "../../libs/utils";
import { UserAccess, Cookie } from "../../libs/schema";

const integrationName = "Notion";
const entry = "https://notion.so/";

export const handler: APIGatewayProxyHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const payload: UserAccess = JSON.parse(event.body || "");
    const cookies: Cookie[] = payload?.cookies;

    // Start puppeteer / chrome-aws-lambda
    const [browser, page, error] = await instantiatePuppeteer(cookies);
    if (error) return formatResponse(500, "", error);

    let publicPageDataBody = null;
    let subscriptionDataBody = null;
    let userAnalyticsSettings = null;

    page.on("request", (request) => {
      request.continue();
    });

    page.on("response", async (response) => {
      if (
        response.url().includes("getPublicPageData") &&
        response.status() === 200
      ) {
        publicPageDataBody = await response.json();
      }
      if (
        response.url().includes("getSubscriptionData") &&
        response.status() === 200
      ) {
        subscriptionDataBody = await response.json();
      }
      if (
        response.url().includes("getUserAnalyticsSettings") &&
        response.status() === 200
      ) {
        userAnalyticsSettings = await response.json();
      }
    });

    await page.goto(entry, { waitUntil: "networkidle0" });

    await browser.close();

    if (
      !userAnalyticsSettings ||
      !subscriptionDataBody ||
      !publicPageDataBody
    ) {
      return formatResponse(300, "Payload not intercepted");
    }

    return formatResponse(
      200,
      JSON.stringify(userAnalyticsSettings)
        .concat(JSON.stringify(subscriptionDataBody))
        .concat(JSON.stringify(publicPageDataBody)),
    );
  } catch (err) {
    return formatResponse(500, "", err);
  }
};
