import Link from 'next/link';

export interface Crumb {
  name: string;
  path: string;
}

export function Breadcrumbs({ items }: { items: readonly Crumb[] }) {
  return (
    <nav aria-label="breadcrumb" className="pt-4 text-xs text-muted">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((item, index) => (
          <li key={item.path} className="flex items-center gap-1">
            {index > 0 ? <span aria-hidden>›</span> : null}
            {index === items.length - 1 ? (
              <span aria-current="page" className="font-medium text-text">
                {item.name}
              </span>
            ) : (
              <Link href={item.path} className="hover:text-text hover:underline">
                {item.name}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
