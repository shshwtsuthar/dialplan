import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** One of the page's three columns: a 48px title row over its content. */
export function Column({
  title,
  aside,
  className,
  children,
}: {
  title: string;
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={cn('flex min-w-0 flex-col', className)}>
      <header className="flex h-12 shrink-0 items-center justify-between gap-2.5 border-b px-2.5">
        <h2 id={id} className="text-base font-semibold tracking-tight">
          {title}
        </h2>
        {aside}
      </header>
      {children}
    </section>
  );
}
