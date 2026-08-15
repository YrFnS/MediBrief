import React from 'react';
import * as IconExports from '../../components/icons';

interface IconProps {
    className?: string;
}

type IconComponent = React.ComponentType<IconProps>;

const iconEntries = Object.entries(IconExports)
    .filter((entry): entry is [string, IconComponent] => (
        typeof entry[1] === 'function'
    ))
    .sort(([left], [right]) => left.localeCompare(right));

const IconAuditPage: React.FC = () => (
    <main
        aria-label="MediBrief exported icon audit"
        data-icon-audit-ready="true"
        data-icon-count={iconEntries.length}
        className="grid min-h-screen grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3 bg-slate-50 p-6 text-slate-900"
    >
        {iconEntries.map(([name, Icon]) => (
            <figure
                key={name}
                className="m-0 flex min-h-20 flex-col items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white p-3"
            >
                <Icon className="h-6 w-6" />
                <figcaption className="break-all text-center text-[11px]">
                    {name}
                </figcaption>
            </figure>
        ))}
    </main>
);

export default IconAuditPage;
