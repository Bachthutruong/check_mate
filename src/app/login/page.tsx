import { LoginForm } from "@/components/login-form";
import { CheckSquare } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center justify-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
            <CheckSquare className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">CheckMate</h1>
          <p className="text-muted-foreground">Welcome! Select a user to sign in.</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
