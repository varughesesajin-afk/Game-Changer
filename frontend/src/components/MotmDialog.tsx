import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import MotmVote from "@/components/MotmVote";

export default function MotmDialog({ gameId, title, onClose }: { gameId: string | null; title?: string; onClose: () => void }) {
  return (
    <Dialog open={!!gameId} onOpenChange={(o: boolean) => !o && onClose()}>
      <DialogContent data-testid="motm-dialog" className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Vote for man of the match</DialogTitle>
          <DialogDescription>{title ?? "Who played best?"}</DialogDescription>
        </DialogHeader>
        {gameId && <MotmVote gameId={gameId} />}
      </DialogContent>
    </Dialog>
  );
}
