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
  PaymentPlan,
  ScanReturn,
} from "../../libs/schema";

const integrationName = "Figma";
const entry = "https://www.figma.com/";

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

    let sessionState = null;
    let userState = null;
    let rolesTeam: any[] = [];
    let summaries: any[] = [];

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

    await page.goto(entry.concat("files"), { waitUntil: "networkidle0" });

    if (!sessionState || !userState) {
      return formatResponse(300, "Payload not intercepted");
    }
    const rawUserTeamData: any[] = userState?.meta?.team_users;
    const teamIds: string[] = rawUserTeamData.map((team) => {
      return team?.team_id;
    });

    // TODO: This should be expanded to handle Organisations as well - Figma has this weird way of splitting it up.
    for await (const teamId of teamIds) {
      console.log(teamId, typeof teamId);
      page.on("response", async (response) => {
        if (
          response.url().includes(`roles/team/${teamId}`) &&
          response.status() === 200
        ) {
          rolesTeam = await [...rolesTeam, await response.json()];
        }
      });
      await Promise.all([
        page.goto(entry.concat(`files/team/${teamId}`), {
          waitUntil: "networkidle0",
        }),
        page.waitForNavigation({ waitUntil: "domcontentloaded" }),
      ]);
    }

    if (!rolesTeam) {
      return formatResponse(300, "Could not find any teams");
    }

    const flatUsers: any[] = rolesTeam.flatMap((u) => {
      return u?.meta;
    });

    const mappedUsers: User[] = flatUsers.map((user) => {
      return {
        id: user?.user?.id,
        name: user?.user?.handle,
        role: undefined,
        isAdmin: undefined,
        email: user?.pending_email === null ? undefined : user?.pending_email,
        photoString: user?.user?.img_url,
      };
    });

    const uniqueUsers: User[] = [
      ...new Map(mappedUsers.map((item) => [item["id"], item])).values(),
    ];

    for await (const teamId of teamIds) {
      page.on("response", async (response) => {
        if (response.url().includes("summary") && response.status() === 200) {
          summaries = await [...summaries, await response.json()];
        }
      });
      await Promise.all([
        page.goto(entry.concat(`files/team/${teamId}/billing`), {
          waitUntil: "networkidle0",
        }),
        page.waitForNavigation({ waitUntil: "domcontentloaded" }),
      ]);
    }

    browser.close();

    const flatSummaries: any[] = summaries.flatMap((s) => {
      return s?.meta;
    });

    const paymentPlan: PaymentPlan = {
      name: flatSummaries[0]?.last_monthly_invoice?.product_name,
      isFree:
        flatSummaries[0]?.annual_subscription === null &&
        flatSummaries[0]?.monthly_subscription === null
          ? true
          : false,
      price:
        flatSummaries[0]?.monthly_subscription === null
          ? flatSummaries[0]?.annual_subscription?.estimated_amount_due
          : flatSummaries[0]?.monthly_subscription?.estimated_amount_due * 12,
      nextInstallment:
        flatSummaries[0]?.monthly_subscription === null
          ? flatSummaries[0]?.annual_subscription?.current_period_end
          : flatSummaries[0]?.monthly_subscription?.current_period_end,
    };

    console.log(paymentPlan);

    const scanReturn: ScanReturn = {
      inputData: payload.userAccess,
      integrationName: integrationName,
      integrationOrganisationId: teamIds[0],
      paymentPlan: paymentPlan,
      paymentPlanPrice: paymentPlan?.price,
      paymentPlanIsActive: paymentPlan?.nextInstallment === null ? false : true,
      paymentPlanIsTrial: paymentPlan?.isFree,
      integrationUserId: sessionState?.meta?.users[0]?.id,
      integrationUserName: sessionState?.meta?.users[0]?.name,
      integrationUserEmail: sessionState?.meta?.users[0]?.email,
      integrationUserImage: sessionState?.meta?.users[0]?.img_url,
      integrationUsers: uniqueUsers,
      integrationWorkspaces: undefined,
      integrationUserRole: undefined,
      blob: {
        rolesTeam: JSON.stringify(rolesTeam),
        userState: JSON.stringify(userState),
        sessionState: JSON.stringify(sessionState),
        summaries: JSON.stringify(summaries),
      },
    };

    return formatResponse(200, JSON.stringify(scanReturn));
  } catch (err) {
    return formatResponse(500, "", err);
  }
};
