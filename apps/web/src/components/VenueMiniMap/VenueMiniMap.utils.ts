export function buildEmojiMarkerHtml(emoji: string): string {
  return `<span style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;font-size:22px;line-height:1;filter:drop-shadow(0 2px 2px rgba(0,0,0,0.25))">${emoji}</span>`;
}
