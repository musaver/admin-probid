"use client";

import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import {
  FileSpreadsheet,
  FileDown,
  Upload,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";

interface ImportedProperty {
  Title: string;
  "Sale ID"?: string;
  "Parcel ID"?: string;
  Address?: string;
  City?: string;
  "Zip Code"?: number | string;
  "Minimum Bid"?: number;
  "Winning Bid"?: number;
  "Auction End Date"?: string;
  Owners?: string;
  Status?: string;
}

interface CountyUser {
  id: string;
  name: string | null;
  email: string;
}

interface BulkUploadModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function BulkUploadModal({
  open,
  onClose,
  onSuccess,
}: BulkUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<ImportedProperty[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [stage, setStage] = useState<"select" | "preview">("select");

  const [countyUsers, setCountyUsers] = useState<CountyUser[]>([]);
  const [countyUserId, setCountyUserId] = useState<string>("");
  const [loadingCounties, setLoadingCounties] = useState(false);

  useEffect(() => {
    if (open) {
      setLoadingCounties(true);
      fetch("/api/users?type=county&pageSize=all")
        .then((res) => res.json())
        .then((data) => {
          setCountyUsers(data.users || []);
        })
        .catch((err) => console.error("Failed to load county users:", err))
        .finally(() => setLoadingCounties(false));
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setData([]);
      setErrors([]);
      setUploading(false);
      setStage("select");
      setCountyUserId("");
    }
  }, [open]);

  const downloadTemplate = (ext: "xlsx" | "xls" | "csv") => {
    const headers = [
      "Title",
      "Sale ID",
      "Parcel ID",
      "Address",
      "City",
      "Zip Code",
      "Minimum Bid",
      "Winning Bid",
      "Auction End Date",
      "Owners",
      "Status",
    ];
    const sampleData = [
      {
        Title: "Example Property",
        "Sale ID": "2024-001",
        "Parcel ID": "12-34-567",
        Address: "123 Main St",
        City: "Anytown",
        "Zip Code": "12345",
        "Minimum Bid": 1000,
        "Winning Bid": 1200,
        "Auction End Date": "2026-12-31",
        Owners: "Doe, John; Smith, Jane",
        Status: "active",
      },
      {
        Title: "Vacant Lot",
        "Sale ID": "2024-002",
        "Parcel ID": "12-34-568",
        Address: "0 Oak Ave",
        City: "Anytown",
        "Zip Code": "12345",
        "Minimum Bid": 500,
        "Winning Bid": 0,
        "Auction End Date": "2026-12-31",
        Owners: "Brown, Bob",
        Status: "active",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData, { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, `ProBid_Property_Template.${ext}`);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const parseFile = async () => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const bstr = e.target?.result;
      const wb = XLSX.read(bstr, { type: "binary" });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const jsonData = XLSX.utils.sheet_to_json<ImportedProperty>(ws);
      setData(jsonData);
      validateData(jsonData);
      setStage("preview");
    };
    reader.readAsBinaryString(file);
  };

  const validateData = (items: ImportedProperty[]) => {
    const newErrors: string[] = [];
    if (items.length === 0) {
      newErrors.push("File appears to be empty.");
      setErrors(newErrors);
      return;
    }
    items.forEach((item, index) => {
      if (!item.Title) {
        newErrors.push(`Row ${index + 2}: Missing required 'Title'.`);
      }
    });
    setErrors(newErrors);
  };

  const handleUpload = async () => {
    if (!countyUserId) {
      alert("Please select a county user.");
      return;
    }
    setUploading(true);
    try {
      const res = await fetch("/api/properties/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ properties: data, countyUserId }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Upload failed");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Batch Import Properties
          </DialogTitle>
        </DialogHeader>

        {stage === "select" ? (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Import on behalf of County</Label>
              {loadingCounties ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading county users...
                </div>
              ) : (
                <Select value={countyUserId} onValueChange={setCountyUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a county user..." />
                  </SelectTrigger>
                  <SelectContent>
                    {countyUsers.map((cu) => (
                      <SelectItem key={cu.id} value={cu.id}>
                        {cu.name || cu.email} ({cu.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="rounded-lg border bg-muted/50 p-5 text-center space-y-3">
              <p className="font-medium text-sm">Step 1: Download a template</p>
              <div className="flex justify-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadTemplate("xlsx")}
                >
                  <FileDown className="mr-1.5 h-4 w-4" />
                  Excel (.xlsx)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadTemplate("csv")}
                >
                  <FileDown className="mr-1.5 h-4 w-4" />
                  CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadTemplate("xls")}
                >
                  <FileDown className="mr-1.5 h-4 w-4" />
                  Excel 97-2003 (.xls)
                </Button>
              </div>
            </div>

            <div className="text-center space-y-3">
              <p className="font-medium text-sm">Step 2: Upload your file</p>
              <Input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
                className="max-w-sm mx-auto"
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={parseFile}
                disabled={!file || !countyUserId}
              >
                <Upload className="mr-2 h-4 w-4" />
                Next: Preview
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            {errors.length > 0 ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Validation Errors:</strong>
                  <ul className="list-disc ml-4 mt-1">
                    {errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            ) : (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  Ready to import <strong>{data.length}</strong> properties for{" "}
                  <strong>
                    {countyUsers.find((c) => c.id === countyUserId)?.name ||
                      countyUsers.find((c) => c.id === countyUserId)?.email}
                  </strong>
                  .
                </AlertDescription>
              </Alert>
            )}

            <div className="max-h-[350px] overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Title</TableHead>
                    <TableHead className="whitespace-nowrap">Sale ID</TableHead>
                    <TableHead className="whitespace-nowrap">Parcel ID</TableHead>
                    <TableHead className="whitespace-nowrap">Address</TableHead>
                    <TableHead className="whitespace-nowrap">City</TableHead>
                    <TableHead className="whitespace-nowrap">Zip Code</TableHead>
                    <TableHead className="whitespace-nowrap">Min Bid</TableHead>
                    <TableHead className="whitespace-nowrap">Winning Bid</TableHead>
                    <TableHead className="whitespace-nowrap">Auction End</TableHead>
                    <TableHead className="whitespace-nowrap">Owners</TableHead>
                    <TableHead className="whitespace-nowrap">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.slice(0, 50).map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="whitespace-nowrap">
                        {row.Title || (
                          <span className="text-destructive font-medium">
                            Missing
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {row["Sale ID"] || "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {row["Parcel ID"] || "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {row.Address || "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {row.City || "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {row["Zip Code"] || "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {row["Minimum Bid"] || "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {row["Winning Bid"] || "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {row["Auction End Date"] || "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {row.Owners || "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {row.Status ? (
                          <Badge variant="outline">{row.Status}</Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {data.length > 50 && (
                <p className="text-center text-sm text-muted-foreground py-2">
                  And {data.length - 50} more...
                </p>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setStage("select")}
                disabled={uploading}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button
                onClick={handleUpload}
                disabled={errors.length > 0 || uploading}
              >
                {uploading && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {uploading ? "Importing..." : "Import Properties"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
