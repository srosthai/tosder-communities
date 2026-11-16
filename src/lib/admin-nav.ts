export type AdminRole =
  | 'administrator'
  | 'moderator'
  | 'content-editor'
  | 'finance';

export type AdminIcon =
  | 'overview'
  | 'content'
  | 'templates'
  | 'users'
  | 'moderation'
  | 'competitions'
  | 'rewards'
  | 'audit';

export interface AdminNavItem {
  label: string;
  href: string;
  icon: AdminIcon;
  roles: AdminRole[];
  badge?: string;
  shortcut?: string;
}

export interface AdminNavGroup {
  label: string;
  items: AdminNavItem[];
}

export const adminNavGroups: AdminNavGroup[] = [
  {
    label: 'Workspace',
    items: [
      {
        label: 'Overview',
        href: '/admin',
        icon: 'overview',
        roles: ['administrator', 'moderator', 'content-editor', 'finance'],
        shortcut: 'G O',
      },
      {
        label: 'Content',
        href: '/admin/content',
        icon: 'content',
        roles: ['administrator', 'content-editor'],
        shortcut: 'G C',
      },
      {
        label: 'Templates',
        href: '/admin/templates',
        icon: 'templates',
        roles: ['administrator', 'content-editor', 'moderator'],
        shortcut: 'G T',
      },
    ],
  },
  {
    label: 'Community',
    items: [
      {
        label: 'Users',
        href: '/admin/users',
        icon: 'users',
        roles: ['administrator', 'moderator'],
        shortcut: 'G U',
      },
      {
        label: 'Moderation',
        href: '/admin/moderation',
        icon: 'moderation',
        roles: ['administrator', 'moderator'],
        badge: '5',
        shortcut: 'G M',
      },
    ],
  },
  {
    label: 'Growth',
    items: [
      {
        label: 'Competitions',
        href: '/admin/competitions',
        icon: 'competitions',
        roles: ['administrator'],
        shortcut: 'G P',
      },
      {
        label: 'Rewards',
        href: '/admin/rewards',
        icon: 'rewards',
        roles: ['administrator', 'finance'],
        shortcut: 'G R',
      },
    ],
  },
  {
    label: 'System',
    items: [
      {
        label: 'Audit',
        href: '/admin/audit',
        icon: 'audit',
        roles: ['administrator'],
        shortcut: 'G A',
      },
    ],
  },
];

export const adminShortcuts = [
  { keys: ['⌘', 'K'], label: 'Open command palette' },
  { keys: ['?'], label: 'Show keyboard shortcuts' },
  { keys: ['G', 'O'], label: 'Go to Overview' },
  { keys: ['G', 'C'], label: 'Go to Content' },
  { keys: ['G', 'T'], label: 'Go to Templates' },
  { keys: ['G', 'U'], label: 'Go to Users' },
  { keys: ['G', 'M'], label: 'Go to Moderation' },
  { keys: ['G', 'P'], label: 'Go to Competitions' },
  { keys: ['G', 'R'], label: 'Go to Rewards' },
  { keys: ['G', 'A'], label: 'Go to Audit' },
  { keys: ['Esc'], label: 'Close the palette or drawer' },
];

export const adminCommands = [
  {
    label: 'Create a template',
    group: 'Actions',
    href: '/admin/templates?new=1',
    keywords: 'new template itinerary create',
  },
  {
    label: 'Review moderation queue',
    group: 'Actions',
    href: '/admin/moderation',
    keywords: 'reports flagged content review',
  },
  {
    label: 'Configure a competition',
    group: 'Actions',
    href: '/admin/competitions',
    keywords: 'monthly top five prizes rules',
  },
  {
    label: 'Approve a payout',
    group: 'Actions',
    href: '/admin/rewards',
    keywords: 'reward payout finance',
  },
  {
    label: 'View the design system',
    group: 'Resources',
    href: '/design',
    keywords: 'tokens components primitives',
  },
  {
    label: 'Open the public site',
    group: 'Resources',
    href: '/',
    keywords: 'home public travel',
  },
];

export function canAccess(role: AdminRole, item: AdminNavItem): boolean {
  return item.roles.includes(role);
}

export function isActivePath(pathname: string, href: string): boolean {
  if (href === '/admin') return pathname === '/admin';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function breadcrumbFor(pathname: string): string {
  const items = adminNavGroups.flatMap((group) => group.items);
  return items.find((item) => isActivePath(pathname, item.href))?.label ?? 'Overview';
}
