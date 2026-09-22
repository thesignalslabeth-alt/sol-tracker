import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { redirect } from "next/navigation";
import { clerkConfigured } from "@/lib/auth-config";

export default function SignInPage() {
  if (!clerkConfigured) redirect("/");
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-4">
      {/* Sign-in is Google-only; hide Clerk's "Sign up" link so nobody is sent to the email sign-up form. */}
      <SignIn appearance={{ elements: { footerAction: { display: "none" } } }} />
      <Link href="/about" className="text-sm text-muted-foreground underline underline-offset-4">
        What is Trade Tracker?
      </Link>
    </main>
  );
}
