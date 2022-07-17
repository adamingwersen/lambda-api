import {
  APIGatewayProxyHandler,
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
} from "aws-lambda";
import { formatResponse, instantiatePuppeteer } from "../../libs/utils";
import { UserAccess, Cookie } from "../../libs/schema";

const integrationName = "Metabase";
// const entry = 'https://[workspace].metabase.app';

export const handler: APIGatewayProxyHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const payload: UserAccess = JSON.parse(event.body || "");
    const cookies: Cookie[] = payload?.cookies;

    const domainCookie = cookies.find((obj) => {
      return obj.name === "metabase.SESSION";
    });
    const domain = domainCookie?.domain;
    if (!domain) {
      return formatResponse(300, "Could not identify domain cookie");
    }

    const entry = "https://".concat(domain);

    // Start puppeteer / chrome-aws-lambda
    const [browser, page, error] = await instantiatePuppeteer(cookies);
    if (error) return formatResponse(500, "", error);

    let current = null;
    let properties = null;

    page.on("request", (request) => {
      request.continue();
    });

    page.on("response", async (response) => {
      if (response.url().includes("current") && response.status() === 200) {
        current = await response.json();
      }
      if (response.url().includes("properties") && response.status() === 200) {
        properties = await response.json();
      }
    });

    await page.goto(entry, { waitUntil: "networkidle0" });

    if (!current || !properties) {
      return formatResponse(300, "Payload not intercepted");
    }

    browser.close();

    // const jsonThing: RETURN_TYPE = {
    //   userId: '1',
    //   users: ['1', '2', '3'],
    //   workspaces: ['Hada'],
    //   userRole: 'admin',
    //   blob: {
    //     current: JSON.stringify(current),
    //     properties: JSON.stringify(properties),
    //   },
    // };

    return formatResponse(
      200,
      JSON.stringify(current).concat(JSON.stringify(properties)),
    );
  } catch (err) {
    return formatResponse(500, "", err);
  }
};
