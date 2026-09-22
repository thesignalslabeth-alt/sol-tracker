import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { redirect } from "next/navigation";
import { clerkConfigured } from "@/lib/auth-config";

export default function SignInPage() {
  if (!clerkConfigured) redirect("/");
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-4">
      <SignIn />
      <Link href="/about" className="text-sm text-muted-foreground underline underline-offset-4">
        What is Trade Tracker?
      </Link>
    </main>
  );
}
