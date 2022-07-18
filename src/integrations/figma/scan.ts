import {
  APIGatewayProxyHandler,
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
} from "aws-lambda";
import { formatResponse, instantiatePuppeteer } from "../../libs/utils";
import { UserAccess, Cookie, User } from "../../libs/schema";

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

    browser.close();

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

    // const paymentPlan: PaymentPlan = {
    //   name: accounts?.objects[0]?.plan?.name,
    //   isFree: accounts?.objects[0]?.plan?.name === "Free" ? true : false,
    //   price: accounts?.objects[0]?.plan?.name === "Free" ? 0.0 : 0.0, // This needs to be fixed
    //   nextInstallment: accounts?.objects[0]?.period_end,
    // };

    // const scanReturn: ScanReturn = {
    //   inputData: payload.userAccess,
    //   integrationName: integrationName,
    //   integrationOrganisationId: accounts?.objects[0]?.id,
    //   paymentPlan: paymentPlan,
    //   paymentPlanPrice: accounts?.objects[0]?.plan?.name, // This needs to be fixed (upgrade to paid plan)
    //   paymentPlanIsActive: false, //accounts?.objects[0]?.plan?.metered_task_pricing,
    //   paymentPlanIsTrial: !accounts?.objects[0]?.is_paid,
    //   integrationUserId: accounts?.objects[0]?.owner?.id,
    //   integrationUserName: accounts?.objects[0]?.owner?.name,
    //   integrationUserEmail: accounts?.objects[0]?.owner?.email,
    //   integrationUserImage: profiles?.objects[0]?.photo_url,
    //   integrationUsers: mappedUsers,
    //   integrationWorkspaces: undefined,
    //   integrationUserRole: undefined,
    //   blob: {
    //     rolesTeam: JSON.stringify(rolesTeam),
    //     userState: JSON.stringify(userState),
    //     sessionState: JSON.stringify(sessionState),
    //   },
    // };

    return formatResponse(200, JSON.stringify(rolesTeam));
  } catch (err) {
    return formatResponse(500, "", err);
  }
};
