import { APIGatewayProxyResult } from 'aws-lambda';

export const formatResponse = (code: number, text?: string, error?): APIGatewayProxyResult => {
  if (code > 200) {
    return {
      statusCode: code,
      body: `Request failed: ${error}`,
    };
  }
  return {
    statusCode: code,
    body: `... ${text}`,
  };
};
