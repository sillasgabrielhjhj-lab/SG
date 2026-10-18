import { JobStatusBadge } from '@/components/status-badge';
import { EmptyState } from '@/components/ui/states';
import { Table, TBody, Td, Th, THead, Tr } from '@/components/ui/table';
import { formatDateTime, formatRelative } from '@/lib/format';
import type { JobInfo } from '@/lib/types';

const JOB_NAMES: Record<string, string> = {
  discovery: 'Busca de ofertas',
  'publish-tick': 'Processamento de publicações',
  maintenance: 'Manutenção',
  health: 'Verificação de integrações',
};

export function JobsTable({ jobs }: { jobs: JobInfo[] }) {
  if (jobs.length === 0) {
    return <EmptyState title="Nenhuma tarefa agendada registrada" description="As tarefas aparecem aqui depois que o worker inicia e registra os agendamentos." />;
  }
  return (
    <Table caption="Tarefas agendadas">
      <THead>
        <Tr>
          <Th>Tarefa</Th>
          <Th>Status</Th>
          <Th>Execução</Th>
          <Th>Próxima</Th>
        </Tr>
      </THead>
      <TBody>
        {jobs.map((j) => (
          <Tr key={j.name}>
            <Td>
              <div className="min-w-[140px]">
                <p className="font-medium">{JOB_NAMES[j.name] ?? j.name}</p>
                <p className="font-mono text-[11px] text-muted">{j.name}</p>
                {j.lastError ? <p className="mt-1 max-w-xs break-words text-xs text-danger-ink">Erro: {j.lastError}</p> : null}
              </div>
            </Td>
            <Td>
              <JobStatusBadge status={j.status} />
            </Td>
            <Td className="text-xs text-muted">
              <p title={formatDateTime(j.lastRunAt)}>Última: {j.lastRunAt ? formatRelative(j.lastRunAt) : 'nunca'}</p>
              <p title={formatDateTime(j.lastSuccessAt)}>Sucesso: {j.lastSuccessAt ? formatRelative(j.lastSuccessAt) : 'nunca'}</p>
            </Td>
            <Td className="whitespace-nowrap text-xs text-muted" title={formatDateTime(j.nextRunAt)}>
              {j.nextRunAt ? formatRelative(j.nextRunAt) : '—'}
            </Td>
          </Tr>
        ))}
      </TBody>
    </Table>
  );
}
