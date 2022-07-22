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

const integrationName = "Coda";
const entry = "https://coda.io";

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

    let userPreferences = null;
    let workspaces = null;
    let users: any[] = [];

    page.on("request", (request) => {
      request.continue();
    });

    page.on("response", async (response) => {
      if (
        response.url().includes("userPreferences") &&
        response.status() === 200
      ) {
        userPreferences = await response.json();
      }
      if (
        response.url().includes("workspaces?includeUser") &&
        response.status() === 200
      ) {
        workspaces = await response.json();
      }
    });

    await Promise.all([
      page.goto(entry, { waitUntil: "networkidle0" }),
      page.waitForNavigation({ waitUntil: "domcontentloaded" }),
    ]);

    if (!userPreferences || !workspaces) {
      return formatResponse(200, JSON.stringify("Payload not intercepted"));
    }

    const workspaceIds: string[] = workspaces?.workspaces.map((x) => {
      return x?.workspaceId;
    });

    for await (const workspaceId of workspaceIds) {
      page.on("response", async (response) => {
        if (response.url().includes("users?") && response.status() === 200) {
          const someUsers = await response.json();
          users = [...users, someUsers?.users];
        }
      });
      await Promise.all([
        page.goto(entry.concat(`/workspaces/${workspaceId}/members`), {
          waitUntil: "networkidle0",
        }),
        page.waitForNavigation({ waitUntil: "domcontentloaded" }),
      ]);
    }

    const flatUsers = users.flat();

    const mappedUsers: User[] = flatUsers.map((user) => {
      return {
        id: user?.userId,
        name: user?.name,
        role: user?.workspacePermissions?.workspaceUserRole,
        isAdmin:
          user?.workspacePermissions?.workspaceUserRole === "ADMIN"
            ? true
            : false,
        email: user?.loginId,
        photoString: user?.pictureUrl,
      };
    });

    const paymentPlan: PaymentPlan = {
      name: workspaces?.workspaces?.featureSetId,
      isFree: workspaces?.workspaces?.featureSetId === "Basic" ? true : false,
      price: undefined, //Need to upgrade to paid plan to do this
      nextInstallment: undefined,
    };

    const integrationUserDetails = mappedUsers.find((x) => {
      return x.id === userPreferences?.user?.real?.userId;
    });

    const scanReturn: ScanReturn = {
      inputData: payload.userAccess,
      integrationName: integrationName,
      integrationOrganisationId: workspaceIds[0],
      paymentPlan: paymentPlan,
      paymentPlanPrice: paymentPlan?.price,
      paymentPlanIsActive: paymentPlan?.nextInstallment === null ? false : true,
      paymentPlanIsTrial: paymentPlan?.isFree,
      integrationUserId: userPreferences?.user?.real?.userId,
      integrationUserName: userPreferences?.user?.real?.name,
      integrationUserEmail: userPreferences?.user?.real?.loginId,
      integrationUserImage: userPreferences?.user?.real?.pictureUrl,
      integrationUsers: mappedUsers,
      integrationWorkspaces: undefined,
      integrationUserRole: integrationUserDetails?.role,
      blob: {
        userPreferences: JSON.stringify(userPreferences),
        workspaces: JSON.stringify(workspaces),
        flatUsers: JSON.stringify(flatUsers),
      },
    };

    browser.close();

    return formatResponse(200, JSON.stringify(scanReturn));
  } catch (err) {
    return formatResponse(500, "", err);
  }
};
