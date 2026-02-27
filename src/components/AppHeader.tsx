import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Sparkles, LogOut } from "lucide-react";
import { NavLink } from "@/components/NavLink";

export function AppHeader() {
  const { user, signOut } = useAuth();

  return (
    <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
      <div className="container flex h-14 items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <span className="font-semibold tracking-tight">Creator Studio</span>
          </div>
          <nav className="flex items-center gap-1">
            <NavLink
              to="/avatars"
              className="px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground transition-colors"
              activeClassName="text-foreground bg-accent"
            >
              Avatares
            </NavLink>
            <NavLink
              to="/quick"
              className="px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground transition-colors"
              activeClassName="text-foreground bg-accent"
            >
              Quick Flow
            </NavLink>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground truncate max-w-[160px]">{user?.email}</span>
          <Button variant="ghost" size="icon" onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
