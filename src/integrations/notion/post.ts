import { APIGatewayProxyHandler, APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

export const handler: APIGatewayProxyHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const parsedBody = JSON.parse(event.body || '');
    return {
      statusCode: 200,
      body: `I got... service = ${parsedBody?.service}`,
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: 'I did not get it',
    };
  }
};
