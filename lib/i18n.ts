const strings = {
  siteName: "ThikHua",
  siteDescription: "A public accountability ledger for school infrastructure repair.",
  trackIssue: "Track a report",
  prototypeBanner: "Prototype. Department accounts and government submission are simulated.",
  dismissBanner: "Dismiss prototype notice",
  locating: "Finding your nearest block…",
  chooseBlock: "Choose a block",
  changeBlock: "View another block",
  schoolsAndEnrollment: "{schools} schools · {enrolment} pupils",
  severitySummary: "Open reports by severity",
  severityCount: "{severity}: {count}",
  openIssues: "Open reports",
  loadingIssues: "Loading reports…",
  loadError: "Reports could not be loaded. Choose the block again to retry.",
  daysElapsed: "{days} days",
  unfunded: "Unfunded — not in current AWP&B",
  unfundedExplanation: "Blocked on the annual budget cycle",
  emptyBlock: "No reports yet — be the first to check your school",
  reportIssue: "Check your school",
  viewIssue: "View report for {school}",
} as const;

export type StringKey = keyof typeof strings;

export function t(key: StringKey, values: Record<string, string | number> = {}): string {
  return Object.entries(values).reduce<string>(
    (message, [name, value]) => message.replaceAll(`{${name}}`, String(value)),
    strings[key],
  );
}
