# Keyboard and screen-reader checklist

Complete this checklist at each milestone exit. Record the date, reviewer, and
any exception in the PR or the milestone notes.

## Keyboard

- [ ] Tab reaches the skip link first and it becomes visible on focus.
- [ ] Sidebar links, collapse toggle, search trigger, theme toggle, account menu,
      notifications, and public navigation are reachable in a logical order.
- [ ] The command palette opens with `⌘K` / `Ctrl+K`, filters as you type,
      navigates with arrows, activates with Enter, and restores focus on close.
- [ ] `?` opens the shortcut dialog unless focus is inside a field.
- [ ] `G` then `O/C/T/U/M/P/R/A` navigates to the matching section.
- [ ] The searchable province dropdown opens with Enter, filters with typing,
      moves with arrows, selects with Enter, and closes with Escape.
- [ ] The filter popover can be opened, changed, and cleared with the keyboard.
- [ ] Table pagination, page-size select, and row actions are reachable.
- [ ] Dialogs trap focus, close on Escape, and return focus to the trigger.
- [ ] The mobile drawer closes on Escape and returns focus to the menu button.
- [ ] No keyboard trap exists outside an open modal.

## Screen reader

- [ ] Each page has one descriptive `h1` and a logical heading order.
- [ ] Landmarks identify navigation, main content, and breadcrumbs.
- [ ] Form controls have visible labels or accessible names.
- [ ] Errors are announced and associated with the field.
- [ ] Status badges include text; color is not the only signal.
- [ ] Sortable/data tables use `th` with scope, and pagination announces changes.
- [ ] The command palette is announced as a dialog and its options as a listbox.
- [ ] Result counts and validation messages use a polite live region.
- [ ] Icons that do not carry meaning are hidden from assistive technology.

## Themes and motion

- [ ] Dark and light themes both pass axe with no critical or serious findings.
- [ ] Focus rings remain visible on every surface.
- [ ] Disabled and loading states are distinguishable without color alone.
- [ ] `prefers-reduced-motion: reduce` removes non-essential transitions.
- [ ] No text falls below 12px on the admin surface.

## Data table

- [ ] Search updates the visible rows and result range.
- [ ] Status filters combine with search and the province dropdown.
- [ ] Per-page selection updates pagination.
- [ ] First/previous/next/last controls disable at the boundaries.
- [ ] Empty results show a clear explanation and a recovery path.
- [ ] Eight columns remain readable at 1280px.
