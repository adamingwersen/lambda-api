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

const integrationName = "Miro";
const entry = "https://miro.com";
const queryStringAccountFields =
  "accounts/?fields=id%2Ctitle%2Ctype%2Crole%2Climits%2Ctrial%2Cexpired%2CexpirationDate%2CcreatedAt%2CcurrentUserPermission%2CcurrentUserConnection%7Bid%2CisAccountCreator%2ClastActivityDate%2Cpermissions%2CorganizationConnection%7Blicense%7D%2Crole%2CselfLink%2CsharedBoardsNumber%2Cuser%7Bemail%7D%7D%2Cfeatures%2CinvitationLink%2Corganization%7Bid%2CbillingData%2CcurrentUserPermission%2CidleTimeout%2Ctitle%2Cfeatures%2Ctype%2Cnotifications%2CdataClassification%7D%2Cpicture%2Cprojects%7Bid%2Ctitle%2CisStarred%7D%2Cintegrations%2CintercomEnabled%2CwhoCanInvite%2CinviteExternalUsersEnabled%2Ccredits%2CsharingPolicy%7BmoveBoardToAccountEnabled%7D%2CdomainJoinPolicy%2CdomainProps%2CjoinPolicyForExternal%2CparticipantPostInvitationPaymentTest%2Cnotifications%2CorganizationExtension%7BaccountDiscovery%7D%2CcollaborationSettings%2CusersNumber";

const queryStringUserConnections =
  "user-connections?fields=id%2Cuser%7Bid%2Cemail%2Cstate%2Cname%2Cpicture%7D%2ClastActivityDate%2Crole%2CdayPassesActivatedInLast30Days%2CorganizationConnection%7Blicense%2Crole%2CaccountsNumber%7D%2CuserAccessBoardsNumber&roles=ADMIN%2CUSER%2CEXTERNAL_USER";

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

    let accountFields = null;
    let userConnections: any[] = [];

    page.on("request", (request) => {
      request.continue();
    });

    page.on("response", async (response) => {
      if (
        response.url().includes(queryStringAccountFields) &&
        response.status() === 200
      ) {
        accountFields = await response.json();
      }
    });

    await page.goto(entry, { waitUntil: "networkidle0" });
    if (!accountFields) {
      return formatResponse(300, "Payload not intercepted");
    }

    if (!accountFields[0]?.id) {
      return formatResponse(300, "No account ID found");
    }

    const accountIds: string[] = accountFields.flatMap((x) => {
      return x?.id;
    });

    for await (const accountId of accountIds) {
      page.on("response", async (response) => {
        if (
          response.url().includes(queryStringUserConnections) &&
          response.status() === 200
        ) {
          userConnections = await [...userConnections, await response.json()];
        }
      });
      await Promise.all([
        page.goto(entry.concat(`/app/settings/team/${accountId}/users`), {
          waitUntil: "networkidle0",
        }),
        page.waitForNavigation({ waitUntil: "domcontentloaded" }),
      ]);
    }

    const mappedUsers: User[] = userConnections[0]?.data.map((user) => {
      return {
        id: user?.id,
        name: user?.name,
        role: user?.role,
        isAdmin: user?.role === "ADMIN" ? true : false,
        email: user?.user?.email,
        photoString: user?.user?.picture?.original,
      };
    });

    const paymentPlan: PaymentPlan = {
      name: accountFields[0]?.type,
      isFree: true, //accountFields[0]?.type.includes("FREE") === true ? true : false,
      price: 0.0, //Need to upgrade to paid plan to do this
      nextInstallment: undefined,
    };

    const scanReturn: ScanReturn = {
      inputData: payload.userAccess,
      integrationName: integrationName,
      integrationOrganisationId: accountFields[0]?.id,
      paymentPlan: paymentPlan,
      paymentPlanPrice: paymentPlan?.price,
      paymentPlanIsActive: paymentPlan?.nextInstallment === null ? false : true,
      paymentPlanIsTrial: paymentPlan?.isFree,
      integrationUserId: accountFields[0]?.currentUserPermission?.user?.id,
      integrationUserName: accountFields[0]?.currentUserPermission?.user?.name,
      integrationUserEmail:
        accountFields[0]?.currentUserPermission?.user?.email,
      integrationUserImage:
        accountFields[0]?.currentUserPermission?.user?.picture?.original,
      integrationUsers: mappedUsers,
      integrationWorkspaces: undefined,
      integrationUserRole: accountFields[0]?.currentUserPermission?.user?.role,
      blob: {
        accountFields: JSON.stringify(accountFields),
        userConnections: JSON.stringify(userConnections),
      },
    };

    browser.close();

    return formatResponse(200, JSON.stringify(scanReturn));
  } catch (err) {
    return formatResponse(500, "", err);
  }
};
