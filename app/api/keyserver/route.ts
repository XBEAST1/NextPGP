import { NextRequest, NextResponse } from 'next/server';
import { auth } from "@/auth";
import { rateLimit, validateCSRFToken, addSecurityHeaders } from "@/lib/security";
import { validateRequestSize, validateRequestBodySize } from "@/lib/request-limits";

const fetchWithTimeout = async (url: string, timeoutMs = 10000): Promise<Response> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

const KEYSERVERS = [
  'https://keyserver.ubuntu.com',
  'https://keys.openpgp.org',
];

const tryKeyserver = async (path: string): Promise<string> => {
  let lastError: unknown;
  for (const base of KEYSERVERS) {
    const url = `${base}${path}`;
    try {
      const res = await fetchWithTimeout(url);
      return await res.text();
    } catch (err) {
      lastError = err;
      console.warn(`Keyserver fetch failed for ${url}:`, err);
    }
  }
  throw lastError;
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResult = await rateLimit({
    windowMs: 60000,
    maxRequests: 100,  // IP limit: 100 requests per minute
    userId: session.user.id,
    endpoint: 'keyserver-get',
    userMaxRequests: 100  // User limit: 100 requests per minute
  }, request as any);

  if (!rateLimitResult.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const url = new URL(request.url);
  const searchParam = url.searchParams.get('search');
  const csrfToken = url.searchParams.get('csrfToken');

  if (!csrfToken || typeof csrfToken !== 'string') {
    return NextResponse.json({ error: "CSRF token required" }, { status: 403 });
  }

  if (!validateCSRFToken(csrfToken, session.user.id)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  if (!searchParam) {
    return NextResponse.json({ error: 'Missing search parameter' }, { status: 400 });
  }

  const terms = searchParam.split(',').map(s => s.trim()).filter(Boolean);

  const seenKeyIds = new Set<string>();
  const seenKeyBlocks = new Set<string>();
  const orderedKeyBlocks: string[] = [];

  const fetchKey = async (keyId: string): Promise<string | null> => {
    const lowerId = keyId.toLowerCase();
    if (seenKeyIds.has(lowerId)) return null;

    try {
      const keyText = await tryKeyserver(`/pks/lookup?op=get&search=0x${lowerId}`);
      const cleaned = keyText.replace(/^(Comment|Version):.*$/gm, '').trim();
      if (cleaned && !seenKeyBlocks.has(cleaned)) {
        seenKeyIds.add(lowerId);
        seenKeyBlocks.add(cleaned);
        return cleaned;
      }
    } catch (err) {
      console.warn(`Error fetching key 0x${keyId}:`, err);
    }

    return null;
  };

  for (const term of terms) {
    if (term.includes('@')) {
      try {
        const text = await tryKeyserver(`/pks/lookup?op=index&search=${encodeURIComponent(term)}`);
        const regex = /0x([A-Fa-f0-9]{16,40})/g;
        const matches = Array.from(text.matchAll(regex)).map(m => m[1].toLowerCase());
        const uniqueKeyIds = Array.from(new Set(matches));

        for (const id of uniqueKeyIds) {
          const key = await fetchKey(id);
          if (key) {
            orderedKeyBlocks.push(key);
          }
        }
      } catch (err) {
        console.warn(`Error fetching keys for email ${term}:`, err);
      }
    } else {
      const rawHex = term.replace(/[^a-fA-F0-9]/g, '');
      if (![16, 32, 40].includes(rawHex.length)) continue;
      const key = await fetchKey(rawHex);
      if (key) orderedKeyBlocks.push(key);
    }
  }

  const response = new NextResponse(orderedKeyBlocks.join('\n\n'), {
    headers: { 'Content-Type': 'text/plain' },
  });
  return addSecurityHeaders(response);
}

export async function POST(request: NextRequest) {
  try {
    const sizeError = validateRequestSize(request);
    if (sizeError) return sizeError;
    
    const jsonSizeError = await validateRequestBodySize(request);
    if (jsonSizeError) return jsonSizeError;

    const session = await auth();
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimitResult = await rateLimit({
      windowMs: 60000,
      maxRequests: 50,  // IP limit: 50 requests per minute
      userId: session.user.id,
      endpoint: 'keyserver-post',
      userMaxRequests: 50  // User limit: 50 requests per minute
    }, request as any);

    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const { publicKey, csrfToken } = await request.json();
    
    if (!csrfToken || typeof csrfToken !== 'string') {
      return NextResponse.json({ error: "CSRF token required" }, { status: 403 });
    }

    if (!validateCSRFToken(csrfToken, session.user.id)) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
    }
    
    if (!publicKey) {
      return NextResponse.json(
        { error: 'Missing publicKey in request body' },
        { status: 400 }
      );
    }

    const formData = new URLSearchParams();
    formData.append('keytext', publicKey);

    const upstreamRes = await fetch('https://keyserver.ubuntu.com/pks/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });

    const text = await upstreamRes.text();
    const response = new NextResponse(text, {
      status: upstreamRes.status,
      headers: { 'Content-Type': 'text/plain' },
    });
    return addSecurityHeaders(response);
  } catch (error) {
    console.error('Error publishing key:', error);
    return NextResponse.json({ error: 'Failed to publish key' }, { status: 500 });
  }
}
