import type { ComponentType } from "react";
import { AppErrorBoundary } from "./AppErrorBoundary";
import { QueryProvider } from "./QueryProvider";

/**
 * Wraps a component in AppErrorBoundary and QueryProvider.
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
      <QueryProvider>
        <AppErrorBoundary>
          <WrappedComponent {...props} />
        </AppErrorBoundary>
      </QueryProvider>
    );
  }
  BoundedComponent.displayName = `withErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name || "Component"})`;
  return BoundedComponent;
}
