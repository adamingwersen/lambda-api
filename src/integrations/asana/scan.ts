import {
  APIGatewayProxyHandler,
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
} from "aws-lambda";
import { formatResponse, instantiatePuppeteer } from "../../libs/utils";
import { UserAccess, Cookie } from "../../libs/schema";

const integrationName = "Asana";
const entry = "https://app.asana.com/admin/members";

export const handler: APIGatewayProxyHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const payload: UserAccess = JSON.parse(event.body || "");
    const cookies: Cookie[] = payload?.cookies;

    // Start puppeteer / chrome-aws-lambda
    const [browser, page, error] = await instantiatePuppeteer(cookies);
    if (error) return formatResponse(500, "", error);

    page.on("request", (request) => {
      request.continue();
    });

    await page.goto(entry, { waitUntil: "networkidle0" });

    const xpath = '//*[@class="AdminConsoleMembersListRow-userEmail"]';
    await page.waitForXPath(xpath);
    const members = await page.$x(xpath);
    const memberEmails = await page.evaluate((...members) => {
      return members.map((e) => e.textContent);
    }, ...members);

    browser.close();

    if (memberEmails.length < 1) {
      return formatResponse(300, "Did not find any users");
    }
    return formatResponse(
      200,
      `...Found ${memberEmails.length} members: ${memberEmails}`,
    );
  } catch (err) {
    return formatResponse(500, "", err);
  }
};
