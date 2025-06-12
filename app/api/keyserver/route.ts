import { NextRequest, NextResponse } from 'next/server';

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
  const url = new URL(request.url);
  const search = url.searchParams.get('search');

  if (!search) {
    return NextResponse.json({ error: 'Missing search parameter' }, { status: 400 });
  }

  // Email-based lookup
  if (search.includes('@')) {
    const indexPath = `/pks/lookup?op=index&search=${encodeURIComponent(search)}`;
    console.log('Searching email on keyservers:', search);

    try {
      const text = await tryKeyserver(indexPath);
      const regex = /0x([A-Fa-f0-9]{16,40})/g;
      let match;
      const keyIds: string[] = [];

      while ((match = regex.exec(text)) !== null) {
        keyIds.push(match[1].trim().toLowerCase());
      }

      const uniqueKeyIds = Array.from(new Set(keyIds));
      const keys = await Promise.all(
        uniqueKeyIds.map(async (id) => {
          const getPath = `/pks/lookup?op=get&search=0x${id}`;
          const keyText = await tryKeyserver(getPath);
          return keyText.replace(/^(Comment|Version):.*$/gm, '').trim();
        })
      );

      const uniqueKeys = Array.from(new Set(keys));
      return new NextResponse(uniqueKeys.join('\n'), {
        headers: { 'Content-Type': 'text/plain' },
      });
    } catch (error) {
      console.error('Error fetching email keys:', error);
      return NextResponse.json({ error: 'Failed to fetch email keys' }, { status: 500 });
    }
  }

  // Fingerprint or key-ID lookup
  const rawHex = search.replace(/[^a-fA-F0-9]/g, '');
  if (![16, 32, 40].includes(rawHex.length)) {
    return NextResponse.json(
      { error: 'Invalid key ID or fingerprint format' },
      { status: 400 }
    );
  }

  const getPath = `/pks/lookup?op=get&search=0x${rawHex}`;
  console.log('Fetching key by ID/fingerprint:', rawHex);

  try {
    let text = await tryKeyserver(getPath);
    text = text.replace(/^(Comment|Version):.*$/gm, '').trim();
    return new NextResponse(text, {
      headers: { 'Content-Type': 'text/plain' },
    });
  } catch (error) {
    console.error('Error fetching PGP key:', error);
    return NextResponse.json({ error: 'Failed to fetch from keyserver' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { publicKey } = await request.json();
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
    return new NextResponse(text, {
      status: upstreamRes.status,
      headers: { 'Content-Type': 'text/plain' },
    });
  } catch (error) {
    console.error('Error publishing key:', error);
    return NextResponse.json({ error: 'Failed to publish key' }, { status: 500 });
  }
}
