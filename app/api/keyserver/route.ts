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
  const searchParam = url.searchParams.get('search');

  if (!searchParam) {
    return NextResponse.json({ error: 'Missing search parameter' }, { status: 400 });
  }

  // Split comma-separated searches
  const terms = searchParam.split(',').map(s => s.trim()).filter(Boolean);

  // Helper to fetch keys for a single term
  const fetchForTerm = async (term: string): Promise<string> => {
    // Email-based lookup
    if (term.includes('@')) {
      const indexPath = `/pks/lookup?op=index&search=${encodeURIComponent(term)}`;
      try {
        const text = await tryKeyserver(indexPath);
        const regex = /0x([A-Fa-f0-9]{16,40})/g;
        let match;
        const keyIds: string[] = [];
        while ((match = regex.exec(text)) !== null) {
          keyIds.push(match[1].toLowerCase());
        }
        const uniqueKeyIds = Array.from(new Set(keyIds));
        const keys = await Promise.all(
          uniqueKeyIds.map(async id => {
            const getPath = `/pks/lookup?op=get&search=0x${id}`;
            const keyText = await tryKeyserver(getPath);
            return keyText.replace(/^(Comment|Version):.*$/gm, '').trim();
          })
        );
        return Array.from(new Set(keys)).join('\n');
      } catch (err) {
        console.warn(`Error fetching email keys for ${term}:`, err);
        return `Error fetching email keys for ${term}`;
      }
    }

    // Fingerprint or key-ID lookup
    const rawHex = term.replace(/[^a-fA-F0-9]/g, '');
    if (![16, 32, 40].includes(rawHex.length)) {
      return `Invalid key ID or fingerprint: ${term}`;
    }
    try {
      let text = await tryKeyserver(`/pks/lookup?op=get&search=0x${rawHex}`);
      return text.replace(/^(Comment|Version):.*$/gm, '').trim();
    } catch (err) {
      console.warn(`Error fetching PGP key for ${term}:`, err);
      return `Error fetching PGP key for ${term}`;
    }
  };

  // Fetch all terms in parallel
  const outputs = await Promise.all(terms.map(fetchForTerm));
  const body = outputs.join('\n\n');

  return new NextResponse(body, {
    headers: { 'Content-Type': 'text/plain' }
  });
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
