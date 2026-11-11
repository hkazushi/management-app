// ログパスの暗号化（ブラウザの Web Crypto を使う）。
//
// 仕組み:
//   - 利用者ごとに RSA の鍵ペアを1つ持つ。公開鍵で暗号化し、秘密鍵で復号する
//   - 秘密鍵は、マスターパスワードから作った鍵（PBKDF2 → AES-GCM）で暗号化して DB に置く
//   - だから「保存」はマスターパスワード無しでできる（このPCの自動収集も同じ公開鍵を使う）
//   - 「表示」はマスターパスワードを入れたブラウザの中でだけできる
//
// 暗号文の形式は claude/logpass.mjs と同じ（"v1.<鍵>.<IV>.<本文>"、各部分は base64）。変えるときは両方直す。

export const PBKDF2_ITERATIONS = 600_000;
export const MIN_MASTER_LENGTH = 10;

export type VaultRow = {
  public_key: string;
  enc_private_key: string;
  salt: string;
  iv: string;
  iterations: number;
};

const RSA = { name: "RSA-OAEP", hash: "SHA-256" } as const;

function b64(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function unb64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(new ArrayBuffer(n)));
}

async function masterKey(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

// 金庫を作る（最初の1回）。返した行を vaults に保存する。
export async function createVault(password: string): Promise<VaultRow> {
  const pair = await crypto.subtle.generateKey(
    { ...RSA, modulusLength: 3072, publicExponent: new Uint8Array([1, 0, 1]) },
    true,
    ["encrypt", "decrypt"],
  );
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await masterKey(password, salt, PBKDF2_ITERATIONS);
  const pkcs8 = await crypto.subtle.exportKey("pkcs8", pair.privateKey);
  const encPrivate = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, pkcs8);
  return {
    public_key: b64(await crypto.subtle.exportKey("spki", pair.publicKey)),
    enc_private_key: b64(encPrivate),
    salt: b64(salt),
    iv: b64(iv),
    iterations: PBKDF2_ITERATIONS,
  };
}

// マスターパスワードで秘密鍵を取り出す。パスワードが違えば例外になる。
export async function unlockVault(row: VaultRow, password: string): Promise<CryptoKey> {
  const key = await masterKey(password, unb64(row.salt), row.iterations);
  const pkcs8 = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(row.iv) }, key, unb64(row.enc_private_key));
  return crypto.subtle.importKey("pkcs8", pkcs8, RSA, false, ["decrypt"]);
}

// 公開鍵で暗号化する（マスターパスワード不要）
export async function encryptSecret(publicKey: string, plain: string): Promise<string> {
  const pub = await crypto.subtle.importKey("spki", unb64(publicKey), RSA, false, ["encrypt"]);
  const aesRaw = randomBytes(32);
  const aes = await crypto.subtle.importKey("raw", aesRaw, "AES-GCM", false, ["encrypt"]);
  const iv = randomBytes(12);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aes, new TextEncoder().encode(plain));
  const wrapped = await crypto.subtle.encrypt(RSA, pub, aesRaw);
  return `v1.${b64(wrapped)}.${b64(iv)}.${b64(ct)}`;
}

export async function decryptSecret(privateKey: CryptoKey, blob: string): Promise<string> {
  const [v, k, iv, ct] = blob.split(".");
  if (v !== "v1" || !k || !iv || !ct) throw new Error("暗号文の形式が違います");
  const aesRaw = await crypto.subtle.decrypt(RSA, privateKey, unb64(k));
  const aes = await crypto.subtle.importKey("raw", aesRaw, "AES-GCM", false, ["decrypt"]);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, aes, unb64(ct));
  return new TextDecoder().decode(plain);
}
