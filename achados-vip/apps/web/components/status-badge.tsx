import { Badge } from '@/components/ui/badge';
import { integrationStatus, JOB_STATUS, LINK_STATUS, LOG_LEVEL, OFFER_STATUS, PUBLICATION_STATUS, type Labeled } from '@/lib/labels';
import type { OfferStatus, PublicationStatus } from '@/lib/types';

const show = (l: Labeled, title?: string) => (
  <Badge tone={l.tone} title={title}>
    {l.label}
  </Badge>
);

export const IntegrationBadge = ({ status, enabled = true }: { status: string | null | undefined; enabled?: boolean }) => show(integrationStatus(status, enabled));
export const OfferStatusBadge = ({ status }: { status: OfferStatus }) => show(OFFER_STATUS[status] ?? { label: status, tone: 'neutral' });
export const PublicationStatusBadge = ({ status }: { status: PublicationStatus }) => show(PUBLICATION_STATUS[status] ?? { label: status, tone: 'neutral' });
export const LinkStatusBadge = ({ status }: { status: string }) => show(LINK_STATUS[status] ?? { label: status, tone: 'neutral' });
export const JobStatusBadge = ({ status }: { status: string }) => show(JOB_STATUS[status] ?? { label: status, tone: 'neutral' });
export const LogLevelBadge = ({ level }: { level: string }) => show(LOG_LEVEL[level] ?? { label: level, tone: 'neutral' });
