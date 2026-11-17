interface SoftSwapOptions {
  rootSelector: string;
  url: string;
  init?: RequestInit;
  push?: boolean;
  scroll?: boolean;
}

/**
 * Replaces one server-rendered region with the same region from another page.
 * Used by the creator workspace so form actions do not trigger full reloads.
 */
export async function softSwap({
  rootSelector,
  url,
  init,
  push = true,
  scroll = true,
}: SoftSwapOptions): Promise<string> {
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...init,
    headers: {
      'x-soft-navigation': '1',
      ...(init?.headers ?? {}),
    },
  });

  const contentType = response.headers.get('content-type') ?? '';
  const finalUrl = response.url || url;

  if (!response.ok || !contentType.includes('text/html')) {
    throw new Error(`Could not load ${finalUrl}`);
  }

  const html = await response.text();
  const documentNext = new DOMParser().parseFromString(html, 'text/html');
  const next = documentNext.querySelector(rootSelector);
  const current = document.querySelector(rootSelector);

  if (!next || !current) {
    window.location.assign(finalUrl);
    return finalUrl;
  }

  const replace = () => {
    current.replaceWith(next);
    if (push) window.history.pushState({}, '', finalUrl);
  };

  if (
    document.startViewTransition &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    await document.startViewTransition(replace).finished;
  } else {
    replace();
  }

  if (scroll) window.scrollTo({ top: 0, left: 0 });

  return finalUrl;
}
