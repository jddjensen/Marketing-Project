declare module "next-plausible" {
  import type { ReactNode } from "react";

  type PlausibleInitOptions = {
    captureOnLocalhost?: boolean;
    endpoint?: string;
    autoCapturePageviews?: boolean;
    hashBasedRouting?: boolean;
  };

  type PlausibleProviderProps = {
    children?: ReactNode;
    enabled?: boolean;
    init?: PlausibleInitOptions;
    src?: string;
    scriptProps?: Record<string, unknown>;
  };

  export default function PlausibleProvider(
    props: PlausibleProviderProps
  ): ReactNode;
}
