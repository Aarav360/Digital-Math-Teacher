import { AppNav } from "@/components/app-nav";
import { AuthGuard } from "@/components/auth-guard";
import { UserProvider } from "@/contexts/user-context";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <UserProvider>
      <AuthGuard>
        <div className="h-screen w-full flex flex-col overflow-hidden">
          <AppNav />
          <main className="flex-1 min-h-0 overflow-y-auto flex flex-col">
            {children}
          </main>
        </div>
      </AuthGuard>
    </UserProvider>
  );
}
