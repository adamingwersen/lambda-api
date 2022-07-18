import {
  APIGatewayProxyHandler,
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
} from "aws-lambda";
import { formatResponse, instantiatePuppeteer } from "../../libs/utils";
import { UserAccess, Cookie, ScanReturn, User } from "../../libs/schema";

const integrationName = "Metabase";
// const entry = 'https://[workspace].metabase.app';

export const handler: APIGatewayProxyHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const {
      cookies,
      ...payload
    }: { cookies: Cookie[]; userAccess: Omit<UserAccess, "cookies"> } =
      JSON.parse(event?.body ?? "");

    const domainCookie = cookies.find((obj) => {
      return obj.name === "metabase.SESSION";
    });
    const domain = domainCookie?.domain;
    if (!domain) {
      return formatResponse(300, "Could not identify domain cookie");
    }

    const entry = "https://".concat(domain).concat("/admin/people");

    // Start puppeteer / chrome-aws-lambda
    const [browser, page, error] = await instantiatePuppeteer(cookies);
    if (error) return formatResponse(500, "", error);

    let current = null;
    let properties = null;
    let user = null;

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
      if (response.url().includes("user?query") && response.status() === 200) {
        user = await response.json();
      }
      // if (response.url().includes("purchases") && response.status() === 200) {
      //   purchases = await response.json();
      // }
    });

    await Promise.all([
      page.goto(entry, { waitUntil: "networkidle0" }),
      page.waitForNavigation({ waitUntil: "domcontentloaded" }),
    ]);

    if (!current || !properties || !user) {
      return formatResponse(300, "Payload not intercepted");
    }

    browser.close();
    const rawUserData: any[] = user?.data;
    const mappedUsers: User[] = rawUserData.map((user) => {
      return {
        id: user?.id,
        name: undefined,
        role: undefined,
        isAdmin: user?.is_superuser,
        email: user?.email,
        photoString: undefined,
      };
    });

    const scanReturn: ScanReturn = {
      inputData: payload.userAccess,
      integrationName: integrationName,
      integrationOrganisationId: undefined,
      paymentPlan: undefined,
      paymentPlanPrice: undefined,
      paymentPlanIsActive: undefined,
      paymentPlanIsTrial: undefined,
      integrationUserId: current?.id,
      integrationUserName: current?.common_name,
      integrationUserEmail: current?.email,
      integrationUserImage: undefined,
      integrationUsers: mappedUsers,
      integrationWorkspaces: undefined,
      integrationUserRole: undefined,
      blob: {
        current: JSON.stringify(current),
        properties: JSON.stringify(properties),
        user: JSON.stringify(user),
      },
    };

    return formatResponse(200, JSON.stringify(scanReturn));
  } catch (err) {
    return formatResponse(500, "", err);
  }
};
