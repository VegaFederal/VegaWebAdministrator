'use strict';

/**
 * Example Lambda function that responds to API Gateway events
 */
exports.handler = async (event) => {
  console.log('Event received:', JSON.stringify(event, null, 2));
  
  try {
    // Parse the incoming request
    const method = event.httpMethod || event.requestContext?.http?.method;
    const path = event.path || event.rawPath;
    
    // Default response
    let response = {
      message: 'Hello from AWS!',
      timestamp: new Date().toISOString(),
      path: path,
      method: method
    };
    
    // Return formatted response
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*', // For CORS support
        'Access-Control-Allow-Credentials': true
      },
      body: JSON.stringify(response)
    };
  } catch (error) {
    console.error('Error:', error);
    
    // Return error response
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true
      },
      body: JSON.stringify({
        message: 'Internal server error',
        errorMessage: error.message
      })
    };
  }
};