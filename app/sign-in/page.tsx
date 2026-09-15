import { Suspense } from "react";
import SignInForm from "./form";

export const metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <main className="auth">
      <div className="auth__card">
        <p className="logo logo--dark">
          <span className="logo__mark" />
          Suite
        </p>
        <h1 className="t-display-3">Sign in</h1>
        <p className="t-doc">
          No password. Either sign in with Google, or we send a six digit code
          to your email.
        </p>
        <Suspense>
          <SignInForm />
        </Suspense>
      </div>
    </main>
  );
}
