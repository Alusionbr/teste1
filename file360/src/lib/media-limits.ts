import { LIMITS } from "./files.ts";

export type MediaLimits = {
  bytes: number;
  seconds: number;
  expanded: boolean;
};

export function mediaLimitsForStorage(expanded: boolean): MediaLimits {
  return expanded
    ? { bytes: LIMITS.mediaExtendedBytes, seconds: LIMITS.mediaExtendedSeconds, expanded: true }
    : { bytes: LIMITS.mediaBytes, seconds: LIMITS.mediaSeconds, expanded: false };
}
