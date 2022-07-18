import {
  APIGatewayProxyHandler,
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
} from "aws-lambda";
import { formatResponse, instantiatePuppeteer } from "../../libs/utils";
import {
  UserAccess,
  Cookie,
  User,
  ScanReturn,
  PaymentPlan,
} from "../../libs/schema";

const integrationName = "Zapier";
const entry = "https://zapier.com/app/dashboard";

export const handler: APIGatewayProxyHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    // Parse post data
    const {
      cookies,
      ...payload
    }: { cookies: Cookie[]; userAccess: Omit<UserAccess, "cookies"> } =
      JSON.parse(event?.body ?? "");

    // Start puppeteer / chrome-aws-lambda
    const [browser, page, error] = await instantiatePuppeteer(cookies);
    if (error) return formatResponse(500, "", error);

    // Intercept requests
    page.on("request", (request) => {
      request.continue();
    });

    // Intercept responses
    let accounts = null;
    let profiles = null;

    page.on("response", async (response) => {
      if (response.url().includes("v3/accounts") && response.status() === 200) {
        console.log(response.url());
        accounts = await response.json();
      }
      if (response.url().includes("v3/profiles") && response.status() === 200) {
        console.log(response.url());
        profiles = await response.json();
      }
    });

    // Visit page
    await Promise.all([await page.goto(entry, { waitUntil: "networkidle0" })]);

    console.log("Got to page");

    if (!accounts || !profiles) {
      return formatResponse(300, "Payload not intercepted");
    }

    console.log("Passed account/profile check");
    // console.log({ accounts });
    // console.log({ profiles });
    browser.close();

    const rawUserData: any[] = profiles?.objects[0]?.roles;
    const mappedUsers: User[] = rawUserData.map((user) => {
      return {
        id: user?.account_id,
        role: user?.role,
        isAdmin: user?.role === ("owner" || "admin") ? true : false,
        email: undefined, // This needs to be fixed (upgrade to paid plan)
        photoString: undefined,
      };
    });
    console.log("Mapped users");

    const paymentPlan: PaymentPlan = {
      name: accounts?.objects[0]?.plan?.name,
      isFree: accounts?.objects[0]?.plan?.name === "Free" ? true : false,
      price: accounts?.objects[0]?.plan?.name === "Free" ? 0.0 : 0.0, // This needs to be fixed
      nextInstallment: accounts?.objects[0]?.period_end,
    };

    console.log("Mapped PP");

    const scanReturn: ScanReturn = {
      inputData: payload.userAccess,
      integrationName: integrationName,
      integrationOrganisationId: accounts?.objects[0]?.id,
      paymentPlan: paymentPlan,
      paymentPlanPrice: accounts?.objects[0]?.plan?.name, // This needs to be fixed (upgrade to paid plan)
      paymentPlanIsActive: false, //accounts?.objects[0]?.plan?.metered_task_pricing,
      paymentPlanIsTrial: true, //accounts?.objects[0]?.is_paid,
      integrationUserId: accounts?.objects[0]?.owner?.id,
      integrationUserName: accounts?.objects[0]?.owner?.name,
      integrationUserEmail: accounts?.objects[0]?.owner?.email,
      integrationUserImage: profiles?.objects[0]?.photo_url,
      integrationUsers: mappedUsers,
      integrationWorkspaces: undefined,
      integrationUserRole: undefined,
      blob: {
        accounts: JSON.stringify(accounts),
        profiles: JSON.stringify(profiles),
      },
    };

    return formatResponse(200, JSON.stringify(scanReturn));
  } catch (err) {
    return formatResponse(500, "", err);
  }
};
