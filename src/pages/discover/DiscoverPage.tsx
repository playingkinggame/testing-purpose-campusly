import { useState } from 'react';
import { Compass, SearchX } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { AsyncView, EmptyState } from '@/components/ui/Feedback';
import { DiscoverFilters, EMPTY_DISCOVER_FILTERS, type DiscoverFilterValues } from '@/components/discover/DiscoverFilters';
import { PersonCard } from '@/components/discover/PersonCard';
import { Leaderboard } from '@/components/discover/Leaderboard';
import { usePaginated } from '@/hooks/usePaginated';
import { discoverPeople } from '@/lib/api/discover';
import type { DiscoverPerson } from '@/types/db';

function sameFilters(a: DiscoverFilterValues, b: DiscoverFilterValues): boolean {
  return a.batch === b.batch && a.branch === b.branch && a.school === b.school
    && a.residence === b.residence && a.interest === b.interest && a.query === b.query;
}

function isBlank(value: DiscoverFilterValues): boolean {
  return !value.batch && !value.branch && !value.school && !value.residence && !value.interest && !value.query;
}

export default function DiscoverPage() {
  const [draft, setDraft] = useState<DiscoverFilterValues>(EMPTY_DISCOVER_FILTERS);
  const [applied, setApplied] = useState<DiscoverFilterValues>(EMPTY_DISCOVER_FILTERS);

  const paged = usePaginated<DiscoverPerson>(
    (offset, limit) => discoverPeople({
      batch: applied.batch ? Number(applied.batch) : null,
      branch: applied.branch,
      school: applied.school,
      residence: applied.residence,
      interest: applied.interest,
      query: applied.query,
      limit,
      offset,
    }),
    [applied.batch, applied.branch, applied.school, applied.residence, applied.interest, applied.query],
    24,
  );

  const apply = () => {
    const next: DiscoverFilterValues = {
      batch: draft.batch,
      branch: draft.branch.trim(),
      school: draft.school.trim(),
      residence: draft.residence,
      interest: draft.interest.trim(),
      query: draft.query.trim(),
    };
    setDraft(next);
    if (sameFilters(applied, next)) paged.reload();
    else setApplied(next);
  };

  const reset = () => {
    const wasBlank = isBlank(applied);
    setDraft(EMPTY_DISCOVER_FILTERS);
    setApplied(EMPTY_DISCOVER_FILTERS);
    if (wasBlank) paged.reload();
  };

  const hasItems = paged.items.length > 0;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-forest sm:text-3xl">
          <Compass className="h-7 w-7" aria-hidden="true" /> Discover
        </h1>
        <p className="text-sm text-muted">People around VIT Chennai who share your branch, clubs or interests.</p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4">
          <DiscoverFilters
            value={draft}
            onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))}
            onApply={apply}
            onReset={reset}
          />

          <AsyncView
            loading={paged.loading}
            error={paged.error}
            onRetry={paged.reload}
            hasData={hasItems}
            isEmpty={!paged.loading && !paged.error && !hasItems}
            empty={
              <EmptyState
                icon={<SearchX className="h-6 w-6" />}
                title="No one matches those filters"
                text="Try a different branch, batch or interest. New students join every week."
                action={<Button size="sm" onClick={reset}>Clear filters</Button>}
              />
            }
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {paged.items.map((person) => <PersonCard key={person.id} person={person} />)}
            </div>

            <div className="mt-4 flex flex-col items-center gap-2">
              {paged.moreError && <p role="alert" className="text-sm text-danger-ink">{paged.moreError}</p>}
              {paged.hasMore ? (
                <Button variant="secondary" loading={paged.loadingMore} onClick={paged.loadMore}>Load more people</Button>
              ) : (
                <p className="text-sm text-muted">You have seen everyone matching these filters.</p>
              )}
            </div>
          </AsyncView>
        </div>

        <aside aria-label="Weekly leaderboard">
          <Leaderboard />
        </aside>
      </div>
    </div>
  );
}
