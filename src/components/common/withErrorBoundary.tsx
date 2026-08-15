import type { ComponentType } from "react";
import { AppErrorBoundary } from "./AppErrorBoundary";

/**
 * Wraps a component in AppErrorBoundary.
 * Use at the client:load island boundary in Astro pages.
 *
 * Usage:
 *   function DashboardOverviewInner() { ... }
 *   export const DashboardOverview = withErrorBoundary(DashboardOverviewInner);
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: ComponentType<P>
): ComponentType<P> {
  function BoundedComponent(props: P) {
    return (
      <AppErrorBoundary>
        <WrappedComponent {...props} />
      </AppErrorBoundary>
    );
  }
  BoundedComponent.displayName = `withErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name || "Component"})`;
  return BoundedComponent;
}
