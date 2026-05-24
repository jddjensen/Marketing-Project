import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How the Marketing Platform collects, stores, and uses information.",
};

const LAST_UPDATED = "May 22, 2026";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <header className="apple-header sticky top-0 z-40">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
          <Link
            href="/"
            transitionTypes={["nav-back"]}
            className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
          >
            ← Marketing Platform
          </Link>
          <span className="text-xs text-zinc-500">
            Last updated {LAST_UPDATED}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-8 px-6 py-10">
        <section>
          <h1 className="text-3xl font-semibold tracking-tight">
            Privacy Policy
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            The Marketing Platform is an internal workspace for planning
            campaigns, organizing creative, and measuring performance. This page
            explains what information the platform stores, why, and how it is
            protected.
          </p>
        </section>

        <Section title="Who runs this platform">
          <p>
            The Marketing Platform is operated by the team that hosts this
            deployment for the purpose of coordinating their own marketing work.
            It is not a consumer product and is not offered as a service to the
            general public.
          </p>
        </Section>

        <Section title="What we store">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Account information.</strong> Email address and an
              encrypted password (or single-sign-on identifier) used to sign in.
              Authentication is handled by Supabase Auth.
            </li>
            <li>
              <strong>Campaign &amp; project content.</strong> Projects, channel
              plans, copy, briefs, search terms, and any files you upload as
              creative assets (images, video, posters). Storage is provided by
              Supabase Storage.
            </li>
            <li>
              <strong>Tracking link metadata.</strong> When a visitor follows a
              tracking link or scans a QR code, the platform records the link
              identifier, a truncated user-agent string, the referring URL (when
              the browser sends one), and a timestamp. We do not store IP
              addresses or precise location data.
            </li>
            <li>
              <strong>Google Analytics connection.</strong> If you connect a
              Google Analytics property, the platform stores the OAuth refresh
              token and property identifiers needed to read metrics on your
              behalf. You can disconnect at any time from Settings.
            </li>
            <li>
              <strong>Error telemetry (optional).</strong> When configured,
              errors are reported to Sentry to help us fix bugs. Reports include
              stack traces and the URL where the error occurred. They do not
              include the contents of uploaded files.
            </li>
          </ul>
        </Section>

        <Section title="What we do not do">
          <ul className="list-disc space-y-2 pl-5">
            <li>We do not sell or rent your data to third parties.</li>
            <li>
              We do not run advertising trackers or third-party analytics on
              this app.
            </li>
            <li>
              We do not share campaign content with anyone outside your team.
            </li>
          </ul>
        </Section>

        <Section title="How we protect data">
          <ul className="list-disc space-y-2 pl-5">
            <li>All traffic is served over HTTPS.</li>
            <li>
              Database access is gated by Supabase Row Level Security so
              unauthenticated requests are rejected.
            </li>
            <li>
              File uploads are validated by content type, size, and magic-byte
              sniffing before they are persisted.
            </li>
            <li>
              Security headers (Content-Security-Policy,
              Strict-Transport-Security, X-Frame-Options, Referrer-Policy,
              Permissions-Policy) are applied to every response.
            </li>
          </ul>
        </Section>

        <Section title="Cookies and local storage">
          <p>
            The platform uses first-party cookies set by Supabase Auth to keep
            you signed in. It also stores your appearance preferences (color
            mode and theme) in <code>localStorage</code> so they persist between
            visits. No third-party tracking cookies are used.
          </p>
        </Section>

        <Section title="Data retention and deletion">
          <p>
            Campaign data is retained for as long as the project exists.
            Archiving a project hides it from default views but preserves its
            history so you can restore it. To permanently delete an account or
            specific data, contact the workspace administrator.
          </p>
        </Section>

        <Section title="Children">
          <p>
            This platform is intended for internal use by adult marketing staff
            and is not directed at children under 13.
          </p>
        </Section>

        <Section title="Changes to this policy">
          <p>
            We may update this policy as the platform evolves. Material changes
            will be reflected in the &ldquo;last updated&rdquo; date at the top
            of the page.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            For questions about this policy or to request data access or
            deletion, contact your workspace administrator.
          </p>
        </Section>
      </main>

      <footer className="mx-auto max-w-3xl px-6 py-10 text-xs text-zinc-500">
        <Link
          href="/"
          transitionTypes={["nav-back"]}
          className="hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          ← Back to Marketing Platform
        </Link>
      </footer>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="space-y-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
        {children}
      </div>
    </section>
  );
}
