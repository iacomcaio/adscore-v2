import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getMetaAdAccounts, type MetaAdAccount } from "@/lib/meta-api";

async function setSelectedAccount(userId: string, accountId: string) {
  "use server";

  await prisma.user.update({
    where: { id: userId },
    data: { selectedAccount: accountId },
  });
}

export default async function MetaConnectPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user) {
    redirect("/login");
  }

  const hasMetaConnection = !!user.metaToken;

  let accounts: MetaAdAccount[] = [];

  if (hasMetaConnection && user.metaToken) {
    try {
      accounts = await getMetaAdAccounts(user.metaToken);
    } catch {
      // If we can't load accounts, fall back to showing only the connect button.
    }
  }

  if (!hasMetaConnection) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="rounded-xl border border-zinc-200 bg-white px-8 py-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h1 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            Conectar Meta Ads
          </h1>
          <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
            Clique abaixo para conectar sua conta Meta Ads com as permissões{" "}
            <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">
              ads_read
            </code>{" "}
            e{" "}
            <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">
              ads_management
            </code>
            .
          </p>
          <a
            href="/api/meta/login"
            className="inline-flex items-center justify-center rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Conectar com Facebook
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
      <div className="w-full max-w-xl rounded-xl border border-zinc-200 bg-white px-8 py-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Selecionar conta de anúncio
        </h1>
        {accounts.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Não encontramos contas de anúncio ativas na sua conta Meta. Verifique se você tem
            acesso a alguma conta com status ativo.
          </p>
        ) : (
          <ul className="space-y-2">
            {accounts.map((account) => (
              <li
                key={account.id}
                className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
              >
                <div>
                  <div className="font-medium text-zinc-900 dark:text-zinc-50">
                    {account.name}
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    {account.id} • {account.currency} • {account.timezone_name}
                  </div>
                </div>
                <form
                  action={async (formData) => {
                    "use server";
                    const accountId = formData.get("accountId");
                    if (typeof accountId === "string") {
                      await setSelectedAccount(user.id, accountId);
                      redirect("/ads");
                    }
                  }}
                >
                  <input type="hidden" name="accountId" value={account.id} />
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center rounded-md bg-black px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                  >
                    {user.selectedAccount === account.id ? "Selecionada" : "Selecionar"}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

