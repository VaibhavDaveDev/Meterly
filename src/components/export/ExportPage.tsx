import { useState, useEffect } from 'react';
import { Building2, Download, Home, FileSpreadsheet, Eye, Loader2, X } from 'lucide-react';
import { Button } from '../ui/button';
import { DataTable } from '../ui/data-table';

interface ExportDownload {
  type: 'owner-property' | 'tenant-tenancy';
  label: string;
  description: string;
  url: string;
}

interface PreviewRow {
  [key: string]: string;
}

export function ExportPage() {
  const [downloads, setDownloads] = useState<ExportDownload[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<{ id: number; headers: string[]; rows: PreviewRow[] } | null>(null);
  const [previewLoadingId, setPreviewLoadingId] = useState<number | null>(null);

  useEffect(() => {
    fetchExportLinks();
  }, []);

  const fetchExportLinks = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/export/all');
      const json = await res.json() as { downloads?: ExportDownload[]; error?: { message: string } };
      if (!res.ok) throw new Error(json.error?.message || 'Failed to fetch export links');
      setDownloads(json.downloads || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (url: string) => {
    window.open(url, '_blank');
  };

  const handlePreview = async (url: string, index: number) => {
    if (previewData?.id === index) {
      setPreviewData(null);
      return;
    }
    
    setPreviewLoadingId(index);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch preview');
      const text = await res.text();
      const lines = text.trim().split('\n');
      if (lines.length === 0) return;

      const parseCsvLine = (line: string) => 
        line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(s => s.replace(/^"|"$/g, '').trim());

      const headers = parseCsvLine(lines[0]);
      const rows = lines.slice(1, 11).map(line => {
        const values = parseCsvLine(line);
        const rowObj: PreviewRow = {};
        headers.forEach((header, i) => {
          rowObj[header] = values[i] || '—';
        });
        return rowObj;
      });
      
      setPreviewData({ id: index, headers, rows });
    } catch (e) {
      console.error(e);
    } finally {
      setPreviewLoadingId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-1/4 bg-surface rounded"></div>
        <div className="h-4 w-1/2 bg-surface rounded mb-8"></div>
        <div className="space-y-4">
          <div className="h-24 bg-surface rounded-xl border border-border"></div>
          <div className="h-24 bg-surface rounded-xl border border-border"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center text-destructive bg-destructive/10 rounded-xl border border-destructive/20">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      <div>
        <h1 className="text-3xl font-bold font-heading mb-2 text-balance">Data Export</h1>
        <p className="text-muted-foreground text-pretty">Download your billing history as CSV. Open in Excel or Google Sheets.</p>
      </div>

      {downloads.length === 0 ? (
        <div className="p-12 text-center border border-border rounded-xl bg-surface/50">
          <FileSpreadsheet className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-1">No data available to export</h3>
          <p className="text-sm text-muted-foreground">You don't have any properties or tenancies yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {downloads.map((item, index) => (
            <div key={index} className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 rounded-xl border border-border bg-surface hover:bg-muted/30 transition-colors gap-3 sm:gap-4">
                <div className="flex items-start gap-3 sm:gap-4 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                    {item.type === 'owner-property' ? (
                      <Building2 className="w-5 h-5 text-primary" />
                    ) : (
                      <Home className="w-5 h-5 text-primary" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-foreground mb-1 text-balance">{item.label}</h3>
                    <div className="text-sm text-muted-foreground text-pretty">
                      {item.description} &middot; All dates
                    </div>
                  </div>
                </div>
                <div className="flex flex-row gap-2 shrink-0 w-full sm:w-auto">
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="flex-1 sm:flex-none" 
                    onClick={() => handlePreview(item.url, index)} 
                    disabled={previewLoadingId === index}
                  >
                    {previewLoadingId === index ? (
                      <Loader2 className="w-4 h-4 sm:mr-2 animate-spin" aria-hidden="true" />
                    ) : (
                      <Eye className="w-4 h-4 sm:mr-2" aria-hidden="true" />
                    )}
                    <span className="hidden sm:inline">{previewLoadingId === index ? 'Loading…' : 'Preview'}</span>
                  </Button>
                  <Button 
                    size="sm"
                    className="flex-1 sm:flex-none" 
                    onClick={() => handleDownload(item.url)}
                  >
                    <Download className="w-4 h-4 sm:mr-2" aria-hidden="true" /> 
                    <span className="hidden sm:inline">Download CSV</span>
                  </Button>
                </div>
              </div>
              
              {previewData?.id === index && (
                <div className="border border-border rounded-xl overflow-hidden bg-surface">
                  <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-surface/50">
                    <h4 className="text-sm font-medium">
                      Preview <span className="text-muted-foreground font-normal ml-1">({previewData.rows.length} rows)</span>
                    </h4>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setPreviewData(null)}
                      className="h-7 w-7 p-0"
                    >
                      <X className="w-4 h-4" />
                      <span className="sr-only">Close preview</span>
                    </Button>
                  </div>
                  
                  {previewData.rows.length === 0 ? (
                    <div className="p-8 text-center bg-surface/50">
                      <p className="text-sm text-muted-foreground">No data records found.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <DataTable
                        data={previewData.rows}
                        columns={previewData.headers.map(header => ({
                          header,
                          accessor: (row: PreviewRow) => (
                            <div className="max-w-[200px] truncate whitespace-nowrap" title={row[header]}>
                              {row[header]}
                            </div>
                          ),
                        }))}
                        emptyState={<p className="text-sm text-muted-foreground">No data records found.</p>}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
