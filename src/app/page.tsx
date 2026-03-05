import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import SaaSTemplate from "@/components/ui/saa-s-template";

export default async function Home() {
  const session = await auth();
  if (session) {
    redirect("/dashboard");
  }
  return <SaaSTemplate />;
}
