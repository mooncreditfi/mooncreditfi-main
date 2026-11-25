import { toast } from "sonner";

export function txToast(signature: string, message: string) {
  const explorerUrl = `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
  toast.success(message, {
    description: (
      <a href={explorerUrl} target="_blank" rel="noopener noreferrer">
        View transaction on Solana Explorer
      </a>
    ),
  });
}
