type SolanaSignInMessageOptions = {
  domain: string;
  uri: string;
  address: string;
  statement: string;
  chainId: string;
  nonce: string;
  issuedAt: string;
};

export function createSolanaSignInMessage({
  domain,
  uri,
  address,
  statement,
  chainId,
  nonce,
  issuedAt,
}: SolanaSignInMessageOptions) {
  return [
    `${domain} wants you to sign in with your Solana account:`,
    address,
    "",
    statement,
    "",
    `URI: ${uri}`,
    "Version: 1",
    `Chain ID: ${chainId}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
  ].join("\n");
}
