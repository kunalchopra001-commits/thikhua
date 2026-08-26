export type EstimatedScale = "minor" | "major";

export type Authorities = {
  grievance_authority: string;
  execution_authority: string;
  funding_pathway: string;
};

export function deriveAuthorities(
  is_urban: boolean,
  block_name: string,
  district: string,
  school_name: string,
  estimated_scale: EstimatedScale,
): Authorities {
  const grievance_authority = is_urban
    ? `Deputy Director of Public Instruction, ${district} (Urban)`
    : `Block Education Officer, ${block_name} Block`;

  if (estimated_scale === "minor") {
    return {
      grievance_authority,
      execution_authority: `School Management Committee, ${school_name} (Composite School Grant)`,
      funding_pathway: "Composite School Grant — school-level, current financial year",
    };
  }

  return {
    grievance_authority,
    execution_authority: `Executive Engineer, PWD ${district} Division (via District Project Office, Samagra Shiksha)`,
    funding_pathway:
      "Civil works above ₹30 lakh — external agency; requires inclusion in the Annual Work Plan & Budget (AWP&B)",
  };
}
