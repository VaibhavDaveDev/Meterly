import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';

const STYLE = 'lorelei';

const SEEDS = [
  'Felix', 'Aneka', 'Milo', 'Luna', 'Jack', 'Mia', 'Oliver', 'Sophie',
  'Charlie', 'Lily', 'Leo', 'Zoe', 'Max', 'Chloe', 'Jasper', 'Bella',
  'Oscar', 'Daisy', 'Toby', 'Ruby', 'Simba', 'Nala', 'Rocky', 'Coco',
  'Arlo', 'Willow', 'Finn', 'Ivy', 'Archie', 'Hazel',
];

function avatarUrl(seed: string) {
  return `https://api.dicebear.com/8.x/${STYLE}/svg?seed=${encodeURIComponent(seed)}`;
}

interface DiceBearPickerProps {
  seed: string;
  isSaving: boolean;
  onSeedChange: (seed: string) => void;
}

export function DiceBearPicker({ seed, isSaving, onSeedChange }: DiceBearPickerProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  // Quick picks — first 8 seeds
  const quickPicks = SEEDS.slice(0, 8);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {/* Quick pick grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
          {quickPicks.map(s => {
            const url = avatarUrl(s);
            const isSelected = seed === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => onSeedChange(s)}
                disabled={isSaving}
                title={s}
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '10px',
                  border: `2px solid ${isSelected ? 'var(--color-accent)' : 'var(--color-border)'}`,
                  backgroundColor: 'var(--color-surface-raised)',
                  padding: '3px',
                  cursor: 'pointer',
                  transition: 'border-color 150ms',
                  outline: isSelected ? '3px solid rgba(99,102,241,0.2)' : 'none',
                  outlineOffset: '1px',
                }}
              >
                <img
                  src={url}
                  alt={s}
                  style={{ width: '100%', height: '100%', borderRadius: '6px', objectFit: 'cover', display: 'block' }}
                />
              </button>
            );
          })}
        </div>

        {/* "More" button opens dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <button
              type="button"
              disabled={isSaving}
              title="Browse all avatars"
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '10px',
                border: '2px dashed var(--color-border)',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-text-muted)',
                transition: 'border-color 150ms, color 150ms',
              }}
            >
              <Plus size={18} strokeWidth={2} />
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[520px]">
            <DialogHeader>
              <DialogTitle>Choose an Avatar</DialogTitle>
              <DialogDescription>Lorelei illustrated avatars, powered by DiceBear.</DialogDescription>
            </DialogHeader>
            <div
              style={{
                maxHeight: '400px',
                overflowY: 'auto',
                marginTop: '12px',
                paddingRight: '4px',
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', padding: '2px' }}>
                {SEEDS.map(s => {
                  const url = avatarUrl(s);
                  const isSelected = seed === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        onSeedChange(s);
                        setDialogOpen(false);
                      }}
                      title={s}
                      style={{
                        aspectRatio: '1',
                        borderRadius: '12px',
                        border: `2px solid ${isSelected ? 'var(--color-accent)' : 'transparent'}`,
                        backgroundColor: 'var(--color-surface-raised)',
                        padding: '6px',
                        cursor: 'pointer',
                        transition: 'border-color 150ms, transform 150ms',
                        outline: isSelected ? '3px solid rgba(99,102,241,0.2)' : 'none',
                        outlineOffset: '1px',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.06)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = ''; }}
                    >
                      <img
                        src={url}
                        alt={s}
                        style={{ width: '100%', height: '100%', borderRadius: '6px', objectFit: 'cover', display: 'block' }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Show currently selected seed name */}
      {seed && (
        <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
          Selected: <strong style={{ color: 'var(--color-text)' }}>{seed}</strong>
        </p>
      )}
    </div>
  );
}