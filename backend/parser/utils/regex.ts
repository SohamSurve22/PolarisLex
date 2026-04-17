export const RegexPatterns = {
  // Driving License (DL) - e.g., MH14 20110051234 or SS-RR-YYYY-NNNNNNN
  DL_NUMBER: /[A-Z]{2}[0-9]{2}[ -]?[0-9]{4}[ -]?[0-9]{7}/i,
  
  // Vehicle Registration Number (RC) - e.g., MH 12 AB 1234
  VEHICLE_NUMBER: /[A-Z]{2}[ -]?[0-9]{1,2}[ -]?[A-Z]{1,3}[ -]?[0-9]{4}/i,
  
  // Policy Number - generic alpha-numeric pattern for insurance
  POLICY_NUMBER: /[A-Z0-9]{8,20}/i,
  
  // Chassis Number - 17 character alphanumeric (VIN)
  CHASSIS_NUMBER: /[A-HJ-NPR-Z0-9]{17}/i,
  
  // Date formats: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD
  DATE: /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})|(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/
};

export const Keywords = {
  DL: {
    NAME: [/name/i, /holder/i, /son of/i, /s\/o/i, /d\/o/i, /w\/o/i],
    DOB: [/dob/i, /date of birth/i, /birth/i],
    ISSUE_DATE: [/issue/i, /doi/i, /date of issue/i],
    EXPIRY_DATE: [/expiry/i, /valid/i, /validity/i, /upto/i, /until/i],
    NUMBER: [/dl no/i, /license no/i, /licence no/i, /dl number/i]
  },
  RC: {
    OWNER: [/owner/i, /name/i, /insured/i],
    REG_NUMBER: [/regn no/i, /reg no/i, /vehicle no/i, /plate/i],
    CHASSIS: [/chassis/i, /vin/i],
    REG_DATE: [/regn date/i, /reg date/i, /issue date/i]
  },
  IC: {
    HOLDER: [/insured/i, /holder/i, /name/i],
    POLICY_NUMBER: [/policy no/i, /policy number/i, /certificate no/i],
    VEHICLE: [/vehicle no/i, /reg no/i, /regn no/i],
    EXPIRY: [/expiry/i, /valid/i, /validity/i, /upto/i, /until/i]
  }
};
