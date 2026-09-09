import { redirect } from "next/navigation";

export default async function LegacySessionRedirect({
  params,
}: {
  readonly params: Promise<{ readonly sessionId: string }>;
}) {
  const { sessionId } = await params;
  redirect(`/chat/${encodeURIComponent(sessionId)}`);
}
