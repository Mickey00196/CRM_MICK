import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

/** Keeps a crash in one page from blanking the whole app. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto max-w-xl py-16">
        <h1 className="title text-xl">This page hit an error</h1>
        <p className="mt-2 text-sm text-muted">Your data is safe. Reload to try again; if it keeps happening, note what you clicked.</p>
        <p className="mt-4 rounded-md bg-subtle px-3 py-2 font-mono text-xs text-muted">{this.state.error.message}</p>
        <Button className="mt-6" onClick={() => location.reload()}>
          Reload
        </Button>
      </div>
    );
  }
}
