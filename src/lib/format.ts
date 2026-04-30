const STROOPS_PER_UNIT = 10_000_000n;

export function shortAddress(address: string) {
  if (!address) return "";
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-6)}`;
}

export function parseTokenAmount(value: string) {
  const normalized = value.trim();
  if (!/^\d+(\.\d{1,7})?$/.test(normalized)) {
    throw new Error("Enter a positive amount with up to 7 decimal places.");
  }

  const [whole, fractional = ""] = normalized.split(".");
  const stroops = BigInt(whole) * STROOPS_PER_UNIT + BigInt(fractional.padEnd(7, "0"));
  if (stroops <= 0n) {
    throw new Error("Amount must be greater than zero.");
  }
  return stroops;
}

export function formatTokenAmount(stroops: string | bigint) {
  const value = typeof stroops === "bigint" ? stroops : BigInt(stroops);
  const whole = value / STROOPS_PER_UNIT;
  const fractional = (value % STROOPS_PER_UNIT).toString().padStart(7, "0").replace(/0+$/, "");
  return fractional ? `${whole}.${fractional}` : whole.toString();
}

export function validateJobInput(input: { title: string; provider: string; amount: string }) {
  if (input.title.trim().length < 4) {
    return "Describe the service in at least 4 characters.";
  }
  if (!/^G[A-Z2-7]{55}$/.test(input.provider.trim())) {
    return "Provider must be a valid Stellar public key.";
  }
  try {
    parseTokenAmount(input.amount);
  } catch (error) {
    return error instanceof Error ? error.message : "Invalid amount.";
  }
  return "";
}
