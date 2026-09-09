import { redirect } from "next/navigation";

export default function LegacySessionRedirect() {
  redirect("/chat");
}
