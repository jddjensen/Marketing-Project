import { PlatformMediaBoard, type RatioConfig } from "../_components/PlatformMediaBoard";
import { SearchTermsPanel } from "../_components/SearchTermsPanel";

const GOOGLE_SEARCH_RATIOS: RatioConfig[] = [
  {
    key: "1x1",
    label: "1:1 Square",
    aspect: "aspect-square",
    hint: "Image asset — 1200×1200",
    recommended: true,
  },
  {
    key: "1.91x1",
    label: "1.91:1 Landscape",
    aspect: "aspect-[1.91/1]",
    hint: "Image asset — 1200×628",
    recommended: true,
  },
  {
    key: "4x1",
    label: "4:1 Logo",
    aspect: "aspect-[4/1]",
    hint: "Business logo — 1200×300",
  },
];

export default function GoogleSearchPage() {
  return (
    <PlatformMediaBoard
      platform="google-search"
      title="Google Search — Campaign Media"
      subtitle="Image assets, logos, and search terms tied to this campaign."
      ratios={GOOGLE_SEARCH_RATIOS}
    >
      <SearchTermsPanel platform="google-search" />
    </PlatformMediaBoard>
  );
}
