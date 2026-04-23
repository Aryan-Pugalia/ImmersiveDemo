import { Component } from "react";
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Optional label shown in the error card, e.g. "annotation canvas". */
  label?: string;
}

interface State {
  hasError: boolean;
  message: string;
}

/**
 * Wraps any component that uses the HTML5 Canvas (2D or WebGL) API.
 * If the browser blocks canvas operations and the child throws, this
 * boundary catches the error and shows a friendly message instead of
 * leaving the page blank.
 */
export class CanvasErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(err: unknown): State {
    const message = err instanceof Error ? err.message : "Unknown rendering error";
    return { hasError: true, message };
  }

  render() {
    if (this.state.hasError) {
      const label = this.props.label ?? "canvas view";
      return (
        <div className="flex flex-col items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 p-10 gap-4 text-center min-h-[240px]">
          <div className="text-3xl">⚠️</div>
          <p className="text-foreground font-semibold">
            {label.charAt(0).toUpperCase() + label.slice(1)} unavailable
          </p>
          <p className="text-muted-foreground text-sm max-w-xs leading-relaxed">
            Your browser blocked the canvas renderer required for this feature.
            Please open this page in Chrome, Edge, or Firefox with hardware
            acceleration enabled.
          </p>
          <p className="text-muted-foreground/40 text-xs font-mono">{this.state.message}</p>
        </div>
      );
    }
    return this.props.children;
  }
}
