import "server-only";
import { fail } from "@/lib/api";
import { isAdmin } from "./admin";

/** Returns an error response when the caller is not an authenticated administrator. */
export async function requireAdmin() {
  if (!(await isAdmin())) return fail("Administrator sign-in required.", 401);
  return null;
}
