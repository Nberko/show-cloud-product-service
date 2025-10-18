import {
  APIGatewayAuthorizerResult,
  APIGatewayTokenAuthorizerEvent
} from 'aws-lambda';

export const handler = async (
  event: APIGatewayTokenAuthorizerEvent
): Promise<APIGatewayAuthorizerResult> => {
  console.log('Authorizer event:', JSON.stringify(event, null, 2));

  const authorizationToken = event.authorizationToken;

  // Check if Authorization header is provided
  if (!authorizationToken) {
    console.log('No authorization token provided');
    throw new Error('Unauthorized'); // This will result in 401
  }

  try {
    // Extract the token from "Basic <token>"
    const tokenParts = authorizationToken.split(' ');

    if (tokenParts.length !== 2 || tokenParts[0] !== 'Basic') {
      console.log('Invalid authorization token format');
      throw new Error('Unauthorized');
    }

    const token = tokenParts[1];

    // Decode base64 token
    const decodedToken = Buffer.from(token, 'base64').toString('utf-8');
    console.log('Decoded token:', decodedToken);

    // Parse username:password
    const [username, password] = decodedToken.split(':');

    if (!username || !password) {
      console.log('Invalid token structure');
      throw new Error('Unauthorized');
    }

    // Get credentials from environment variables
    const envPassword = process.env[username];

    // Check if credentials are valid
    if (!envPassword || envPassword !== password) {
      console.log(`Access denied for user: ${username}`);
      // Return Deny policy for 403
      return generatePolicy(username, 'Deny', event.methodArn);
    }

    console.log(`Access granted for user: ${username}`);
    // Return Allow policy for authorized user
    return generatePolicy(username, 'Allow', event.methodArn);

  } catch (error) {
    console.error('Authorization error:', error);
    throw new Error('Unauthorized'); // This will result in 401
  }
};

function generatePolicy(
  principalId: string,
  effect: 'Allow' | 'Deny',
  resource: string
): APIGatewayAuthorizerResult {
  return {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: resource,
        },
      ],
    },
  };
}
