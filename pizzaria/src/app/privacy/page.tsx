import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/legal-page';
import { siteConfig } from '@/config/site';

export const metadata: Metadata = {
  title: 'Privacy policy',
  description: `How ${siteConfig.name} handles the information you enter on this site.`,
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updatedAt="October 2026">
      <p>
        This policy explains, in plain language, how {siteConfig.name} handles the information you enter on this
        website, in accordance with applicable data protection laws (including Brazil’s LGPD, Law No. 13,709/2018).
      </p>
      <h2>What we collect</h2>
      <p>To put your order together, the site only asks for what is needed:</p>
      <ul>
        <li>your name and phone number, to confirm the order;</li>
        <li>your address, when you choose delivery;</li>
        <li>your payment method and any order notes.</li>
      </ul>
      <h2>How we use it</h2>
      <p>
        The site does not send this information to any server of ours. When you check out, it is assembled into a
        message that opens in your WhatsApp, and it only reaches us when you tap send. We use it solely to prepare,
        deliver and charge for your order.
      </p>
      <h2>Data stored on your device</h2>
      <p>
        Your cart and, if you allow it, your contact details and address are saved in your browser’s local storage to
        speed up your next order. You can delete them at any time by clearing this site’s data in your browser or by
        unchecking “Remember my details”.
      </p>
      <h2>Third-party services</h2>
      <ul>
        <li>WhatsApp (Meta): receives the order message you choose to send;</li>
        <li>ViaCEP: queried only with the postal code you type, to fill in your address;</li>
        <li>Google Maps: displays our location;</li>
        <li>Unsplash: hosts some of the images on this site.</li>
      </ul>
      <h2>Your rights</h2>
      <p>
        You can ask to access, correct or delete your data at any time by emailing{' '}
        <a className="font-semibold text-tomato-600 underline" href={`mailto:${siteConfig.contact.email}`}>
          {siteConfig.contact.email}
        </a>{' '}
        or messaging us on WhatsApp.
      </p>
    </LegalPage>
  );
}
