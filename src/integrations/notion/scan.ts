import {
  APIGatewayProxyHandler,
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
} from "aws-lambda";
import { formatResponse, instantiatePuppeteer } from "../../libs/utils";
import {
  UserAccess,
  Cookie,
  ScanReturn,
  User,
  PaymentPlan,
} from "../../libs/schema";

const integrationName = "Notion";
const entry = "https://notion.so/";

export const handler: APIGatewayProxyHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const {
      cookies,
      ...payload
    }: { cookies: Cookie[]; userAccess: Omit<UserAccess, "cookies"> } =
      JSON.parse(event?.body ?? "");

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

    await Promise.all([
      page.goto(entry, { waitUntil: "networkidle0" }),
      page.waitForNavigation({ waitUntil: "domcontentloaded" }),
    ]);

    if (
      !userAnalyticsSettings ||
      !subscriptionDataBody ||
      !publicPageDataBody
    ) {
      return formatResponse(300, "Payload not intercepted");
    }

    const rawUserData: any[] = subscriptionDataBody?.users;
    const mappedUsers: User[] = rawUserData.map((user) => {
      return {
        id: user?.userId,
        role: user?.role,
        isAdmin: user?.role === "editor" ? true : false,
        email: undefined, // Needs to be fixed
        photoString: undefined, // Needs to be fixed
      };
    });

    browser.close();

    const paymentPlan: PaymentPlan = {
      name: subscriptionDataBody?.type,
      isFree: !subscriptionDataBody?.hasPaidNonzero,
      price: undefined, // This needs to be fixed - get upgraded trial
      nextInstallment: undefined,
    };

    const scanReturn: ScanReturn = {
      inputData: payload.userAccess,
      integrationName: integrationName,
      integrationOrganisationId: publicPageDataBody?.spaceDomain,
      paymentPlan: paymentPlan,
      paymentPlanPrice: undefined,
      paymentPlanIsActive: undefined,
      paymentPlanIsTrial: undefined,
      integrationUserId: userAnalyticsSettings?.user_id,
      integrationUserName: userAnalyticsSettings?.user_name,
      integrationUserEmail: userAnalyticsSettings?.email,
      integrationUserImage: undefined,
      integrationUsers: mappedUsers,
      integrationWorkspaces: undefined,
      integrationUserRole: undefined,
      blob: {
        current: JSON.stringify(userAnalyticsSettings),
        properties: JSON.stringify(subscriptionDataBody),
        user: JSON.stringify(publicPageDataBody),
      },
    };

    return formatResponse(200, JSON.stringify(scanReturn));
  } catch (err) {
    return formatResponse(500, "", err);
  }
};
