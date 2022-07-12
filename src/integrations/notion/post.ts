import { APIGatewayProxyHandler, APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { formatResponse } from '../../libs/utils';
import { UserAccess } from '../../libs/schema';

export const handler: APIGatewayProxyHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const parsedBody: UserAccess = JSON.parse(event.body || '');
    return formatResponse(200, JSON.stringify(parsedBody));
  } catch (err) {
    return formatResponse(500, '', err);
  }
};
