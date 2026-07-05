export interface EventShareUrls {
  twitter: string;
  facebook: string;
  sms: string;
}

export function buildEventShareUrls(title: string, url: string): EventShareUrls {
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  return {
    twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    sms: `sms:?&body=${encodedTitle}%20${encodedUrl}`
  };
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
