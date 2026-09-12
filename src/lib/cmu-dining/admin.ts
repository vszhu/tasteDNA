import { timingSafeEqual } from "node:crypto";

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice("Bearer ".length).trim();
  return token || null;
}

export function isAuthorizedCmuSyncRequest(request: Request, expectedSecret: string) {
  const supplied = bearerToken(request);
  if (!supplied || !expectedSecret) return false;
  const suppliedBytes = Buffer.from(supplied);
  const expectedBytes = Buffer.from(expectedSecret);
  return suppliedBytes.length === expectedBytes.length && timingSafeEqual(suppliedBytes, expectedBytes);
}
