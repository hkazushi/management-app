// リンク先のページから、商品画像（og:image）の URL を取り出す。取れなければ null。

const LIMIT = 1_500_000; // 読むのはここまで（og:image は head にあるので十分）

// 自分のサーバーの中や、内向きのアドレスは読みに行かない
function allowed(u: URL): boolean {
  if (u.protocol !== "https:" && u.protocol !== "http:") return false;
  const h = u.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || !h.includes(".")) return false;
  if (/^[\d.]+$/.test(h) || h.includes(":") || h.startsWith("[")) return false; // IP アドレスの直指定
  return true;
}

function pick(html: string): string | null {
  const head = html.slice(0, LIMIT);
  for (const key of ["og:image:secure_url", "og:image", "twitter:image"]) {
    const k = key.replace(/[.:]/g, "\\$&");
    const m =
      head.match(new RegExp(`<meta[^>]+(?:property|name)=["']${k}["'][^>]*?content=["']([^"']+)["']`, "i")) ??
      head.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*?(?:property|name)=["']${k}["']`, "i"));
    if (m?.[1]) return m[1].replace(/&amp;/g, "&");
  }
  return null;
}

export async function fetchOgImage(pageUrl: string, timeoutMs = 3500): Promise<string | null> {
  try {
    const u = new URL(pageUrl);
    if (!allowed(u)) return null;
    const res = await fetch(u, {
      // 通販サイトの多くは、SNS のリンク読み取りと名乗ると画像つきのページを返す
      headers: { "User-Agent": "facebookexternalhit/1.1", Accept: "text/html" },
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    if (!res.ok || !res.body || !allowed(new URL(res.url))) return null;

    // 大きいページを最後まで読まない。見つかった時点でやめる
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let html = "";
    let found: string | null = null;
    while (html.length < LIMIT) {
      const { done, value } = await reader.read();
      if (done) break;
      html += dec.decode(value, { stream: true });
      found = pick(html);
      if (found || /<\/head>/i.test(html)) break;
    }
    reader.cancel().catch(() => {});
    found ??= pick(html);
    if (!found) return null;

    const img = new URL(found, res.url);
    if (!allowed(img)) return null;
    const s = img.toString();
    return s.length <= 1000 ? s : null;
  } catch {
    return null;
  }
}
