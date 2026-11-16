import { getCountryCallingCode, getExampleNumber, Metadata, type CountryCode } from "libphonenumber-js";
import examples from "libphonenumber-js/examples.mobile.json";

const phoneMetadata = new Metadata();

export type PhoneCountryDetails = { callingCode: string | null; allowedLengths: number[] };

export function phoneCountryDetails(countryCode: string): PhoneCountryDetails {
  try {
    const code = countryCode as CountryCode;
    phoneMetadata.selectNumberingPlan(code);
    const example = getExampleNumber(code, examples);
    const allowedLengths = example
      ? [example.nationalNumber.length]
      : (phoneMetadata.numberingPlan?.possibleLengths() ?? []).filter((length) => length > 0 && length <= 15);
    return { callingCode: `+${getCountryCallingCode(code)}`, allowedLengths };
  } catch {
    // ISO territories without their own numbering plan can still enter a complete E.164 number.
    return { callingCode: null, allowedLengths: [] };
  }
}
