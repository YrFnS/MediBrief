import React from 'react';
import { createRoot } from 'react-dom/client';
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

const IconAudit: React.FC = () => (
    <div
        data-icon-audit-ready="true"
        data-icon-count={iconEntries.length}
        style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
            gap: 12,
            padding: 24,
            fontFamily: 'system-ui, sans-serif',
        }}
    >
        {iconEntries.map(([name, Icon]) => (
            <figure
                key={name}
                style={{
                    alignItems: 'center',
                    border: '1px solid #cbd5e1',
                    borderRadius: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    margin: 0,
                    minHeight: 84,
                    padding: 12,
                }}
            >
                <Icon className="h-6 w-6" />
                <figcaption style={{ fontSize: 11, overflowWrap: 'anywhere' }}>
                    {name}
                </figcaption>
            </figure>
        ))}
    </div>
);

const root = document.getElementById('root');
if (!root) {
    throw new Error('Icon audit root is missing.');
}

createRoot(root).render(<IconAudit />);
