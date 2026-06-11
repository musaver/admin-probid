// Client for calling OwnMidwest's APIs (the reverse direction: BidBridge -> OwnMidwest).
// Handles login + token caching. Credentials come from env.

const BASE = process.env.OWNMIDWEST_API_BASE ?? 'https://data.ownmidwest.com/api';
const EMAIL = process.env.OWNMIDWEST_EMAIL ?? '';
const PASSWORD = process.env.OWNMIDWEST_PASSWORD ?? '';

let cachedToken: string | null = null;
let tokenExpiry = 0; // epoch ms

export type OmResult = { ok: boolean; status: number; text: string };

async function login(): Promise<string> {
  if (!EMAIL || !PASSWORD) throw new Error('OWNMIDWEST_EMAIL / OWNMIDWEST_PASSWORD not configured');
  const res = await fetch(`${BASE}/UserMaster/Login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`OwnMidwest login failed (${res.status}): ${text}`);

  let token = '';
  try {
    const j = JSON.parse(text);
    token = typeof j === 'string' ? j : Array.isArray(j) ? (j[0]?.token ?? '') : (j.token ?? j.Token ?? '');
  } catch {
    token = text.trim().replace(/^"+|"+$/g, ''); // API returns a bare JWT string
  }
  if (!token) throw new Error('OwnMidwest login: no token in response');

  cachedToken = token;
  tokenExpiry = Date.now() + 23 * 60 * 60 * 1000; // refresh ~1h before the 24h expiry
  return token;
}

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  return login();
}

async function authedPost(path: string, body: unknown): Promise<OmResult> {
  let token = await getToken();
  const call = (t: string) =>
    fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', AuthToken: t },
      body: JSON.stringify(body),
    });

  console.log(`[ownmidwest] POST ${path} — token length=${token?.length ?? 0}, prefix=${(token || '').slice(0, 12)}`);
  let res = await call(token);
  let peek = await res.clone().text();
  // Refresh + retry once on any token-related rejection. OwnMidwest signals an expired/bad
  // token as 400/401 "No Token Found!!!" OR as 500 "IDX10000 ... 'token' ... null".
  const looksLikeTokenError =
    (res.status === 400 || res.status === 401 || res.status === 500) &&
    /no token|idx10000|parameter 'token'/i.test(peek);
  if (looksLikeTokenError) {
    console.warn(`[ownmidwest] POST ${path} token rejected (HTTP ${res.status}): ${peek.slice(0, 120)} — forcing fresh login + retry`);
    token = await login();
    console.log(`[ownmidwest] retry POST ${path} — fresh token length=${token?.length ?? 0}`);
    res = await call(token);
    peek = await res.text();
    return { ok: res.ok, status: res.status, text: peek };
  }
  const text = await res.text();
  return { ok: res.ok, status: res.status, text };
}

async function authedGet(path: string): Promise<OmResult> {
  const token = await getToken();
  const res = await fetch(`${BASE}${path}`, { headers: { AuthToken: token } });
  const text = await res.text();
  return { ok: res.ok, status: res.status, text };
}

export const ownmidwest = {
  login,
  addTaxSale: (body: unknown) => authedPost('/TaxSale/AddTaxSale', body),
  updateTaxSale: (body: unknown) => authedPost('/TaxSale/UpdateTaxSale', body),
  updateTaxSaleStatus: (body: unknown) => authedPost('/TaxSale/UpdateTaxSaleStatus', body),
  updateOwnerInfo: (body: unknown) => authedPost('/OwnerInfo/UpdatePropertyOwnerInfo', body),
  updateAddress: (body: unknown) => authedPost('/PropertyInfo/UpdatePropertyAddress', body),
  getTaxSaleInfo: (mapId: string, countyId: number) =>
    authedGet(`/TaxSale/GetTaxSaleInfoByMapIdAndCountyId?MapId=${encodeURIComponent(mapId)}&CountyId=${countyId}`),
  // Lookup endpoints used to seed sync_lookup (county + status id mappings).
  getAllCounty: () => authedGet('/TaxSale/GetAllCounty'),
  getAllTaxSalesStatus: () => authedGet('/TaxSale/GetAllTaxSalesStatus'),
  getAllCompetitorStatus: () => authedGet('/TaxSale/GetAllCompetitorStatus'),
};
