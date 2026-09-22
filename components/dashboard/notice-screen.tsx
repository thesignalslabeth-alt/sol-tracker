import { UserButton } from "@clerk/nextjs";
import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function NoticeScreen({
  title,
  children,
  showUserButton = false,
}: {
  title: string;
  children: ReactNode;
  showUserButton?: boolean;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{title}</CardTitle>
          {showUserButton && <UserButton />}
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">{children}</CardContent>
      </Card>
    </main>
  );
}
