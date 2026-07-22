import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "../../lib/utils"

const TooltipProvider = TooltipPrimitive.Provider

const Tooltip = TooltipPrimitive.Root

const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = React.forwardRef<
  React.ComponentRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-[9999] overflow-hidden rounded-md border border-border bg-surface-raised px-2.5 py-1.5 text-xs text-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

// Legacy compatibility for custom `Tooltip` and `TooltipIcon` used in Meterly2
interface LegacyTooltipProps {
  content: string;
  children: React.ReactNode;
  placement?: 'top' | 'bottom';
  className?: string;
}

function LegacyTooltip({ content, children, placement = 'top', className }: LegacyTooltipProps) {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <span className={cn('relative inline-flex items-center', className)}>
            {children}
          </span>
        </TooltipTrigger>
        <TooltipContent side={placement}>
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

interface TooltipIconProps {
  content: string;
  className?: string;
}

export function TooltipIcon({ content, className }: TooltipIconProps) {
  return (
    <LegacyTooltip content={content} className={className}>
      <span
        tabIndex={0}
        aria-label={`Info: ${content}`}
        className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-current text-[9px] font-bold text-muted-foreground cursor-help ml-1 leading-none select-none"
      >
        ?
      </span>
    </LegacyTooltip>
  );
}

