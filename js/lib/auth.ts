import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function auth() {
  return getServerSession(authOptions) as any;
}

export type Role = 'admin'|'vertrieb'|'viewer';
export const canWrite = (r?: Role) => r === 'admin' || r === 'vertrieb';
