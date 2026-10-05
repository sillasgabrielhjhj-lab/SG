import { requireUserPage } from "@/server/auth/guards";
import { getProfile } from "@/features/account/service";
import { ProfileForm } from "@/features/account/components/account-forms";
import { PageHeading } from "@/components/layout/page-heading";
import { formatMembership } from "@/lib/format";

export const metadata = { title: "Meus dados" };

export default async function ProfilePage() {
  const user = await requireUserPage("/minha-conta/dados");
  const profile = await getProfile(user.id);
  return (
    <div>
      <PageHeading title="Meus dados" description={`Cliente ${formatMembership(profile.createdAt)}. Seus dados são tratados conforme a LGPD.`} />
      <section className="rounded-card border border-line bg-surface p-4 sm:p-6">
        <ProfileForm
          initial={{
            name: profile.name,
            email: profile.email,
            cpf: profile.cpf,
            phone: profile.phone,
            birthDate: profile.birthDate ? profile.birthDate.toISOString().slice(0, 10) : null,
            marketingOptIn: profile.marketingOptIn,
          }}
        />
      </section>
    </div>
  );
}
