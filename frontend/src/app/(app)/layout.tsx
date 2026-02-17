import { AppNav } from "@/components/app-nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen w-full flex flex-col overflow-hidden">
      <AppNav />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
