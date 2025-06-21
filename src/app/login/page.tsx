
import { LoginForm } from "@/components/login-form";
import { CheckSquare } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center justify-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
            <CheckSquare className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">CheckMate</h1>
          <p className="text-muted-foreground">Sign in to your account.</p>
        </div>
        <LoginForm />
        <div className="mt-4 text-center text-sm">
          Need an account?{" "}
          <Link href="/register" className="underline">
            Register here
          </Link>
        </div>
      </div>
    </div>
  );
}
