import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, LogIn, UserPlus, Eye, EyeOff } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import logoPath from "@assets/Favicon Transparent_1764235508342.ico";

export default function Login() {
  const { login, register, isPending, error } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!username.trim() || !password.trim()) {
      setLocalError("Please enter both username and password");
      return;
    }

    if (mode === "register") {
      if (password !== confirmPassword) {
        setLocalError("Passwords do not match");
        return;
      }
      if (password.length < 6) {
        setLocalError("Password must be at least 6 characters");
        return;
      }
      try {
        await register(username.trim(), password, name.trim() || undefined);
      } catch {
        // Error handled by useAuth
      }
    } else {
      try {
        await login(username.trim(), password);
      } catch {
        // Error handled by useAuth
      }
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <img src={logoPath} alt="Synergy Logo" className="h-20 w-20 mb-4" />
          <h1 className="font-josefin font-semibold text-2xl text-foreground">
            Synergy Project Controls
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Programme Management Dashboard
          </p>
        </div>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">
              {mode === "login" ? "Sign In" : "Create Account"}
            </CardTitle>
            <CardDescription>
              {mode === "login"
                ? "Enter your credentials to access the dashboard"
                : "Fill in your details to get started"
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {(error || localError) && (
                <Alert variant="destructive" className="text-sm">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{localError || error}</AlertDescription>
                </Alert>
              )}

              {mode === "register" && (
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Enter your full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    data-testid="input-name"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                  data-testid="input-username"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    className="pr-10"
                    data-testid="input-password"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                    data-testid="button-toggle-password"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {mode === "register" && (
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    data-testid="input-confirm-password"
                  />
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={isPending}
                data-testid="button-submit-auth"
              >
                {isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    {mode === "login" ? "Signing in..." : "Creating account..."}
                  </span>
                ) : mode === "login" ? (
                  <span className="flex items-center gap-2">
                    <LogIn className="h-4 w-4" />
                    Sign In
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <UserPlus className="h-4 w-4" />
                    Create Account
                  </span>
                )}
              </Button>
            </form>

            <div className="mt-4 text-center text-sm">
              {mode === "login" ? (
                <span>
                  Don't have an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setMode("register");
                      setLocalError(null);
                    }}
                    className="text-primary hover:underline font-medium"
                    data-testid="button-switch-register"
                  >
                    Create one
                  </button>
                </span>
              ) : (
                <span>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setMode("login");
                      setLocalError(null);
                    }}
                    className="text-primary hover:underline font-medium"
                    data-testid="button-switch-login"
                  >
                    Sign in
                  </button>
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
