import { Skeleton } from '@/components/ui/skeleton'

type Variant = 'metrics' | 'stores' | 'activity' | 'store-table'

export function MasterLoadingSkeleton({ variant }: { variant: Variant }) {
  if (variant === 'metrics') return (
    <div className="master-skeleton-grid" role="status" aria-label="Carregando indicadores" aria-busy="true">
      {Array.from({ length: 6 }, (_, i) => <div className="master-skeleton-card" key={i}>
        <Skeleton className="master-skeleton-line short" />
        <Skeleton className="master-skeleton-line amount" />
        <Skeleton className="master-skeleton-line medium" />
      </div>)}
    </div>
  )
  const count = variant === 'store-table' ? 5 : variant === 'stores' ? 4 : 3
  return (
    <div className={variant === 'store-table' ? 'master-skeleton-table' : 'master-skeleton-rows'} role="status"
      aria-label={variant === 'store-table' ? 'Carregando cadastro de lojas' : variant === 'stores' ? 'Carregando lojas recentes' : 'Carregando atividade'} aria-busy="true">
      {Array.from({ length: count }, (_, i) => <div key={i} className={variant === 'store-table' ? 'master-skeleton-table-row' : 'master-skeleton-row'}>
        <Skeleton className="master-skeleton-avatar" />
        <div className="master-skeleton-copy"><Skeleton className="master-skeleton-line medium" /><Skeleton className="master-skeleton-line short" /></div>
        <Skeleton className="master-skeleton-line short" />
      </div>)}
    </div>
  )
}
