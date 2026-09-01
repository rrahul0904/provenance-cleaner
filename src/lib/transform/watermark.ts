export type WatermarkVerificationResult = {
  available: boolean;
  status: "unavailable" | "verified" | "not_detected" | "indeterminate";
  note: string;
};

export interface TextWatermarkVerifier {
  verify(text: string): Promise<WatermarkVerificationResult>;
}

export const unavailableTextWatermarkVerifier: TextWatermarkVerifier = {
  async verify(_text: string) {
    return {
      available: false,
      status: "unavailable",
      note: "No legitimate public text-watermark verifier is configured. Deterministic sanitation and rewrite validation do not prove watermark removal.",
    };
  },
};
