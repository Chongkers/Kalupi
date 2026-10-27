import { CONTACT_EMAIL, LEGAL_UPDATED } from "@/lib/legal";

// Plain-language Terms and Privacy Policy, shown in LegalDialog.
// Keep the Privacy Policy true to what the app does: if data handling changes, update it here
// and bump LEGAL_UPDATED / LEGAL_VERSION in src/lib/legal.ts.

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-semibold text-foreground">{title}</h3>
      {children}
    </section>
  );
}

function List({ children }: { children: React.ReactNode }) {
  return <ul className="flex list-disc flex-col gap-1 pl-5">{children}</ul>;
}

const Email = () => (
  <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-primary underline underline-offset-2">
    {CONTACT_EMAIL}
  </a>
);

export function TermsText() {
  return (
    <div className="flex flex-col gap-5 text-sm leading-relaxed text-muted-foreground">
      <p>Last updated {LEGAL_UPDATED}. By creating an account you agree to these terms.</p>

      <Section title="What Kalupi is">
        <p>
          Kalupi is a free app for tracking your own money: accounts, spending, budgets, bills, savings goals and who
          owes whom. It&apos;s a test version run by one person for friends, not a company.
        </p>
      </Section>

      <Section title="Not a bank, not advice">
        <List>
          <li>Kalupi never moves real money. Every amount is something you typed in or scanned.</li>
          <li>Balances and budgets are only as accurate as what you enter. Check important numbers yourself.</li>
          <li>Nothing in Kalupi is financial, tax or legal advice.</li>
          <li>Bill reminders are a convenience. They can arrive late or not at all, so don&apos;t rely on them to pay on time.</li>
        </List>
      </Section>

      <Section title="It's a test version">
        <List>
          <li>There may be bugs, and data could be lost. Keep your own records of anything important.</li>
          <li>Kalupi may change, go down, or shut down. If it shuts down, you&apos;ll be told ahead of time where possible.</li>
          <li>It&apos;s provided as is, with no guarantees.</li>
        </List>
      </Section>

      <Section title="Your part">
        <List>
          <li>Keep your password to yourself. You&apos;re responsible for what happens on your account.</li>
          <li>Use an email you actually own; it&apos;s how you reset your password.</li>
          <li>
            Don&apos;t try to get into other people&apos;s data, overload the app, spam invite links, or upload offensive
            profile pictures.
          </li>
        </List>
      </Section>

      <Section title="Shared trackers">
        <p>
          When you join a shared tracker, its other members see your name, profile picture and how much you&apos;ve put
          in or taken out of that tracker. Only join trackers with people you trust.
        </p>
      </Section>

      <Section title="Ending your account">
        <p>
          You can ask to delete your account at any time from Settings. Accounts that break these terms may be
          suspended or deleted.
        </p>
      </Section>

      <Section title="Changes and contact">
        <p>
          If these terms change, the date above changes and you&apos;ll be told in the app. These terms follow
          Philippine law. Questions: <Email />.
        </p>
      </Section>
    </div>
  );
}

export function PrivacyText() {
  return (
    <div className="flex flex-col gap-5 text-sm leading-relaxed text-muted-foreground">
      <p>Last updated {LEGAL_UPDATED}. This is what Kalupi keeps about you and who can see it.</p>

      <Section title="What's collected">
        <List>
          <li>Your email, display name and password (stored scrambled; nobody can read it).</li>
          <li>Your profile picture, if you add one.</li>
          <li>
            What you enter: accounts, transactions, categories, budgets, bills, presets, trackers, and the names and
            amounts on settle-up trackers.
          </li>
          <li>
            If you turn on bill reminders: a notification address for that phone or browser, created by its maker. It
            can&apos;t be used to read anything else on your device, and turning reminders off or logging out deletes it.
          </li>
          <li>The date you agreed to these terms.</li>
        </List>
      </Section>

      <Section title="What's not collected">
        <List>
          <li>No ads, no analytics or tracking scripts, and your data is never sold or shared for marketing.</li>
          <li>
            Screenshot scans are read on your phone. The picture is never uploaded and isn&apos;t kept after the scan.
          </li>
          <li>Only one cookie is used: the one that keeps you logged in.</li>
        </List>
      </Section>

      <Section title="Who can see it">
        <List>
          <li>You. Other users can&apos;t see your accounts, transactions or budgets.</li>
          <li>
            Members of a shared tracker you join see your name, profile picture and your total on that tracker, but not
            the entries behind it.
          </li>
          <li>
            Each morning a job on Kalupi&apos;s server checks everyone&apos;s bills to see whose are due, so it can send
            reminders. It only reads the bills and sends notifications.
          </li>
          <li>
            The person who runs Kalupi can see the database while maintaining it, and only looks when needed to fix a
            problem or handle a request from you.
          </li>
        </List>
      </Section>

      <Section title="Where it's stored">
        <List>
          <li>Supabase stores the database, logins and profile pictures.</li>
          <li>Vercel hosts the app.</li>
          <li>Google (Gmail) sends account emails such as password resets.</li>
          <li>
            Bill reminders pass through your browser&apos;s notification service (Google for Chrome and Android, Apple for
            Safari and iPhone, Mozilla for Firefox). They&apos;re encrypted, so that service can&apos;t read them. They show
            the bill&apos;s name and amount, including on your lock screen.
          </li>
          <li>
            A copy of your data is kept on each device you use, so the app works offline. Logging out deletes it from
            that device.
          </li>
        </List>
      </Section>

      <Section title="Deleting your data">
        <p>
          Go to Settings → Delete account to send a request, or email <Email />. Your account and everything in it
          (entries, budgets, bills, trackers you made, your picture) is deleted, usually within 7 days. On shared trackers,
          your contributions are removed too, so the tracker&apos;s total goes down for the other members.
        </p>
      </Section>

      <Section title="Your rights">
        <p>
          Under the Philippine Data Privacy Act (RA 10173) you can ask what data Kalupi has about you, ask for a copy,
          have it corrected, or have it deleted. Email <Email />.
        </p>
      </Section>
    </div>
  );
}
