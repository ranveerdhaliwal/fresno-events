export interface EventRowLayoutInput {
  showImage: boolean;
  showP5ListImage: boolean;
  priority: number;
  showVenueLogoInList?: boolean | undefined;
}

export interface EventRowLayoutFlags {
  showRowImage: boolean;
  p5ListLayout: boolean;
}

export function getEventRowLayoutFlags(input: EventRowLayoutInput): EventRowLayoutFlags {
  const showRowImage =
    input.showImage &&
    (input.priority < 5 || input.showVenueLogoInList === true || input.showP5ListImage);
  const p5ListLayout =
    input.priority === 5 && input.showP5ListImage && input.showVenueLogoInList !== true;

  return { showRowImage, p5ListLayout };
}

export interface EventRowModifierInput extends EventRowLayoutInput {
  forceVisible: boolean;
  isSelected?: boolean | undefined;
  isLive?: boolean | undefined;
}

export interface EventRowModifiers {
  forceVisible: boolean;
  p0: boolean;
  p1: boolean;
  p1VenueLogo: boolean;
  p2: boolean;
  p4: boolean;
  p5: boolean;
  p5WithLogo: boolean;
  p5ShowImage: boolean;
  selected: boolean;
  live: boolean;
}

export function getEventRowModifiers(input: EventRowModifierInput): EventRowModifiers {
  const { p5ListLayout } = getEventRowLayoutFlags(input);

  return {
    forceVisible: input.forceVisible,
    p0: input.priority === 0,
    p1: input.priority === 1,
    p1VenueLogo: input.priority === 1 && Boolean(input.showVenueLogoInList),
    p2: input.priority === 2,
    p4: input.priority === 4,
    p5: input.priority === 5,
    p5WithLogo: input.priority === 5 && Boolean(input.showVenueLogoInList),
    p5ShowImage: p5ListLayout,
    selected: Boolean(input.isSelected),
    live: Boolean(input.isLive)
  };
}
