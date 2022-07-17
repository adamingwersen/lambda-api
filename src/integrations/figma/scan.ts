import {
  APIGatewayProxyHandler,
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
} from "aws-lambda";
import { formatResponse, instantiatePuppeteer } from "../../libs/utils";
import { UserAccess, Cookie } from "../../libs/schema";

const integrationName = "Figma";
const entry = "https://www.figma.com/files";

export const handler: APIGatewayProxyHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const payload: UserAccess = JSON.parse(event.body || "");
    const cookies: Cookie[] = payload?.cookies;

    // Start puppeteer / chrome-aws-lambda
    const [browser, page, error] = await instantiatePuppeteer(cookies);
    if (error) return formatResponse(500, "", error);

    let sessionState = null;
    let userState = null;

    page.on("request", (request) => {
      request.continue();
    });

    page.on("response", async (response) => {
      if (
        response.url().includes("session/state") &&
        response.status() === 200
      ) {
        sessionState = await response.json();
      }
      if (response.url().includes("user/state") && response.status() === 200) {
        userState = await response.json();
      }
    });

    await page.goto(entry, { waitUntil: "networkidle0" });

    if (!sessionState || !userState) {
      return formatResponse(300, "Payload not intercepted");
    }

    browser.close();

    return formatResponse(
      200,
      JSON.stringify(sessionState).concat(JSON.stringify(userState)),
    );
  } catch (err) {
    return formatResponse(500, "", err);
  }
};
