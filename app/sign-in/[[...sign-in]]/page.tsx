import { SignIn } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { clerkConfigured } from "@/lib/auth-config";

export default function SignInPage() {
  if (!clerkConfigured) redirect("/");
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <SignIn />
    </main>
  );
}
