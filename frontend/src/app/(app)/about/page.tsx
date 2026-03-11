import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, ArrowRight, MessageCircle } from "lucide-react";

type AboutPageProps = {
  searchParams?: {
    fromSession?: string | string[];
  };
};

export default function AboutPage({ searchParams }: AboutPageProps) {
  const rawFromSession = searchParams?.fromSession;
  const fromSession = Array.isArray(rawFromSession) ? rawFromSession[0] : rawFromSession;
  const backHref = fromSession ? `/session/${fromSession}` : "";

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      {backHref && (
        <div className="mb-6">
          <Link href={backHref}>
            <Button variant="outline" size="sm" className="rounded-full gap-2 text-xs">
              <ArrowLeft className="size-3.5" />
              Back to whiteboard
            </Button>
          </Link>
        </div>
      )}
      <h1 className="text-2xl font-bold text-foreground mb-8">About & Help</h1>

      <div className="space-y-8">
        {/* What this app does */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">What this app does</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Digital Math Teacher is a browser-based math practice environment. You solve problems on a digital whiteboard, and an AI teacher reads your handwritten steps, checks them against the correct solution, and provides detailed feedback. You can also chat with the tutor for hints and explanations.
          </p>
        </section>

        {/* How to use it */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">How to use it</h2>
          <div className="space-y-3">
            {[
              "Pick a problem from the library or home page.",
              "Write your solution steps on the left whiteboard.",
              "Tap \"Check my steps\" once you've written a bit.",
              "Review the feedback cards to see what's correct and what needs fixing.",
              "Use the Chat tab to ask follow-up questions or get hints.",
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-medium flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <p className="text-sm text-foreground">{step}</p>
              </div>
            ))}
          </div>
        </section>

        {/* What this app is NOT */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">What this app is NOT</h2>
          <Card className="shadow-sm border-[var(--yellow-200)] bg-[var(--yellow-50-50)]">
            <CardContent className="pt-5 space-y-2">
              <p className="text-sm text-foreground">This is an educational tool, not a grading system.</p>
              <p className="text-sm text-foreground">It can make mistakes. Always think critically about the feedback.</p>
              <p className="text-sm text-foreground">It is not a substitute for classroom instruction or a qualified tutor.</p>
            </CardContent>
          </Card>
        </section>

        {/* Privacy */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">Privacy & data</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Your work and chat history may be used to improve your learning experience. Data is not shared publicly. Session history can be disabled in Settings. Guest sessions are temporary and may not be persisted.
          </p>
        </section>

        {/* Feedback */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">Feedback</h2>
          <p className="text-sm text-muted-foreground mb-4">
            We&apos;d love to hear from you. Let us know what&apos;s working and what could be better.
          </p>
          <Button variant="outline" className="rounded-full gap-2">
            <MessageCircle className="size-4" />
            Send feedback
          </Button>
        </section>

        {/* CTA */}
        <section className="pt-4">
          <Link href="/problems">
            <Button className="rounded-full gap-2">
              Start practicing
              <ArrowRight className="size-4" />
            </Button>
          </Link>
        </section>
      </div>
    </div>
  );
}
