import { SignIn } from "@clerk/nextjs";

export default function Page() {
  const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
  const clerkSecretKey = process.env.CLERK_SECRET_KEY ?? "";

  if (!clerkPublishableKey.startsWith("pk_") || !clerkSecretKey.startsWith("sk_")) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <h1>Clerk is not configured</h1>
          <p>Add Clerk environment variables to enable sign-in for a hosted team deployment.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <SignIn
        fallbackRedirectUrl="/"
        forceRedirectUrl="/"
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
      />
    </main>
  );
}
