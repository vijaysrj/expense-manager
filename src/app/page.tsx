import { cookies } from "next/headers";
import Chat from "@/components/Chat";
import Landing from "@/components/Landing";
import { readSession, SESSION_COOKIE } from "@/lib/auth";

// Signed-in visitors go straight to the chat; everyone else sees the landing page.
export default async function Home() {
  const session = await readSession((await cookies()).get(SESSION_COOKIE)?.value);
  return session ? <Chat /> : <Landing />;
}
