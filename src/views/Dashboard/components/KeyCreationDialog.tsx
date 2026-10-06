import { useState } from "react";
import { t } from "@/i18n";
import { Plus, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface KeyCreationDialogProps {
  onCreateKey: (name: string, models: string[]) => Promise<boolean>;
  isCreating: boolean;
  canCreateMore: boolean;
  remainingKeys: number;
}

export const KeyCreationDialog = ({ 
  onCreateKey, 
  isCreating, 
  canCreateMore,
  remainingKeys 
}: KeyCreationDialogProps) => {
  const [open, setOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");

  const handleCreate = async () => {
    const success = await onCreateKey(newKeyName, []);
    if (success) {
      setNewKeyName("");
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="glow" disabled={!canCreateMore}>
          <Plus className="w-4 h-4 mr-2" />
          Create New Key
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New API Key</DialogTitle>
          <DialogDescription>
            Create a new API key to get started.
          </DialogDescription>
        </DialogHeader>

        {!canCreateMore && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {t("API key creation is currently unavailable.")}
            </AlertDescription>
          </Alert>
        )}

        {canCreateMore && (
          <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="keyName">Key Name</Label>
            <Input
              id="keyName"
              placeholder="my-api-key"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
            />
          </div>
          <div className="text-sm text-muted-foreground">
            The key grants access to all available models.
          </div>
            <Button
              onClick={handleCreate}
              disabled={isCreating}
              className="w-full"
            >
              {isCreating ? "Creating..." : "Create Key"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
