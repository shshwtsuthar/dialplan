'use client';

import { IconX } from '@tabler/icons-react';
import type { Ref } from 'react';
import { config } from '@/lib/config';

const SECTIONS = [
  {
    title: 'What it is',
    body: "A call-routing decision service on AWS. When a call comes in, the phone switch asks where it should ring, and the business's dialplan answers. This page plays the switch, so there are no real calls or audio.",
  },
  {
    title: 'Placing a call',
    body: "The page sends the number called, the caller and the time to POST /v1/route. API Gateway passes it to a Lambda function, which reads the dialplan from DynamoDB in one strongly consistent read and runs the rule engine. The answer comes back with the reasons and timings; a warm call spends under 10 ms in the handler. The globe then replays the call from the caller's area code to San Diego, and the Dialplan column checks each rule in turn.",
  },
  {
    title: 'How a rule decides',
    body: "Rules run in order: VIP callers, holidays, opening hours, then after hours, and the first match wins. Holidays and opening hours are local wall-clock rules, so the call's time is converted to San Diego time first, which keeps daylight saving changes right. The rule engine is a pure function, tested on both sides of each clock change.",
  },
  {
    title: 'Editing rules',
    body: 'Saving sends the version you edited. If someone saved in between, the API refuses with a conflict instead of overwriting their change. Each save writes an audit entry in the same transaction, and your last call is routed again against the new rules.',
  },
  {
    title: 'Where it runs',
    body: 'Everything is Terraform: an API Gateway HTTP API with throttling, three Lambda functions (Node.js 24 on arm64) that each have their own least-privilege role, one DynamoDB table, and Amplify hosting for this page. GitHub Actions deploys through OIDC with no stored keys: pull requests get a read-only plan, and only main can apply. CloudWatch alarms watch p99 latency and server errors.',
  },
  {
    title: "What's made up",
    body: 'Harbor Auto is a fictional car dealership in San Diego, and every phone number comes from ranges set aside for fiction. The data resets every night at 03:00 San Diego time, or when you press Reset demo.',
  },
];

/** What this demo is and how it is built. Opened from the info button in the page header. */
export function AboutDialog({ ref }: { ref: Ref<HTMLDialogElement> }) {
  return (
    <dialog
      ref={ref}
      aria-labelledby="about-title"
      // A click on the backdrop lands on the dialog itself; one inside lands on its content.
      onClick={(event) => event.target === event.currentTarget && event.currentTarget.close()}
      className="m-auto max-h-[calc(100dvh-40px)] w-[min(640px,calc(100vw-20px))] border bg-surface p-0 text-foreground backdrop:bg-background/80"
    >
      <div className="flex max-h-[calc(100dvh-42px)] flex-col">
        <header className="flex h-12 shrink-0 items-center justify-between gap-2.5 border-b px-2.5">
          <h2 id="about-title" className="text-base font-semibold tracking-tight">
            About this demo
          </h2>
          <form method="dialog">
            <button type="submit" className="btn btn-ghost btn-icon -mr-2" aria-label="Close">
              <IconX size={16} />
            </button>
          </form>
        </header>
        <div className="divide-y overflow-y-auto">
          {SECTIONS.map((section) => (
            <section key={section.title} className="p-2.5">
              <h3 className="label">{section.title}</h3>
              <p className="mt-1 leading-relaxed">{section.body}</p>
            </section>
          ))}
        </div>
        {config.repoUrl && (
          <p className="shrink-0 border-t p-2.5 text-[13px]">
            <a className="underline decoration-border underline-offset-2 hover:decoration-foreground" href={config.repoUrl}>
              Read the code and README on GitHub
            </a>
          </p>
        )}
      </div>
    </dialog>
  );
}
