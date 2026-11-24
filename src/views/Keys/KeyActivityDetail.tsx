import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { KeyActivity } from '@/models/types/keyActivity.types';
import { activityCredits, compactTokens } from '@/models/services/keyActivityService';

export function KeyActivityDetail({ name, activity, open, onOpenChange }: { name: string; activity?: KeyActivity; open: boolean; onOpenChange: (open: boolean) => void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-2xl">
      <DialogHeader><DialogTitle className="break-words">{name}</DialogTitle><DialogDescription>Usage · last 30 days · UTC</DialogDescription></DialogHeader>
      {activity ? <>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
          <span>{activity.totals.requests.toLocaleString('en')} requests</span>
          <span>{activityCredits(activity.totals.spend)} in 30 days</span>
          {activity.lifetimeSpend != null && <span>{activityCredits(activity.lifetimeSpend)} all time</span>}
        </div>
        <div className="max-h-[60vh] overflow-auto">
          <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead className="text-right">Requests</TableHead><TableHead className="text-right">Input tokens</TableHead><TableHead className="text-right">Output tokens</TableHead><TableHead className="text-right">Credits</TableHead></TableRow></TableHeader>
            <TableBody>{[...activity.days].reverse().map(day => <TableRow key={day.date}><TableCell className="whitespace-nowrap">{day.date}</TableCell><TableCell className="text-right">{day.requests.toLocaleString('en')}</TableCell><TableCell className="text-right" title={day.inputTokens.toLocaleString('en')}>{compactTokens(day.inputTokens)}</TableCell><TableCell className="text-right" title={day.outputTokens.toLocaleString('en')}>{compactTokens(day.outputTokens)}</TableCell><TableCell className="text-right whitespace-nowrap">{activityCredits(day.spend).replace(' credits', '')}</TableCell></TableRow>)}</TableBody>
          </Table>
        </div>
      </> : <p className="text-sm text-muted-foreground">Usage is unavailable for this key.</p>}
    </DialogContent>
  </Dialog>;
}