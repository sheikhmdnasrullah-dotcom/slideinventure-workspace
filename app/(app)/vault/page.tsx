import { requireUser } from "@/lib/supabase/server";
import { VaultEntries } from "@/components/dashboard/vault/vault-entries";

export default async function VaultPage() {
  await requireUser();
  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-sm font-medium tracking-wide text-foreground/60 uppercase">
          Vault
        </h1>
        <p className="text-xs text-foreground/40">
          Encrypted secrets. Copy and reveal are audited.
        </p>
      </div>
      <VaultEntries />
    </div>
  );
}
