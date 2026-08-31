export type C2paVerificationStatus =
  | "not_present"
  | "valid"
  | "invalid"
  | "untrusted"
  | "unverifiable"
  | "unsupported";

export interface C2paValidationItem {
  code: string;
  explanation?: string;
  url?: string;
}

export interface C2paVerificationReceipt {
  version: "c2pa-verification-v1";
  checkedAt: string;
  status: C2paVerificationStatus;
  activeManifest?: string;
  manifestCount: number;
  manifestLabels: string[];
  validation: C2paValidationItem[];
  verifier: "@contentauth/c2pa-web";
  note: string;
  technicalError?: string;
}
