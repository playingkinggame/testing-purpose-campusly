import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input, Select } from '@/components/ui/Field';
import { BRANCH_SUGGESTIONS, INTEREST_SUGGESTIONS, SCHOOL_SUGGESTIONS } from '@/lib/constants';
import type { Residence } from '@/types/db';

export interface DiscoverFilterValues {
  batch: string;
  branch: string;
  school: string;
  residence: Residence | '';
  interest: string;
  query: string;
}

export const EMPTY_DISCOVER_FILTERS: DiscoverFilterValues = {
  batch: '', branch: '', school: '', residence: '', interest: '', query: '',
};

const YEARS = Array.from({ length: 26 }, (_, index) => 2040 - index);

interface Props {
  value: DiscoverFilterValues;
  onChange: (patch: Partial<DiscoverFilterValues>) => void;
  onApply: () => void;
  onReset: () => void;
}

export function DiscoverFilters({ value, onChange, onApply, onReset }: Props) {
  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-forest">Filters</h2>
          <p className="text-sm text-muted">Mix a few to find your people.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onReset}>Reset</Button>
      </div>

      <Input
        label="Search"
        value={value.query}
        onChange={(e) => onChange({ query: e.target.value })}
        placeholder="Name or username"
        autoComplete="off"
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Select label="Batch" value={value.batch} onChange={(e) => onChange({ batch: e.target.value })}>
          <option value="">Any batch</option>
          {YEARS.map((year) => <option key={year} value={String(year)}>{year}</option>)}
        </Select>

        <Input label="Branch" list="discover-branch-list" value={value.branch} onChange={(e) => onChange({ branch: e.target.value })} placeholder="CSE" />
        <datalist id="discover-branch-list">{BRANCH_SUGGESTIONS.map((b) => <option key={b} value={b} />)}</datalist>

        <Input label="School" list="discover-school-list" value={value.school} onChange={(e) => onChange({ school: e.target.value })} placeholder="SCOPE" />
        <datalist id="discover-school-list">{SCHOOL_SUGGESTIONS.map((s) => <option key={s} value={s} />)}</datalist>

        <Select
          label="Residence"
          value={value.residence}
          onChange={(e) => onChange({ residence: e.target.value as Residence | '' })}
        >
          <option value="">Any</option>
          <option value="hosteller">Hosteller</option>
          <option value="day_scholar">Day scholar</option>
        </Select>

        <Input label="Interest" list="discover-interest-list" value={value.interest} onChange={(e) => onChange({ interest: e.target.value })} placeholder="Hackathons" />
        <datalist id="discover-interest-list">{INTEREST_SUGGESTIONS.map((i) => <option key={i} value={i} />)}</datalist>
      </div>

      <Button className="w-full sm:w-auto" onClick={onApply}>Show people</Button>
    </Card>
  );
}
