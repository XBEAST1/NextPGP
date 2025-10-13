import { NextRequest, NextResponse } from 'next/server';

const MAX_REQUEST_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_JSON_SIZE = 5 * 1024 * 1024; // 5MB

export function validateRequestSize(request: NextRequest): NextResponse | null {
  const contentLength = request.headers.get('content-length');
  
  if (contentLength && parseInt(contentLength) > MAX_REQUEST_SIZE) {
    return NextResponse.json(
      { error: 'Request too large', code: 'REQUEST_TOO_LARGE' },
      { status: 413 }
    );
  }
  
  return null;
}

export async function validateJsonSize(request: NextRequest): Promise<NextResponse | null> {
  const contentLength = request.headers.get('content-length');
  
  if (contentLength && parseInt(contentLength) > MAX_JSON_SIZE) {
    return NextResponse.json(
      { error: 'JSON payload too large', code: 'JSON_TOO_LARGE' },
      { status: 413 }
    );
  }
  
  return null;
}

export async function validateRequestBodySize(request: NextRequest): Promise<NextResponse | null> {
  try {
    const clonedRequest = request.clone();
    const body = await clonedRequest.text();
    
    if (body.length > MAX_JSON_SIZE) {
      return NextResponse.json(
        { error: 'JSON payload too large', code: 'JSON_TOO_LARGE' },
        { status: 413 }
      );
    }
    
    return null;
  } catch (error) {
    return validateJsonSize(request);
  }
}

export function withRequestLimits(handler: Function) {
  return async (request: NextRequest, ...args: any[]) => {
    const sizeError = validateRequestSize(request);
    if (sizeError) return sizeError;
    
    if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
      const jsonSizeError = await validateRequestBodySize(request);
      if (jsonSizeError) return jsonSizeError;
    }
    
    return handler(request, ...args);
  };
}
