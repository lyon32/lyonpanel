import * as React from 'react';
import { cn } from '@/lib/cn';

function Table({ className, ...props }: React.ComponentProps<'table'>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn('w-full border-collapse text-sm', className)} {...props} />
    </div>
  );
}

function TableHeader(props: React.ComponentProps<'thead'>) {
  return <thead {...props} />;
}

function TableBody(props: React.ComponentProps<'tbody'>) {
  return <tbody {...props} />;
}

function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return (
    <tr
      className={cn(
        'border-gris-200 hover:bg-gris-50 border-b transition-colors duration-150 ease-out',
        className,
      )}
      {...props}
    />
  );
}

type NumericProp = { numeric?: boolean };

function TableHead({ className, numeric, ...props }: React.ComponentProps<'th'> & NumericProp) {
  return (
    <th
      className={cn(
        'bg-gris-50 text-gris-600 px-4 py-3 text-left font-semibold',
        numeric && 'text-right tabular-nums',
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, numeric, ...props }: React.ComponentProps<'td'> & NumericProp) {
  return (
    <td
      className={cn('text-encre px-4 py-3', numeric && 'text-right tabular-nums', className)}
      {...props}
    />
  );
}

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
